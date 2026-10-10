/* =====================================================================
 *  Administration — inventory, partners, purchases, employees, settings
 * ===================================================================== */
import { Router } from 'express';
import { z } from 'zod';
import { db, authenticate } from '../lib/core.js';
import { requirePermission } from '../lib/rbac.js';
import { audit } from '../lib/audit.js';
import { clean, docId, money, pagination } from '../lib/http.js';
import { postJournal } from '../lib/accounting.js';
import { hashPassword } from './auth.js';

export const router = Router();
router.use(authenticate);

/* --------------------------------------------------------------- KPIs */
router.get('/dashboard', requirePermission('admin.dashboard'), (req, res) => {
  const from = clean(req.query.from ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), 10);
  const to = clean(req.query.to ?? new Date().toISOString().slice(0, 10), 10);

  const sales = db.prepare(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(cost_total),0) AS cost,
            COALESCE(SUM(vat_amount),0) AS vat, COALESCE(SUM(total - paid),0) AS receivables
     FROM sales_orders WHERE status <> 'cancelled' AND date(placed_at) BETWEEN ? AND ?`,
  ).get(from, to);

  const repairs = db.prepare(
    `SELECT COUNT(*) AS tickets, COALESCE(SUM(final_cost),0) AS revenue FROM repair_tickets
     WHERE status IN ('completed','delivered') AND date(intake_at) BETWEEN ? AND ?`,
  ).get(from, to);

  const purchases = db.prepare(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS total, COALESCE(SUM(total - paid),0) AS payable
     FROM purchase_orders WHERE status <> 'cancelled' AND date(ordered_at) BETWEEN ? AND ?`,
  ).get(from, to);

  const inventory = db.prepare(
    `SELECT COALESCE(SUM(qty * cost_price),0) AS value,
            SUM(CASE WHEN qty <= reorder_level THEN 1 ELSE 0 END) AS low_count
     FROM products WHERE is_service = 0`,
  ).get();

  const daily = db.prepare(
    `SELECT date(placed_at) AS day, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
     FROM sales_orders WHERE status <> 'cancelled' AND date(placed_at) BETWEEN ? AND ?
     GROUP BY day ORDER BY day`,
  ).all(from, to);

  res.json({
    from, to,
    sales: { ...sales, margin_pct: sales.revenue ? money(((sales.revenue - sales.cost) / sales.revenue) * 100) : 0 },
    repairs, purchases, inventory, daily,
    open_tickets: db.prepare(`SELECT COUNT(*) AS n FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')`).get().n,
  });
});

/* ---------------------------------------------------------- inventory */
router.get('/inventory', requirePermission('admin.inventory.view'), (req, res) => {
  const { limit, offset, page } = pagination(req.query, 50, 500);
  const lowOnly = req.query.low === '1';
  const rows = db.prepare(
    `SELECT p.*, c.name_ar AS category_ar, c.name_en AS category_en, b.name_ar AS brand_ar, b.name_en AS brand_en
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.is_active = 1 ${lowOnly ? 'AND p.qty <= p.reorder_level' : ''}
     ORDER BY p.qty ASC LIMIT ? OFFSET ?`,
  ).all(limit, offset);
  const { total } = db.prepare(
    `SELECT COUNT(*) AS total FROM products WHERE is_active = 1 ${lowOnly ? 'AND qty <= reorder_level' : ''}`,
  ).get();
  res.json({ data: rows, meta: { page, limit, total } });
});

router.post('/inventory/adjust', requirePermission('admin.inventory.write'), (req, res, next) => {
  try {
    const body = z.object({
      product_id: z.number().int().positive(),
      qty_delta: z.number().refine((v) => v !== 0, 'qty_delta cannot be zero'),
      kind: z.enum(['adjust', 'damage', 'in', 'out', 'warranty', 'return']).default('adjust'),
      note: z.string().max(300).optional(),
      warehouse_id: z.number().int().positive().default(1),
    }).parse(req.body);

    const product = db.prepare('SELECT * FROM products WHERE id=?').get(body.product_id);
    if (!product) return res.status(404).json({ error: 'product_not_found' });
    if (product.qty + body.qty_delta < 0) return res.status(409).json({ error: 'insufficient_stock' });

    db.transaction(() => {
      db.prepare('UPDATE products SET qty = qty + ? WHERE id=?').run(body.qty_delta, body.product_id);
      db.prepare(
        `INSERT INTO stock_movements (product_id, warehouse_id, kind, qty, unit_cost, ref_type, note, user_id)
         VALUES (?,?,?,?,?,'adjust',?,?)`,
      ).run(body.product_id, body.warehouse_id, body.kind, body.qty_delta, product.cost_price, clean(body.note ?? 'تسوية مخزون', 300), req.user.id);
    })();

    audit(db, { user: req.user, action: 'STOCK_ADJUST', entity: 'products', entityId: body.product_id,
      before: { qty: product.qty }, after: { qty: product.qty + body.qty_delta }, req });
    res.json({ ok: true, qty: product.qty + body.qty_delta });
  } catch (e) { next(e); }
});

router.get('/inventory/movements', requirePermission('admin.inventory.view'), (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const rows = db.prepare(
    `SELECT sm.*, p.sku, p.name_ar, p.name_en, u.full_name AS staff
     FROM stock_movements sm JOIN products p ON p.id = sm.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     ORDER BY sm.id DESC LIMIT ? OFFSET ?`,
  ).all(limit, offset);
  res.json({ data: rows, meta: { page, limit, total: rows.length } });
});

/* ------------------------------------------------------------ partners */
router.get('/partners', requirePermission('admin.partners.view'), (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const kind = req.query.kind === 'supplier' ? 'supplier' : 'customer';
  const search = clean(req.query.q ?? '', 80);
  const params = [kind];
  let clause = `WHERE p.kind IN (?, 'both')`;
  if (search) { clause += ' AND (p.name LIKE ? OR p.phone LIKE ? OR p.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = db.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM sales_orders so WHERE so.partner_id=p.id) AS orders,
            (SELECT COALESCE(SUM(so.total),0) FROM sales_orders so WHERE so.partner_id=p.id) AS volume
     FROM partners p ${clause} ORDER BY ABS(p.balance) DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM partners p ${clause}`).get(...params);
  res.json({ data: rows, meta: { page, limit, total } });
});

router.post('/partners', requirePermission('admin.partners.write'), (req, res, next) => {
  try {
    const body = z.object({
      kind: z.enum(['customer', 'supplier', 'both']).default('customer'),
      name: z.string().min(2).max(120),
      phone: z.string().max(20).optional(),
      email: z.string().email().max(120).optional(),
      city: z.string().max(80).optional(),
      address: z.string().max(300).optional(),
      tax_number: z.string().max(40).optional(),
      credit_limit: z.number().min(0).default(0),
      payment_terms: z.number().int().min(0).max(365).default(0),
    }).parse(req.body);

    const code = `${body.kind === 'supplier' ? 'S' : 'C'}-${docId('X').slice(-6)}`;
    const info = db.prepare(
      `INSERT INTO partners (code, kind, name, email, phone, city, address, tax_number,
         credit_limit, payment_terms, segment, balance, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0,1)`,
    ).run(code, body.kind, clean(body.name, 120), body.email ?? null, body.phone ?? null,
      body.city ?? null, body.address ?? null, body.tax_number ?? null,
      body.credit_limit, body.payment_terms, body.kind === 'supplier' ? 'retail' : 'retail');

    audit(db, { user: req.user, action: 'CREATE', entity: 'partners', entityId: info.lastInsertRowid, after: body, req });
    res.status(201).json({ data: { id: info.lastInsertRowid, code } });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------ payments */
router.post('/payments', requirePermission('accounting.post'), (req, res, next) => {
  try {
    const body = z.object({
      partner_id: z.number().int().positive(),
      direction: z.enum(['in', 'out']),
      amount: z.number().positive(),
      method: z.enum(['cash', 'bank', 'card', 'transfer', 'cheque']).default('bank'),
      reference: z.string().max(80).optional(),
      order_id: z.number().int().positive().nullable().optional(),
    }).parse(req.body);

    const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(body.partner_id);
    if (!partner) return res.status(404).json({ error: 'partner_not_found' });
    const amount = money(body.amount);

    db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO payments (partner_id, direction, method, amount, reference, order_id, paid_at, user_id)
         VALUES (?,?,?,?,?,?,datetime('now'),?)`,
      ).run(body.partner_id, body.direction, body.method, amount, body.reference ?? docId('TRX'), body.order_id ?? null, req.user.id);
      const paymentId = info.lastInsertRowid;

      const delta = body.direction === 'in' ? -amount : amount;
      db.prepare('UPDATE partners SET balance = balance + ? WHERE id=?').run(delta, body.partner_id);
      if (body.order_id && body.direction === 'in') {
        db.prepare('UPDATE sales_orders SET paid = MIN(total, paid + ?) WHERE id=?').run(amount, body.order_id);
      } else if (body.order_id) {
        db.prepare('UPDATE purchase_orders SET paid = MIN(total, paid + ?) WHERE id=?').run(amount, body.order_id);
      }

      postJournal(db, {
        date: new Date().toISOString().slice(0, 10), kind: 'payment',
        reference: body.reference ?? '', memo: body.direction === 'in' ? 'تحصيل من عميل' : 'سداد لمورد',
        lines: body.direction === 'in'
          ? [{ code: body.method === 'bank' ? '1110' : '1100', debit: amount }, { code: '1200', credit: amount, partner_id: body.partner_id }]
          : [{ code: '2100', debit: amount }, { code: '1110', credit: amount, partner_id: body.partner_id }],
        source_table: 'payments', source_id: paymentId, user_id: req.user.id,
      });
    })();

    audit(db, { user: req.user, action: 'PAYMENT', entity: 'payments', after: body, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

/* ----------------------------------------------------------- employees */
router.get('/users', requirePermission('admin.employees.view'), (_req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.username, u.full_name, u.email, u.role, u.branch_id, u.status,
            u.last_login_at, u.failed_logins, b.name_ar AS branch_ar, b.name_en AS branch_en
     FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`,
  ).all();
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY module, code').all();
  const grants = db.prepare('SELECT role, permission_code FROM role_permissions').all();
  res.json({ users, permissions, grants });
});

router.patch('/users/:id/password', requirePermission('admin.employees.write'), (req, res, next) => {
  try {
    const body = z.object({
      password: z.string().min(8).max(256),
      role: z.enum(['admin', 'manager', 'accountant', 'technician', 'sales', 'viewer']).optional(),
    }).parse(req.body);
    const id = Number(req.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    if (user.id === req.user.id && body.role && body.role !== 'admin') {
      return res.status(422).json({ error: 'cannot_demote_self' });
    }

    const { hash, salt } = hashPassword(body.password);
    db.prepare('UPDATE users SET pass_hash=?, pass_salt=?, role=COALESCE(?, role), failed_logins=0, locked_until=NULL WHERE id=?')
      .run(hash, salt, body.role ?? null, id);
    db.prepare('UPDATE sessions SET revoked=1 WHERE user_id=?').run(id);

    audit(db, { user: req.user, action: 'PASSWORD_RESET', entity: 'users', entityId: id, after: { role: body.role ?? user.role }, req });
    res.json({ ok: true, sessions_revoked: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------- audit */
router.get('/audit', requirePermission('admin.employees.view'), (req, res) => {
  const { limit, offset, page } = pagination(req.query, 50);
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM audit_log').get();
  res.json({ data: rows, meta: { page, limit, total } });
});

/* ---------------------------------------------------------- company */
router.patch('/company', requirePermission('admin.employees.write'), (req, res, next) => {
  try {
    const body = z.object({
      name_ar: z.string().max(120).optional(),
      name_en: z.string().max(120).optional(),
      phone: z.string().max(30).optional(),
      email: z.string().email().max(120).optional(),
      vat_number: z.string().max(40).optional(),
      cr_number: z.string().max(40).optional(),
      address_ar: z.string().max(300).optional(),
      address_en: z.string().max(300).optional(),
      vat_rate: z.number().min(0).max(0.5).optional(),
      currency: z.string().length(3).optional(),
    }).parse(req.body);

    const sets = Object.keys(body).map((k) => `${k}=?`).join(',');
    db.prepare(`UPDATE company SET ${sets} WHERE id=1`).run(...Object.values(body));
    audit(db, { user: req.user, action: 'UPDATE', entity: 'company', entityId: 1, after: body, req });
    res.json({ data: db.prepare('SELECT * FROM company WHERE id=1').get() });
  } catch (e) { next(e); }
});
