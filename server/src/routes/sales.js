/* =====================================================================
 *  Sales — order creation, payments, cancellation (double-entry aware)
 * ===================================================================== */
import { Router } from 'express';
import { z } from 'zod';
import { db, authenticate } from '../lib/core.js';
import { requirePermission } from '../lib/rbac.js';
import { audit } from '../lib/audit.js';
import { clean, docId, money, pagination } from '../lib/http.js';
import { postJournal } from '../lib/accounting.js';

export const router = Router();
router.use(authenticate);

const orderSchema = z.object({
  partner_id: z.number().int().positive().nullable().optional(),
  branch_id: z.number().int().positive().default(1),
  channel: z.enum(['retail', 'wholesale', 'online']).default('retail'),
  paid: z.number().min(0).default(0),
  method: z.enum(['cash', 'bank', 'card', 'transfer', 'cheque']).default('cash'),
  note: z.string().max(500).optional(),
  ship: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(9).max(20),
    city: z.string().max(80).optional(),
    address: z.string().max(400).optional(),
  }).optional(),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    qty: z.number().positive().max(100000),
    unit_price: z.number().min(0).optional(),
    discount: z.number().min(0).default(0),
  })).min(1).max(200),
});

const ACC = { CASH: '1100', BANK: '1110', GATEWAY: '1120', AR: '1200', INV: '1300', VAT: '2200', COGS: '5100', REV_W: '4100', REV_R: '4200' };

function priceFor(productId, tier, qty) {
  const row = db.prepare(
    `SELECT price FROM price_lists WHERE product_id=? AND tier=? AND min_qty<=? ORDER BY min_qty DESC LIMIT 1`,
  ).get(productId, tier, qty);
  if (row) return row.price;
  const p = db.prepare('SELECT retail_price, wholesale_price FROM products WHERE id=?').get(productId);
  return tier === 'wholesale' ? p.wholesale_price : p.retail_price;
}

router.post('/', requirePermission('store.manage'), (req, res, next) => {
  try {
    const input = orderSchema.parse(req.body);
    const tier = input.channel === 'wholesale' ? 'wholesale' : 'retail';

    const lines = input.items.map((it) => {
      const p = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(it.product_id);
      if (!p) throw Object.assign(new Error('product_not_found'), { status: 404 });
      if (!p.is_service && p.qty < it.qty) {
        throw Object.assign(new Error(`insufficient_stock:${p.sku}`), { status: 409 });
      }
      const price = it.unit_price ?? priceFor(it.product_id, tier, it.qty);
      return { product: p, qty: it.qty, price, discount: it.discount, line: money(price * it.qty - it.discount), vat: p.vat_rate };
    });

    const subtotal = money(lines.reduce((t, l) => t + l.line, 0));
    const vatTotal = money(lines.reduce((t, l) => t + l.line * l.vat, 0));
    const total = money(subtotal + vatTotal);
    const costTotal = money(lines.reduce((t, l) => t + l.product.cost_price * l.qty, 0));
    const paid = money(Math.min(input.paid, total));
    const orderNo = docId('SO');

    const create = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO sales_orders (order_no, partner_id, branch_id, user_id, channel, status,
            subtotal, discount, vat_amount, total, cost_total, paid,
            ship_name, ship_phone, ship_city, ship_address, note, placed_at)
         VALUES (?,?,?,?,?,'confirmed',?,0,?,?,?,?,?,?,?,?,datetime('now'))`,
      ).run(orderNo, input.partner_id ?? null, input.branch_id, req.user.id, input.channel,
        subtotal, vatTotal, total, costTotal, paid,
        input.ship?.name ?? null, input.ship?.phone ?? null, input.ship?.city ?? null, input.ship?.address ?? null,
        clean(input.note ?? '', 500));
      const orderId = info.lastInsertRowid;

      for (const l of lines) {
        db.prepare(
          `INSERT INTO sales_items (order_id, product_id, qty, unit_price, cost_price, discount, vat_rate, line_total)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(orderId, l.product.id, l.qty, l.price, l.product.cost_price, l.discount, l.vat, l.line);

        if (!l.product.is_service) {
          db.prepare('UPDATE products SET qty = qty - ? WHERE id=?').run(l.qty, l.product.id);
          db.prepare(
            `INSERT INTO stock_movements (product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, user_id)
             VALUES (?,?,'out',-?,?,'sales_orders',?,'بيع',?)`,
          ).run(l.product.id, input.channel === 'wholesale' ? 3 : 1, l.qty, l.product.cost_price, orderId, req.user.id);
        }
      }

      // ---- double entry -------------------------------------------------
      const journal = [];
      if (paid > 0) journal.push({ code: input.channel === 'online' ? ACC.GATEWAY : ACC.CASH, debit: paid });
      if (total - paid > 0) journal.push({ code: ACC.AR, debit: money(total - paid), partner_id: input.partner_id ?? undefined });
      if (vatTotal > 0) journal.push({ code: ACC.VAT, credit: vatTotal });
      journal.push({ code: input.channel === 'wholesale' ? ACC.REV_W : ACC.REV_R, credit: subtotal });
      if (costTotal > 0) {
        journal.push({ code: ACC.COGS, debit: costTotal });
        journal.push({ code: ACC.INV, credit: costTotal });
      }
      postJournal(db, { date: new Date().toISOString().slice(0, 10), kind: 'sale', reference: orderNo,
        memo: `فاتورة بيع ${input.channel}`, lines: journal, source_table: 'sales_orders', source_id: orderId, user_id: req.user.id });

      if (paid > 0) {
        db.prepare(
          `INSERT INTO payments (partner_id, direction, method, amount, reference, order_id, paid_at, user_id)
           VALUES (?,'in',?,?,?,?,datetime('now'),?)`,
        ).run(input.partner_id ?? null, input.method, paid, docId('RCP'), orderId, req.user.id);
      }
      if (input.partner_id) {
        db.prepare('UPDATE partners SET balance = balance + ? WHERE id=?').run(money(total - paid), input.partner_id);
      }
      return orderId;
    });

    const orderId = create();
    audit(db, { user: req.user, action: 'CREATE', entity: 'sales_orders', entityId: orderId, after: { order_no: orderNo, total }, req });
    res.status(201).json({ data: { id: orderId, order_no: orderNo, subtotal, vat: vatTotal, total, paid, due: money(total - paid) } });
  } catch (e) { next(e); }
});

router.get('/', requirePermission('store.manage'), (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const rows = db.prepare(
    `SELECT so.*, p.name AS partner_name, u.full_name AS staff
     FROM sales_orders so LEFT JOIN partners p ON p.id = so.partner_id LEFT JOIN users u ON u.id = so.user_id
     ORDER BY so.id DESC LIMIT ? OFFSET ?`,
  ).all(limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM sales_orders`).get();
  res.json({ data: rows, meta: { page, limit, total } });
});

router.post('/:id/cancel', requirePermission('store.manage'), (req, res, next) => {
  try {
    const order = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'order_not_found' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'already_cancelled' });

    const items = db.prepare('SELECT * FROM sales_items WHERE order_id=?').all(order.id);

    db.transaction(() => {
      for (const it of items) {
        db.prepare('UPDATE products SET qty = qty + ? WHERE id=?').run(it.qty, it.product_id);
        db.prepare(
          `INSERT INTO stock_movements (product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, user_id)
           VALUES (?,1,'return',?,?,'sales_orders',?,'إلغاء فاتورة',?)`,
        ).run(it.product_id, it.qty, it.cost_price, order.id, req.user.id);
      }
      db.prepare(`UPDATE sales_orders SET status='cancelled' WHERE id=?`).run(order.id);
      if (order.partner_id) {
        db.prepare('UPDATE partners SET balance = balance - ? WHERE id=?').run(money(order.total - order.paid), order.partner_id);
      }

      const journalId = db.prepare(
        `SELECT id FROM journals WHERE source_table='sales_orders' AND source_id=? ORDER BY id DESC LIMIT 1`,
      ).get(order.id);
      if (journalId) {
        const lines = db.prepare(
          `SELECT a.code, jl.debit, jl.credit FROM journal_lines jl
           JOIN accounts a ON a.id = jl.account_id WHERE jl.journal_id = ?`,
        ).all(journalId.id);
        postJournal(db, {
          date: new Date().toISOString().slice(0, 10), kind: 'adjust',
          reference: `إلغاء ${order.order_no}`, memo: 'قيد عكسي لإلغاء الفاتورة',
          lines: lines.map((l) => ({ code: l.code, debit: l.credit, credit: l.debit })),
          source_table: 'sales_orders', source_id: order.id, user_id: req.user.id,
        });
      }
    })();

    audit(db, { user: req.user, action: 'CANCEL', entity: 'sales_orders', entityId: order.id, before: order, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
