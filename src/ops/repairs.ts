/* =====================================================================
 *  GLOBAL STORE — Repair workshop module
 *  Ticket lifecycle, technician workload, parts consumption, AI triage.
 * ===================================================================== */
import { q, one, scalar, tx, getDB, type Row } from '../db/db';
import { post, ACC } from '../accounting/engine';
import { audit, adjustStock } from './commerce';
import { round2 } from '../lib/format';

export const FLOW = ['received', 'diagnosing', 'awaiting_parts', 'in_progress', 'testing', 'completed', 'delivered'] as const;
export type TicketStatus = (typeof FLOW)[number];

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const ticketNo = () => `SR-${Date.now().toString(36).toUpperCase().slice(-6)}`;

export interface TicketInput {
  customer_name: string; customer_phone?: string; customer_email?: string;
  device_brand?: string; device_model: string; imei?: string;
  issue_ar?: string; issue_en?: string; priority?: 'low' | 'normal' | 'high' | 'urgent';
  technician_id?: number | null; branch_id?: number; passcode_ok?: boolean;
  est_cost?: number; warranty_days?: number; notes?: string;
}

/* --------------------------------------------------- AI triage model */
/** Rule + statistical model: issue-type base ETA × brand-age × priority. */
const ISSUE_PROFILE: Record<string, { eta: number; confidence: number; risk: 'low' | 'med' | 'high'; parts: string[]; needScreen: boolean }> = {
  screen: { eta: 4, confidence: 0.93, risk: 'low', needScreen: true, parts: ['شاشة كاملة', 'شريط لاصق', 'واقي الكاميرا'] },
  board: { eta: 26, confidence: 0.61, risk: 'high', needScreen: false, parts: ['IC شحن', 'مكثف فلتر', 'شريط لحام'] },
  water: { eta: 48, confidence: 0.55, risk: 'high', needScreen: true, parts: ['تنظيف كحولي', 'شاشة (غالباً)', 'بطارية'] },
  battery: { eta: 3, confidence: 0.96, risk: 'low', needScreen: false, parts: ['بطارية'] },
  audio: { eta: 5, confidence: 0.82, risk: 'med', needScreen: false, parts: ['مكبر صوت', 'فلتر سماعة'] },
  camera: { eta: 6, confidence: 0.85, risk: 'med', needScreen: false, parts: ['كاميرا أمامية', 'فلتر الكاميرا'] },
  port: { eta: 7, confidence: 0.84, risk: 'med', needScreen: false, parts: ['منفذ شحن', 'لوحة سفلية'] },
};

function classifyIssue(text: string): keyof typeof ISSUE_PROFILE {
  const t = (text || '').toLowerCase();
  const rules: [RegExp, keyof typeof ISSUE_PROFILE][] = [
    [/شاش|screen|display|زجاج|لمس/, 'screen'],
    [/ماء|مبلل|water|shor|رطوب/, 'water'],
    [/شحن|charg|power|لا يشغ|طاقة/, 'board'],
    [/بطاري|batter|تفرغ/, 'battery'],
    [/صوت|sound|speaker|mic|سماعة/, 'audio'],
    [/كاميرا|camera/, 'camera'],
    [/منفذ|port/, 'port'],
  ];
  for (const [re, k] of rules) if (re.test(t)) return k;
  return 'board';
}

export function triageTicket(input: TicketInput) {
  const issueKey = classifyIssue(`${input.issue_ar ?? ''} ${input.issue_en ?? ''}`);
  const p = ISSUE_PROFILE[issueKey];
  const prioFactor = { urgent: 0.5, high: 0.75, normal: 1, low: 1.3 }[input.priority ?? 'normal'];
  const eta = Math.round(p.eta * prioFactor);
  const conf = round2(Math.max(0.35, p.confidence - (input.imei ? 0.04 : 0)));
  const brandAge = /iphone|آيفون|galaxy|جالكسي/.test(`${input.device_brand ?? ''}${input.device_model ?? ''}`) ? 1.1 : 0.9;
  const estCost = round2((input.est_cost || 0) * (p.needScreen ? 1.4 : 1) * brandAge);
  const promised = new Date(Date.now() + eta * 3600 * 1000);
  return {
    issueKey, etaHours: eta, confidence: conf, risk: p.risk as 'low' | 'med' | 'high',
    suggestedParts: p.parts, estCost, promisedAt: promised.toISOString().slice(0, 19).replace('T', ' '),
    advice: p.risk === 'high'
      ? 'ننصح العميل بالتوقيع على إقرار مخاطرة قبل بدء الإصلاح، وعدم ضمان الجهازagainst أعطال مستقبلية.'
      : p.risk === 'med'
        ? 'يُفضّل توضيح للعميل أن السعر تقديري حتى بعد التشخيص الكامل.'
        : 'إصلاح روتيني — يمكن التسليم في نفس اليوم.',
  };
}

/* ------------------------------------------------------------ create */
export function createTicket(input: TicketInput, userId?: number | null): number {
  const t = triageTicket(input);
  let id = 0;
  tx(() => {
    const db = getDB();
    db.run(
      `INSERT INTO repair_tickets (ticket_no,customer_name,customer_phone,customer_email,device_brand,device_model,imei,
        issue_ar,issue_en,advice,status,priority,technician_id,branch_id,passcode_ok,est_cost,warranty_days,
        ai_confidence,ai_eta_hours,ai_risk,intake_at,promised_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,'received',?,?,?,?,?,?,?,?,?,?,?)`,
      [ticketNo(), input.customer_name, input.customer_phone ?? null, input.customer_email ?? null,
       input.device_brand ?? null, input.device_model, input.imei ?? null,
       input.issue_ar ?? null, input.issue_en ?? null, t.advice, input.priority ?? 'normal',
       input.technician_id ?? null, input.branch_id ?? 4, input.passcode_ok ? 1 : 0,
       input.est_cost ?? t.estCost, input.warranty_days ?? 30,
       t.confidence, t.etaHours, t.risk, stamp(), t.promisedAt],
    );
    id = scalar<number>('SELECT last_insert_rowid() AS v');
    db.run(`INSERT INTO repair_history (ticket_id,from_status,to_status,note,user_id) VALUES (?,NULL,'received',?,?)`,
      [id, 'استلام الجهاز من العميل', userId ?? null]);
  });
  audit('CREATE', 'repair_ticket', id, null, { device: input.device_model }, userId);
  return id;
}

/* ------------------------------------------------------- transitions */
export function setStatus(id: number, to: TicketStatus, userId?: number | null, note?: string) {
  const t = one<Row>('SELECT * FROM repair_tickets WHERE id=?', [id]);
  if (!t) throw new Error('التذكرة غير موجودة');
  if (t.status === to) return t;
  if (!FLOW.includes(to)) throw new Error('حالة غير صالحة');
  const nowIdx = FLOW.indexOf(t.status as TicketStatus), nextIdx = FLOW.indexOf(to);
  if (nextIdx < nowIdx && to !== 'cancelled' && !['in_progress', 'received'].includes(to)) {
    throw new Error('لا يمكن الرجوع للخلف في مسار التذكرة دون إعادة فتح');
  }
  const patch: Record<string, any> = { status: to };
  if (to === 'completed') patch.completed_at = stamp();
  if (to === 'delivered') {
    patch.delivered_at = stamp();
    patch.completed_at = t.completed_at ?? stamp();
  }
  if (to === 'cancelled') patch.completed_at = stamp();

  tx(() => {
    const db = getDB();
    Object.entries(patch).forEach(([k, v]) => db.run(`UPDATE repair_tickets SET ${k}=? WHERE id=?`, [v, id]));
    db.run(`INSERT INTO repair_history (ticket_id,from_status,to_status,note,user_id) VALUES (?,?,?,?,?)`,
      [id, t.status, to, note ?? null, userId ?? null]);
  });
  audit('STATUS', 'repair_ticket', id, { status: t.status }, { status: to }, userId);
  return one<Row>('SELECT * FROM repair_tickets WHERE id=?', [id]);
}

export function assignTechnician(id: number, techId: number | null, userId?: number | null) {
  tx(() => getDB().run('UPDATE repair_tickets SET technician_id=? WHERE id=?', [techId, id]));
  audit('ASSIGN', 'repair_ticket', id, null, { technician_id: techId }, userId);
}

/* ------------------------------------------------------------- parts */
export function addPart(ticketId: number, p: { product_id?: number; label: string; qty?: number; unit_price?: number; consume?: boolean }, userId?: number | null) {
  const qty = p.qty ?? 1, price = p.unit_price ?? 0;
  let pid = 0;
  tx(() => {
    getDB().run(`INSERT INTO repair_parts (ticket_id,product_id,label,qty,unit_price,source) VALUES (?,?,?,?,?,?)`,
      [ticketId, p.product_id ?? null, p.label, qty, price, p.product_id ? 'stock' : 'supplier']);
    pid = scalar<number>('SELECT last_insert_rowid() AS v');
    const t = one<Row>('SELECT * FROM repair_tickets WHERE id=?', [ticketId]);
    if (t) {
      const parts = round2((t.parts_cost ?? 0) + price * qty);
      getDB().run('UPDATE repair_tickets SET parts_cost=?, final_cost=? WHERE id=?',
        [parts, round2(parts + (t.labor_cost ?? 0)), ticketId]);
    }
  });
  if (p.product_id && p.consume !== false) {
    try { adjustStock({ product_id: p.product_id, qty_delta: -qty, kind: 'out', note: `صرف قطعة — تذكرة صيانة`, warehouse_id: 4, user_id: userId }); }
    catch { /* stock may be insufficient — ticket still recorded for procurement */ }
  }
  audit('PART', 'repair_parts', pid, null, { label: p.label, qty }, userId);
  return pid;
}

export function setCost(ticketId: number, c: { labor_cost?: number; discount?: number; final_cost?: number }, userId?: number | null) {
  const t = one<Row>('SELECT * FROM repair_tickets WHERE id=?', [ticketId]);
  if (!t) throw new Error('التذكرة غير موجودة');
  const labor = c.labor_cost ?? t.labor_cost ?? 0;
  const disc = c.discount ?? t.discount ?? 0;
  const parts = t.parts_cost ?? 0;
  const final = round2(Math.max(0, c.final_cost ?? parts + labor - disc));
  tx(() => getDB().run('UPDATE repair_tickets SET labor_cost=?, discount=?, final_cost=? WHERE id=?', [labor, disc, final, ticketId]));
  audit('COST', 'repair_ticket', ticketId, { final_cost: t.final_cost }, { final_cost: final }, userId);
}

/** Post the repair revenue + parts/labour cost journal when the job is delivered. */
export function settleTicket(ticketId: number, method: 'cash' | 'bank' | 'card' | 'transfer' = 'cash', userId?: number | null) {
  const t = one<Row>('SELECT * FROM repair_tickets WHERE id=?', [ticketId]);
  if (!t) throw new Error('التذكرة غير موجودة');
  if (t.status !== 'completed' && t.status !== 'delivered') throw new Error('أكمل التذكرة قبل التحصيل');
  if (t.status === 'delivered') return true;
  const final = round2(t.final_cost ?? 0);
  if (final <= 0) throw new Error('قيمة التذكرة غير محددة');

  post({
    date: new Date().toISOString().slice(0, 10), kind: 'repair',
    reference: t.ticket_no, memo: `صيانة — ${t.device_model}`,
    lines: [
      { code: method === 'bank' ? ACC.BANK : method === 'card' ? ACC.GATEWAY : ACC.CASH, debit: final },
      { code: ACC.REV_REPAIR, credit: final },
    ],
    source_table: 'repair_tickets', source_id: ticketId, user_id: userId ?? null,
  });
  setStatus(ticketId, 'delivered', userId, 'تم التسليم والتحصيل');
  audit('SETTLE', 'repair_ticket', ticketId, { status: t.status }, { status: 'delivered', final }, userId);
  return true;
}

/* ---------------------------------------------------------- analytics */
export function workshopBoard() {
  const statusCounts = q<Row>(`SELECT status, COUNT(*) AS n, COALESCE(SUM(final_cost),0) AS value FROM repair_tickets GROUP BY status`);
  const open = scalar<number>(`SELECT COUNT(*) AS v FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')`);
  const revenue = scalar<number>(`SELECT COALESCE(SUM(final_cost),0) AS v FROM repair_tickets WHERE status IN ('completed','delivered')`);
  const avg = scalar<number>(`SELECT COALESCE(AVG(final_cost),0) AS v FROM repair_tickets WHERE final_cost>0`);
  const slaBreached = scalar<number>(
    `SELECT COUNT(*) AS v FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled') AND promised_at < datetime('now')`);
  const byBrand = q<Row>(
    `SELECT device_brand AS brand, COUNT(*) AS n, COALESCE(AVG(final_cost),0) AS avg_cost
     FROM repair_tickets GROUP BY device_brand ORDER BY n DESC LIMIT 10`);
  const byIssue = q<Row>(
    `SELECT COALESCE(issue_ar,'أخرى') AS issue, COUNT(*) AS n FROM repair_tickets GROUP BY issue_ar ORDER BY n DESC LIMIT 10`);
  const techLoad = q<Row>(
    `SELECT t.id, t.name, t.specialty, t.max_active, t.rating,
            COUNT(r.id) AS active,
            COALESCE(SUM(CASE WHEN r.status IN ('completed','delivered') THEN r.final_cost ELSE 0 END),0) AS produced
     FROM technicians t LEFT JOIN repair_tickets r ON r.technician_id=t.id AND r.status NOT IN ('delivered','cancelled')
     WHERE t.is_active=1 GROUP BY t.id ORDER BY active DESC`);
  const throughput = q<Row>(
    `SELECT date(completed_at) AS day, COUNT(*) AS n, COALESCE(SUM(final_cost),0) AS value
     FROM repair_tickets WHERE completed_at IS NOT NULL AND completed_at >= date('now','-30 day')
     GROUP BY day ORDER BY day`);
  return { statusCounts, open, revenue: round2(revenue), avgTicket: round2(avg), slaBreached, byBrand, byIssue, techLoad, throughput };
}

export function publicTrack(ticketNoOrPhone: string) {
  return q<Row>(
    `SELECT ticket_no, status, device_brand, device_model, intake_at, promised_at, completed_at, delivered_at,
            ai_eta_hours, ai_risk, advice, warranty_days, final_cost, priority
     FROM repair_tickets WHERE ticket_no=? OR customer_phone=? ORDER BY intake_at DESC LIMIT 5`,
    [ticketNoOrPhone.trim(), ticketNoOrPhone.trim()]);
}
