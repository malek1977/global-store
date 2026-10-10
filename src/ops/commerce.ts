/* =====================================================================
 *  GLOBAL STORE — Commerce operations
 *  Sales / purchases / payments / stock. Every operation writes to the
 *  operational tables AND posts the matching accounting entry.
 * ===================================================================== */
import { q, one, scalar, tx, getDB, type Row } from '../db/db';
import { post, ACC, accountBalance } from '../accounting/engine';
import { round2 } from '../lib/format';

export function audit(action: string, entity: string, entityId?: number | null, before?: any, after?: any, userId?: number | null) {
  const db = getDB();
  const u = userId ? one<Row>('SELECT username FROM users WHERE id=?', [userId]) : null;
  db.run(
    `INSERT INTO audit_log (user_id,username,action,entity,entity_id,before_json,after_json,ip) VALUES (?,?,?,?,?,?,?,?)`,
    [userId ?? null, u?.username ?? null, action, entity, entityId ?? null,
     before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, '127.0.0.1'],
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const uid = (p: string) => `${p}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

export interface CartLine { product_id: number; qty: number; unit_price?: number; discount?: number }

export function priceFor(productId: number, tier: 'retail' | 'wholesale', qty: number): number {
  const rows = q<{ price: number; min_qty: number }>(
    `SELECT price, min_qty FROM price_lists WHERE product_id=? AND tier=? AND min_qty<=?
     ORDER BY min_qty DESC LIMIT 1`, [productId, tier, qty]);
  if (rows.length) return rows[0].price;
  const p = one<Row>('SELECT retail_price, wholesale_price FROM products WHERE id=?', [productId]);
  if (!p) throw new Error('منتج غير موجود');
  return tier === 'wholesale' ? p.wholesale_price : p.retail_price;
}

/* ------------------------------------------------------------ SALES */
export interface SaleInput {
  partner_id?: number | null;
  branch_id?: number | null;
  user_id?: number | null;
  channel?: 'retail' | 'wholesale' | 'online';
  items: CartLine[];
  discount?: number;
  paid?: number;
  method?: 'cash' | 'bank' | 'card' | 'transfer' | 'cheque';
  ship?: { name?: string; phone?: string; city?: string; address?: string };
  note?: string;
  posted?: boolean;          // false = draft (no stock/journal impact)
}

export function createSale(input: SaleInput): number {
  if (!input.items?.length) throw new Error('السلة فارغة');
  const tier = input.channel === 'wholesale' ? 'wholesale' : 'retail';
  const rows = input.items.map((l) => {
    const p = one<Row>('SELECT * FROM products WHERE id=?', [l.product_id]);
    if (!p) throw new Error(`منتج غير موجود (#${l.product_id})`);
    if (!p.is_service && p.qty < l.qty) throw new Error(`الكمية غير متوفرة: ${p.name_ar}`);
    const price = l.unit_price ?? priceFor(l.product_id, tier, l.qty);
    const disc = l.discount ?? 0;
    return {
      product: p, qty: l.qty, price,
      discount: disc,
      line: round2(price * l.qty - disc),
      vat: p.vat_rate ?? 0.15,
    };
  });

  const subtotal = round2(rows.reduce((t, r) => t + r.line, 0));
  const extraDisc = input.discount ?? 0;
  const netAfterDisc = round2(Math.max(0, subtotal - extraDisc));
  // order-level discount is spread proportionally, then VAT is computed per line
  const scale = subtotal > 0 ? netAfterDisc / subtotal : 1;
  const vatTotal = round2(rows.reduce((t, r) => t + r.line * scale * r.vat, 0));
  const total = round2(netAfterDisc + vatTotal);
  const costTotal = round2(rows.reduce((t, r) => t + r.product.cost_price * r.qty, 0));
  const paid = round2(Math.min(input.paid ?? total, total));

  let orderId = 0;
  tx(() => {
    const db = getDB();
    db.run(
      `INSERT INTO sales_orders (order_no,partner_id,branch_id,user_id,channel,status,subtotal,discount,vat_amount,total,cost_total,paid,ship_name,ship_phone,ship_city,ship_address,note,placed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uid('SO'), input.partner_id ?? null, input.branch_id ?? 1, input.user_id ?? null,
       input.channel ?? 'retail', input.posted === false ? 'draft' : 'confirmed',
       netAfterDisc, extraDisc, vatTotal, total, costTotal, paid,
       input.ship?.name ?? null, input.ship?.phone ?? null, input.ship?.city ?? null, input.ship?.address ?? null,
       input.note ?? null, stamp()],
    );
    orderId = scalar<number>('SELECT last_insert_rowid() AS v');
    for (const r of rows) {
      db.run(
        `INSERT INTO sales_items (order_id,product_id,qty,unit_price,cost_price,discount,vat_rate,line_total) VALUES (?,?,?,?,?,?,?,?)`,
        [orderId, r.product.id, r.qty, r.price, r.product.cost_price, r.discount, r.vat, round2(r.line * scale)]);
      if (input.posted !== false && !r.product.is_service) {
        db.run('UPDATE products SET qty = qty - ? WHERE id=?', [r.qty, r.product.id]);
        db.run(
          `INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
           VALUES (?,?,'out',?,?,'sales_order',?,?,?,?)`,
          [r.product.id, input.channel === 'wholesale' ? 3 : 1, r.qty, r.product.cost_price, orderId,
           'بيع', input.user_id ?? null, stamp()]);
      }
    }
  });

  if (input.posted !== false) {
    const ar = round2(total - paid);
    const lines = [
      ...(paid > 0 ? [{ code: input.channel === 'online' ? ACC.GATEWAY : ACC.CASH, debit: paid }] : []),
      ...(ar > 0 ? [{ code: ACC.AR, debit: ar, partner_id: input.partner_id ?? undefined }] : []),
      ...(vatTotal > 0 ? [{ code: ACC.VAT_PAY, credit: vatTotal }] : []),
      { code: input.channel === 'wholesale' ? ACC.REV_WHOLESALE : ACC.REV_RETAIL, credit: netAfterDisc },
      ...(costTotal > 0 ? [
        { code: ACC.COGS, debit: costTotal },
        { code: ACC.INV_PHONE, credit: costTotal },
      ] : []),
    ];
    post({
      date: today(), kind: 'sale',
      reference: one<{ order_no: string }>('SELECT order_no FROM sales_orders WHERE id=?', [orderId])?.order_no,
      memo: `فاتورة بيع ${input.channel === 'wholesale' ? 'جملة' : 'تجزئة'}`,
      lines, source_table: 'sales_orders', source_id: orderId, user_id: input.user_id ?? null,
    });
    if (paid > 0) {
      tx(() => {
        getDB().run(
          `INSERT INTO payments (partner_id,direction,method,amount,reference,order_id,journal_id,paid_at,user_id)
           VALUES (?,'in',?,?,?,?,NULL,?,?)`,
          [input.partner_id ?? null, input.method ?? 'cash', paid, uid('RCP'), orderId, stamp(), input.user_id ?? null]);
      });
    }
    if (input.partner_id) {
      tx(() => getDB().run('UPDATE partners SET balance = balance + ? WHERE id=?', [round2(total - paid), input.partner_id]));
    }
  }
  audit('CREATE', 'sales_order', orderId, null, { total, items: rows.length }, input.user_id);
  return orderId;
}

export function cancelSale(orderId: number, userId?: number | null, reason = ''): void {
  const o = one<Row>('SELECT * FROM sales_orders WHERE id=?', [orderId]);
  if (!o) throw new Error('الفاتورة غير موجودة');
  if (o.status === 'cancelled') return;
  const lines = q<Row>('SELECT * FROM sales_items WHERE order_id=?', [orderId]);
  const jr = one<Row>(`SELECT id FROM journals WHERE source_table='sales_orders' AND source_id=? LIMIT 1`, [orderId]);
  tx(() => {
    const db = getDB();
    for (const l of lines) {
      db.run('UPDATE products SET qty = qty + ? WHERE id=?', [l.qty, l.product_id]);
      db.run(
        `INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
         VALUES (?,1,'return',?,?,'sales_order',?,?,?,?)`,
        [l.product_id, l.qty, l.cost_price, orderId, `إلغاء فاتورة ${reason}`, userId ?? null, stamp()]);
    }
    db.run(`UPDATE sales_orders SET status='cancelled' WHERE id=?`, [orderId]);
    if (o.partner_id) db.run('UPDATE partners SET balance = balance - ? WHERE id=?', [round2(o.total - o.paid), o.partner_id]);
  });
  if (jr?.id) {
    const rev = q<Row>(
      `SELECT a.code, jl.debit, jl.credit FROM journal_lines jl JOIN accounts a ON a.id=jl.account_id WHERE jl.journal_id=?`, [jr.id]);
    post({
      date: today(), kind: 'adjust', reference: `إلغاء ${o.order_no}`, memo: `إلغاء فاتورة بيع — ${reason}`,
      source_table: 'sales_orders', source_id: orderId, user_id: userId ?? null,
      lines: rev.map((r) => ({ code: r.code, debit: r.credit, credit: r.debit })),
    });
  }
  audit('CANCEL', 'sales_order', orderId, o, null, userId);
}

/* --------------------------------------------------------- PURCHASE */
export interface PurchaseInput {
  partner_id: number; branch_id?: number; user_id?: number | null;
  items: CartLine[]; discount?: number; paid?: number;
  method?: 'cash' | 'bank' | 'card' | 'transfer' | 'cheque';
  supplier_ref?: string; due_date?: string; note?: string;
}

export function createPurchase(input: PurchaseInput): number {
  if (!input.items?.length) throw new Error('لا توجد أصناف');
  const rows = input.items.map((l) => {
    const p = one<Row>('SELECT * FROM products WHERE id=?', [l.product_id]);
    if (!p) throw new Error('منتج غير موجود');
    const cost = l.unit_price ?? p.cost_price;
    return { product: p, qty: l.qty, cost, line: round2(cost * l.qty), vat: p.vat_rate ?? 0.15 };
  });
  const subtotal = round2(rows.reduce((t, r) => t + r.line, 0));
  const disc = input.discount ?? 0;
  const net = round2(Math.max(0, subtotal - disc));
  const vat = round2(rows.reduce((t, r) => t + r.line * r.vat, 0));
  const total = round2(net + vat);
  const paid = round2(Math.min(input.paid ?? 0, total));

  let poId = 0;
  tx(() => {
    const db = getDB();
    db.run(
      `INSERT INTO purchase_orders (order_no,partner_id,branch_id,user_id,status,subtotal,discount,vat_amount,total,paid,supplier_ref,due_date,note,ordered_at,received_at)
       VALUES (?,?,?,?,'received',?,?,?,?,?,?,?,?,?,?)`,
      [uid('PO'), input.partner_id, input.branch_id ?? 3, input.user_id ?? null, net, disc, vat, total, paid,
       input.supplier_ref ?? null, input.due_date ?? null, input.note ?? null, stamp(), stamp()],
    );
    poId = scalar<number>('SELECT last_insert_rowid() AS v');
    for (const r of rows) {
      db.run(`INSERT INTO purchase_items (order_id,product_id,qty,unit_cost,vat_rate,line_total) VALUES (?,?,?,?,?,?)`,
        [poId, r.product.id, r.qty, r.cost, r.vat, r.line]);
      db.run('UPDATE products SET qty = qty + ?, cost_price = ? WHERE id=?', [r.qty, r.cost, r.product.id]);
      db.run(
        `INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
         VALUES (?,?,'in',?,?,'purchase_order',?,?,?,?)`,
        [r.product.id, input.branch_id ?? 3, r.qty, r.cost, poId, 'استلام بضاعة', input.user_id ?? null, stamp()]);
    }
  });

  post({
    date: today(), kind: 'purchase', reference: one<{ order_no: string }>('SELECT order_no FROM purchase_orders WHERE id=?', [poId])?.order_no,
    memo: 'فاتورة شراء',
    lines: [
      { code: ACC.INV_PHONE, debit: net },
      { code: ACC.VAT_REC, debit: vat },
      { code: ACC.AP, credit: total, partner_id: input.partner_id },
    ],
    source_table: 'purchase_orders', source_id: poId, user_id: input.user_id ?? null,
  });

  if (paid > 0) {
    let payId = 0;
    tx(() => {
      getDB().run(
        `INSERT INTO payments (partner_id,direction,method,amount,reference,order_id,journal_id,paid_at,user_id)
         VALUES (?,'out',?,?,?,?,NULL,?,?)`,
        [input.partner_id, input.method ?? 'bank', paid, uid('TRX'), poId, stamp(), input.user_id ?? null]);
      payId = scalar<number>('SELECT last_insert_rowid() AS v');
    });
    post({
      date: today(), kind: 'payment', reference: 'سداد مورد', memo: 'سداد لفاتورة شراء',
      lines: [{ code: ACC.AP, debit: paid }, { code: ACC.BANK, credit: paid }],
      source_table: 'payments', source_id: payId, user_id: input.user_id ?? null,
    });
  }
  // purchases increase what we owe suppliers => payable side (negative balance)
  tx(() => getDB().run('UPDATE partners SET balance = balance - ? WHERE id=?', [round2(total - paid), input.partner_id]));
  audit('CREATE', 'purchase_order', poId, null, { total, partner: partner?.balance }, input.user_id);
  return poId;
}

/* --------------------------------------------------------- PAYMENTS */
export function recordPayment(p: {
  partner_id: number; direction: 'in' | 'out'; amount: number;
  method?: 'cash' | 'bank' | 'card' | 'transfer' | 'cheque';
  reference?: string; order_id?: number | null; user_id?: number | null; note?: string;
}): number {
  const amount = round2(p.amount);
  if (amount <= 0) throw new Error('قيمة غير صالحة');
  let pid = 0;
  tx(() => {
    getDB().run(
      `INSERT INTO payments (partner_id,direction,method,amount,reference,order_id,journal_id,paid_at,user_id)
       VALUES (?,'in',?,?,?,?,NULL,?,?)`,
      [p.partner_id, p.direction, p.method ?? 'bank', amount, p.reference ?? uid('RCP'), p.order_id ?? null, stamp(), p.user_id ?? null]);
    pid = scalar<number>('SELECT last_insert_rowid() AS v');
    const d = p.direction === 'in' ? -amount : amount;
    getDB().run('UPDATE partners SET balance = balance + ? WHERE id=?', [d, p.partner_id]);
    if (p.order_id && p.direction === 'in') {
      getDB().run('UPDATE sales_orders SET paid = MIN(total, paid + ?) WHERE id=?', [amount, p.order_id]);
    } else if (p.order_id) {
      getDB().run('UPDATE purchase_orders SET paid = MIN(total, paid + ?) WHERE id=?', [amount, p.order_id]);
    }
  });
  post({
    date: today(), kind: 'payment', reference: p.reference ?? '', memo: p.note ?? (p.direction === 'in' ? 'تحصيل من عميل' : 'سداد لمورد'),
    lines: p.direction === 'in'
      ? [{ code: p.method === 'bank' ? ACC.BANK : ACC.CASH, debit: amount }, { code: ACC.AR, credit: amount, partner_id: p.partner_id }]
      : [{ code: ACC.AP, debit: amount }, { code: ACC.BANK, credit: amount, partner_id: p.partner_id }],
    source_table: 'payments', source_id: pid, user_id: p.user_id ?? null,
  });
  audit('PAYMENT', 'payments', pid, null, { amount, direction: p.direction }, p.user_id);
  return pid;
}

/* ---------------------------------------------------------- STOCK */
export function adjustStock(p: {
  product_id: number; qty_delta: number; kind?: string; note?: string;
  warehouse_id?: number; user_id?: number | null;
}) {
  const prod = one<Row>('SELECT * FROM products WHERE id=?', [p.product_id]);
  if (!prod) throw new Error('منتج غير موجود');
  if (p.qty_delta < 0 && prod.qty + p.qty_delta < 0) throw new Error('الكمية غير كافية للخصم');
  const kind = p.kind ?? (p.qty_delta >= 0 ? 'adjust' : 'damage');
  tx(() => {
    const db = getDB();
    db.run('UPDATE products SET qty = qty + ? WHERE id=?', [p.qty_delta, p.product_id]);
    db.run(
      `INSERT INTO stock_movements (product_id,warehouse_id,kind,qty,unit_cost,ref_type,ref_id,note,user_id,created_at)
       VALUES (?,?,?,?,?,'adjust',NULL,?,?,?)`,
      [p.product_id, p.warehouse_id ?? 1, kind, p.qty_delta, prod.cost_price, p.note ?? 'تسوية مخزون', p.user_id ?? null, stamp()]);
  });
  audit('STOCK', 'products', p.product_id, { qty: prod.qty }, { qty: prod.qty + p.qty_delta }, p.user_id);
  return true;
}

export function lowStock() {
  return q<Row>(
    `SELECT p.*, c.name_ar AS cat_ar, c.name_en AS cat_en, b.name_ar AS brand_ar, b.name_en AS brand_en
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     LEFT JOIN brands b ON b.id=p.brand_id
     WHERE p.is_service=0 AND p.qty <= p.reorder_level
     ORDER BY (p.qty - p.reorder_level) ASC LIMIT 60`);
}

export function stockValuation() {
  return q<Row>(
    `SELECT c.id, c.name_ar, c.name_en, c.icon,
            COUNT(p.id) AS items,
            COALESCE(SUM(p.qty),0) AS units,
            COALESCE(SUM(p.qty*p.cost_price),0) AS cost_value,
            COALESCE(SUM(p.qty*p.retail_price),0) AS retail_value,
            SUM(CASE WHEN p.qty <= p.reorder_level THEN 1 ELSE 0 END) AS low_count
     FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.is_service=0
     GROUP BY c.id ORDER BY cost_value DESC`);
}

export function inventoryTurnover(days = 90) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const cogs = scalar<number>(
    `SELECT COALESCE(SUM(jl.debit),0) AS v FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id WHERE a.code=? AND j.entry_date>=?`, [ACC.COGS, since]);
  const avgInv = inventoryAvg();
  return { days, cogs: round2(cogs), avgInventory: round2(avgInv), turns: avgInv ? round2(cogs / avgInv) : 0 };
}

function inventoryAvg(): number {
  const v = accountBalance(ACC.INV_PHONE);
  return Math.abs(v) || 1;
}

/* ------------------------------------------------------ dashboard KPIs */
export function kpis(from: string, to: string) {
  const row = one<Row>(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue,
            COALESCE(SUM(cost_total),0) AS cost, COALESCE(SUM(vat_amount),0) AS vat,
            COALESCE(SUM(total-paid),0) AS receivables
     FROM sales_orders WHERE status<>'cancelled' AND date(placed_at)>=? AND date(placed_at)<=?`, [from, to])!;
  const customers = scalar<number>(`SELECT COUNT(DISTINCT partner_id) AS v FROM sales_orders WHERE status<>'cancelled' AND date(placed_at) BETWEEN ? AND ?`, [from, to]);
  const profit = round2(row.revenue - row.cost - row.vat);
  const repairs = one<Row>(
    `SELECT COUNT(*) AS tickets, COALESCE(SUM(final_cost),0) AS revenue FROM repair_tickets
     WHERE status IN ('completed','delivered') AND date(intake_at) BETWEEN ? AND ?`, [from, to])!;
  const po = one<Row>(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS total, COALESCE(SUM(total-paid),0) AS payable
     FROM purchase_orders WHERE status<>'cancelled' AND date(ordered_at) BETWEEN ? AND ?`, [from, to])!;
  return {
    orders: row.orders, revenue: round2(row.revenue), cost: round2(row.cost), vat: round2(row.vat),
    receivables: round2(row.receivables), customers,
    grossProfit: round2(row.revenue - row.cost),
    marginPct: row.revenue ? round2(((row.revenue - row.cost) / row.revenue) * 100) : 0,
    netAfterVat: profit,
    repairs: repairs.tickets, repairRevenue: round2(repairs.revenue),
    purchaseOrders: po.orders, purchaseTotal: round2(po.total), payables: round2(po.payable),
    inventoryValue: round2(scalar<number>(`SELECT COALESCE(SUM(qty*cost_price),0) AS v FROM products WHERE is_service=0`)),
    lowStockCount: scalar<number>(`SELECT COUNT(*) AS v FROM products WHERE is_service=0 AND qty<=reorder_level`),
    openTickets: scalar<number>(`SELECT COUNT(*) AS v FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')`),
    arBalance: round2(accountBalance(ACC.AR)),
    apBalance: round2(accountBalance(ACC.AP)),
    cashPosition: round2(accountBalance(ACC.CASH) + accountBalance(ACC.BANK) + accountBalance(ACC.GATEWAY)),
  };
}
