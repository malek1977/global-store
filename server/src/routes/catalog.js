/* =====================================================================
 *  Public catalogue — bilingual product browsing
 * ===================================================================== */
import { Router } from 'express';
import { db } from '../lib/core.js';
import { clean, pagination } from '../lib/http.js';

export const router = Router();

const SORT = {
  newest: 'p.id DESC',
  price_asc: 'p.retail_price ASC',
  price_desc: 'p.retail_price DESC',
  name: 'p.name_en ASC',
  best: 'sold DESC',
};

router.get('/categories', (_req, res) => {
  res.json(db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.is_active=1) AS item_count
     FROM categories c ORDER BY c.sort`,
  ).all());
});

router.get('/brands', (_req, res) => {
  res.json(db.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id AND p.is_active=1) AS item_count
     FROM brands b ORDER BY item_count DESC`,
  ).all());
});

router.get('/products', (req, res) => {
  const { limit, page, offset } = pagination(req.query);
  const where = ['p.is_active = 1'];
  const params = [];

  const cat = clean(req.query.category ?? '', 64);
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  const brand = clean(req.query.brand ?? '', 64);
  if (brand) { where.push('b.slug = ?'); params.push(brand); }
  const condition = clean(req.query.condition ?? '', 24);
  if (condition) { where.push('p.condition = ?'); params.push(condition); }
  const search = clean(req.query.q ?? '', 80);
  if (search) {
    where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const maxPrice = Number(req.query.max_price ?? 0);
  if (maxPrice > 0) { where.push('p.retail_price <= ?'); params.push(maxPrice); }

  const clause = where.join(' AND ');
  const order = SORT[req.query.sort] ?? SORT.best;
  const base = `FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id`;

  const rows = db.prepare(
    `SELECT p.id, p.sku, p.barcode, p.name_ar, p.name_en, p.desc_ar, p.desc_en,
            p.retail_price, p.wholesale_price, p.qty, p.reorder_level, p.condition,
            p.warranty_months, p.image, p.is_service,
            c.name_ar AS category_ar, c.name_en AS category_en, c.slug AS category_slug,
            b.name_ar AS brand_ar, b.name_en AS brand_en, b.slug AS brand_slug,
            COALESCE((SELECT SUM(si.qty) FROM sales_items si JOIN sales_orders so ON so.id = si.order_id
                      WHERE si.product_id = p.id AND so.status <> 'cancelled'), 0) AS sold
     ${base} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);

  const { total } = db.prepare(`SELECT COUNT(*) AS total ${base} WHERE ${clause}`).get(...params);

  res.json({ data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/products/:id', (req, res) => {
  const product = db.prepare(
    `SELECT p.*, c.name_ar AS category_ar, c.name_en AS category_en, c.slug AS category_slug,
            b.name_ar AS brand_ar, b.name_en AS brand_en, b.slug AS brand_slug
     FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
     WHERE p.id = ? AND p.is_active = 1`,
  ).get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'product_not_found' });

  const tiers = db.prepare(
    'SELECT tier, min_qty, price FROM price_lists WHERE product_id=? ORDER BY tier, min_qty',
  ).all(product.id);
  const related = db.prepare(
    `SELECT id, sku, name_ar, name_en, retail_price, qty FROM products
     WHERE category_id = ? AND id <> ? AND is_active = 1 LIMIT 4`,
  ).all(product.category_id, product.id);

  res.json({ data: { ...product, price_lists: tiers, related } });
});

/** Public order lookup — requires order number AND matching phone (no enumeration). */
router.get('/orders/track', (req, res) => {
  const orderNo = clean(req.query.order_no ?? '', 32);
  const phone = clean(req.query.phone ?? '', 20).replace(/\D/g, '');
  if (!orderNo || phone.length < 10) return res.status(400).json({ error: 'order_no_and_phone_required' });

  const order = db.prepare(
    `SELECT so.id, so.order_no, so.status, so.total, so.paid, so.placed_at, so.delivered_at,
            so.ship_name, so.ship_city, so.note
     FROM sales_orders so
     WHERE so.order_no = ? AND REPLACE(REPLACE(REPLACE(so.ship_phone,' ',''),'-',''),'+','') = ?
       AND so.status <> 'cancelled'`,
  ).get(orderNo, phone);
  if (!order) return res.status(404).json({ error: 'not_found' });

  const items = db.prepare(
    `SELECT si.qty, si.unit_price, si.line_total, p.name_ar, p.name_en, p.sku
     FROM sales_items si JOIN products p ON p.id = si.product_id WHERE si.order_id = ?`,
  ).all(order.id);

  res.json({ data: { ...order, items } });
});

/** Public repair ticket lookup — ticket number AND phone. */
router.get('/repairs/track', (req, res) => {
  const ticketNo = clean(req.query.ticket_no ?? '', 32);
  const phone = clean(req.query.phone ?? '', 20).replace(/\D/g, '');
  if (!ticketNo || phone.length < 10) return res.status(400).json({ error: 'ticket_and_phone_required' });

  const rows = db.prepare(
    `SELECT ticket_no, status, device_brand, device_model, intake_at, promised_at,
            completed_at, delivered_at, ai_eta_hours, warranty_days, final_cost, priority
     FROM repair_tickets
     WHERE ticket_no = ? AND REPLACE(REPLACE(customer_phone,' ',''),'-','') = ?`,
  ).all(ticketNo, phone);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json({ data: rows });
});

router.get('/company', (_req, res) => {
  res.json(db.prepare('SELECT * FROM company WHERE id = 1').get());
});
