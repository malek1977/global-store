/* =====================================================================
 *  Repair workshop — tickets with AI triage, workflow and settlement
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

export const FLOW = ['received', 'diagnosing', 'awaiting_parts', 'in_progress', 'testing', 'completed', 'delivered'];

const PROFILE = {
  screen: { eta: 4, confidence: 0.93, risk: 'low', parts: ['شاشة كاملة', 'شريط لاصق', 'واقي الكاميرا'] },
  board: { eta: 26, confidence: 0.61, risk: 'high', parts: ['IC شحن', 'مكثف فلتر', 'شريط لحام'] },
  water: { eta: 48, confidence: 0.55, risk: 'high', parts: ['تنظيف كحولي', 'شاشة (غالباً)', 'بطارية'] },
  battery: { eta: 3, confidence: 0.96, risk: 'low', parts: ['بطارية'] },
  audio: { eta: 5, confidence: 0.82, risk: 'med', parts: ['مكبر صوت', 'فلتر سماعة'] },
  camera: { eta: 6, confidence: 0.85, risk: 'med', parts: ['كاميرا أمامية', 'فلتر الكاميرا'] },
  port: { eta: 7, confidence: 0.84, risk: 'med', parts: ['منفذ شحن', 'لوحة سفلية'] },
};

export function classify(text) {
  const t = String(text || '').toLowerCase();
  const rules = [[/شاش|screen|display|زجاج|لمس/, 'screen'], [/ماء|مبلل|water|shor|رطوب/, 'water'],
    [/شحن|charg|power|لا يشغ|طاقة/, 'board'], [/بطاري|batter|تفرغ/, 'battery'],
    [/صوت|sound|speaker|mic|سماعة/, 'audio'], [/كاميرا|camera/, 'camera'], [/منفذ|port/, 'port']];
  for (const [re, k] of rules) if (re.test(t)) return k;
  return 'board';
}

export function triage({ issue, priority = 'normal', imei, estimate = 0, brand = '', model = '' }) {
  const key = classify(issue);
  const p = PROFILE[key];
  const factor = { urgent: 0.5, high: 0.75, normal: 1, low: 1.3 }[priority] ?? 1;
  const eta = Math.round(p.eta * factor);
  const brandFactor = /iphone|آيفون|galaxy|جالكسي/i.test(`${brand} ${model}`) ? 1.1 : 0.9;
  const promisedAt = new Date(Date.now() + eta * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  return {
    issue_key: key,
    eta_hours: eta,
    confidence: money(Math.max(0.35, p.confidence - (imei ? 0.04 : 0))),
    risk: p.risk,
    suggested_parts: p.parts,
    est_cost: money(estimate * (key === 'screen' ? 1.4 : 1) * brandFactor),
    promised_at: promisedAt,
    advice: p.risk === 'high'
      ? 'ننصح العميل بالتوقيع على إقرار مخاطرة قبل بدء الإصلاح، وعدم ضمان الجهاز ضد أعطال مستقبلية.'
      : p.risk === 'med'
        ? 'السعر تقديري حتى بعد التشخيص الكامل.'
        : 'إصلاح روتيني — يمكن التسليم في نفس اليوم.',
  };
}

const ticketSchema = z.object({
  customer_name: z.string().min(2).max(120),
  customer_phone: z.string().min(9).max(20).optional(),
  customer_email: z.string().email().max(120).optional(),
  device_brand: z.string().max(60).optional(),
  device_model: z.string().min(1).max(80),
  imei: z.string().max(20).optional(),
  issue: z.string().min(5).max(2000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  technician_id: z.number().int().positive().nullable().optional(),
  passcode_ok: z.boolean().default(false),
  est_cost: z.number().min(0).default(0),
  warranty_days: z.number().int().min(0).max(365).default(30),
  branch_id: z.number().int().positive().default(4),
});

router.get('/', requirePermission('repairs.view'), (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const where = ['1=1']; const params = [];
  if (req.query.status) { where.push('rt.status = ?'); params.push(clean(req.query.status, 24)); }
  if (req.query.open === '1') where.push(`rt.status NOT IN ('delivered','cancelled')`);
  const rows = db.prepare(
    `SELECT rt.*, te.name AS technician FROM repair_tickets rt
     LEFT JOIN technicians te ON te.id = rt.technician_id
     WHERE ${where.join(' AND ')} ORDER BY rt.id DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM repair_tickets`).get();
  res.json({ data: rows, meta: { page, limit, total } });
});

/** Public booking — no authentication required, heavy rate limits apply. */
router.post('/tickets', (req, res, next) => {
  try {
    const input = ticketSchema.parse(req.body);
    const t = triage({ issue: input.issue, priority: input.priority, imei: input.imei, estimate: input.est_cost, brand: input.device_brand, model: input.device_model });
    const ticketNo = docId('SR');

    const id = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO repair_tickets (ticket_no, customer_name, customer_phone, customer_email,
           device_brand, device_model, imei, issue_ar, issue_en, advice, status, priority,
           technician_id, branch_id, passcode_ok, est_cost, warranty_days,
           ai_confidence, ai_eta_hours, ai_risk, intake_at, promised_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'received',?,?,?,?,?,?,?,?,?,datetime('now'),?)`,
      ).run(ticketNo, clean(input.customer_name, 120), input.customer_phone ?? null, input.customer_email ?? null,
        input.device_brand ?? null, clean(input.device_model, 80), input.imei ?? null,
        clean(input.issue, 2000), clean(input.issue, 2000), t.advice, input.priority,
        input.technician_id ?? null, input.branch_id, input.passcode_ok ? 1 : 0,
        input.est_cost || t.est_cost, input.warranty_days, t.confidence, t.eta_hours, t.risk, t.promised_at);
      const ticketId = info.lastInsertRowid;
      db.prepare(`INSERT INTO repair_history (ticket_id, from_status, to_status, note, user_id) VALUES (?,NULL,'received','استلام الجهاز من العميل',?)`)
        .run(ticketId, req.user?.id ?? null);
      return ticketId;
    })();

    audit(db, { user: req.user, action: 'CREATE', entity: 'repair_tickets', entityId: id, after: { ticket_no: ticketNo }, req });
    res.status(201).json({ data: { id, ticket_no: ticketNo, ...t } });
  } catch (e) { next(e); }
});

/** AI triage preview without creating a ticket. */
router.post('/triage', (req, res, next) => {
  try {
    const input = z.object({
      issue: z.string().min(2).max(2000),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
      imei: z.string().max(20).optional(),
      est_cost: z.number().min(0).default(0),
      device_brand: z.string().max(60).optional(),
      device_model: z.string().max(80).optional(),
    }).parse(req.body);
    res.json({ data: triage(input) });
  } catch (e) { next(e); }
});

router.patch('/:id/status', requirePermission('repairs.write'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const to = z.enum(FLOW).parse(req.body.status);
    const ticket = db.prepare('SELECT * FROM repair_tickets WHERE id=?').get(id);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    if (ticket.status === to) return res.json({ data: ticket });

    const patch = { status: to };
    if (to === 'completed') patch.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (to === 'delivered') {
      patch.delivered_at = patch.completed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    db.transaction(() => {
      db.prepare(
        `UPDATE repair_tickets SET status=?, completed_at=COALESCE(?, completed_at), delivered_at=COALESCE(?, delivered_at) WHERE id=?`,
      ).run(to, patch.completed_at ?? null, patch.delivered_at ?? null, id);
      db.prepare(`INSERT INTO repair_history (ticket_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)`)
        .run(id, ticket.status, to, clean(req.body.note ?? '', 300) || null, req.user.id);
    })();
    audit(db, { user: req.user, action: 'STATUS', entity: 'repair_tickets', entityId: id, before: { status: ticket.status }, after: { status: to }, req });
    res.json({ data: db.prepare('SELECT * FROM repair_tickets WHERE id=?').get(id) });
  } catch (e) { next(e); }
});

router.post('/:id/settle', requirePermission('repairs.write'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = db.prepare('SELECT * FROM repair_tickets WHERE id=?').get(id);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });
    if (ticket.status !== 'completed') return res.status(422).json({ error: 'ticket_not_completed' });
    const final = money(ticket.final_cost);
    if (final <= 0) return res.status(422).json({ error: 'final_cost_not_set' });

    const method = z.enum(['cash', 'bank', 'card']).parse(req.body.method ?? 'cash');
    db.transaction(() => {
      postJournal(db, {
        date: new Date().toISOString().slice(0, 10), kind: 'repair', reference: ticket.ticket_no,
        memo: `صيانة — ${ticket.device_model}`,
        lines: [
          { code: method === 'bank' ? '1110' : method === 'card' ? '1120' : '1100', debit: final },
          { code: '4400', credit: final },
        ],
        source_table: 'repair_tickets', source_id: id, user_id: req.user.id,
      });
      db.prepare(`UPDATE repair_tickets SET status='delivered', delivered_at=datetime('now') WHERE id=?`).run(id);
      db.prepare(`INSERT INTO repair_history (ticket_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)`)
        .run(id, 'completed', 'delivered', 'تم التسليم والتحصيل', req.user.id);
    })();
    audit(db, { user: req.user, action: 'SETTLE', entity: 'repair_tickets', entityId: id, after: { final }, req });
    res.json({ ok: true, collected: final });
  } catch (e) { next(e); }
});

router.post('/:id/parts', requirePermission('repairs.write'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({
      product_id: z.number().int().positive().nullable().optional(),
      label: z.string().min(2).max(120),
      qty: z.number().positive().max(50).default(1),
      unit_price: z.number().min(0).default(0),
      consume: z.boolean().default(true),
    }).parse(req.body);

    const ticket = db.prepare('SELECT * FROM repair_tickets WHERE id=?').get(id);
    if (!ticket) return res.status(404).json({ error: 'ticket_not_found' });

    db.transaction(() => {
      db.prepare(`INSERT INTO repair_parts (ticket_id, product_id, label, qty, unit_price, source) VALUES (?,?,?,?,?,?)`)
        .run(id, body.product_id ?? null, clean(body.label, 120), body.qty, body.unit_price, body.product_id ? 'stock' : 'supplier');
      if (body.product_id && body.consume) {
        const p = db.prepare('SELECT qty FROM products WHERE id=?').get(body.product_id);
        if (!p || p.qty < body.qty) throw Object.assign(new Error('insufficient_stock'), { status: 409 });
        db.prepare('UPDATE products SET qty = qty - ? WHERE id=?').run(body.qty, body.product_id);
        db.prepare(
          `INSERT INTO stock_movements (product_id, warehouse_id, kind, qty, unit_cost, ref_type, ref_id, note, user_id)
           VALUES (?,4,'out',-1,?,'repair_tickets',?,'صرف قطعة غيار',?)`,
        ).run(body.product_id, money(body.unit_price), id, req.user.id);
      }
      const partsCost = money((ticket.parts_cost ?? 0) + body.unit_price * body.qty);
      db.prepare('UPDATE repair_tickets SET parts_cost=?, final_cost=? WHERE id=?')
        .run(partsCost, money(partsCost + (ticket.labor_cost ?? 0)), id);
    })();
    audit(db, { user: req.user, action: 'PART', entity: 'repair_parts', after: body, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/board/stats', requirePermission('repairs.view'), (_req, res) => {
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n, COALESCE(SUM(final_cost),0) AS value FROM repair_tickets GROUP BY status').all();
  const workload = db.prepare(
    `SELECT t.id, t.name, t.specialty, t.max_active, t.rating,
            COUNT(r.id) AS active
     FROM technicians t LEFT JOIN repair_tickets r ON r.technician_id = t.id
       AND r.status NOT IN ('delivered','cancelled')
     WHERE t.is_active = 1 GROUP BY t.id`,
  ).all();
  const open = byStatus.filter((s) => !['delivered', 'cancelled'].includes(s.status)).reduce((n, s) => n + s.n, 0);
  res.json({ by_status: byStatus, workload, open });
});
