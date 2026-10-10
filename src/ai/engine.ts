/* =====================================================================
 *  GLOBAL STORE — AI layer
 *  1) Insight engine  : proactive signals (forecast, risk, opportunity)
 *  2) Assistant       : bilingual natural-language → verified analytics
 *  3) Recommender    : restock, pricing, customer, workshop suggestions
 *  Everything runs locally against the live ledger — no hallucinated numbers.
 * ===================================================================== */
import { q, one, scalar, tx, getDB, type Row } from '../db/db';
import { kpis, lowStock } from '../ops/commerce';
import { incomeStatement, balanceSheet, vatReturn, ACC, trialBalance, currentFY } from '../accounting/engine';
import { round2 } from '../lib/format';

/* ======================================================= 1. INSIGHTS */
export interface Insight {
  kind: 'forecast' | 'risk' | 'opportunity' | 'anomaly' | 'summary';
  severity: 'info' | 'warn' | 'critical';
  module: string;
  title_ar: string; title_en: string;
  body_ar: string; body_en: string;
  metric?: number;
  data?: any;
}

const y = new Date().getFullYear();
const yearStart = `${y}-01-01`;
const todayStr = new Date().toISOString().slice(0, 10);
const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const d60 = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
const d365 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

export function buildInsights(): Insight[] {
  const out: Insight[] = [];
  const k30 = kpis(d30, todayStr);
  const k60 = kpis(d60, todayStr);
  const kPrev = (() => {
    const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    return kpis(from, to);
  })();

  /* ---- revenue trend ---- */
  const growth = k30.revenue > 0 ? round2(((k30.revenue - kPrev.revenue) / kPrev.revenue) * 100) : 0;
  out.push({
    kind: 'forecast', severity: growth >= 0 ? 'info' : 'warn', module: 'accounting',
    title_ar: `المبيعات ${growth >= 0 ? 'في نمو' : 'تراجع'} بنسبة ${Math.abs(growth)}%`,
    title_en: `Sales ${growth >= 0 ? 'grew' : 'fell'} ${Math.abs(growth)}%`,
    body_ar: `إيرادات آخر 30 يوماً ${k30.revenue.toLocaleString('en-US')} ر.س مقابل ${kPrev.revenue.toLocaleString('en-US')} ر.س في الفترة السابقة. متوسط آخر 60 يوماً ${Math.round(k60.revenue / 2).toLocaleString('en-US')} ر.س.`,
    body_en: `Last 30 days revenue is ${k30.revenue.toLocaleString('en-US')} SAR vs ${kPrev.revenue.toLocaleString('en-US')} SAR in the prior period. 60-day average ${Math.round(k60.revenue / 2).toLocaleString('en-US')} SAR.`,
    metric: growth, data: { k30, kPrev },
  });

  /* ---- margin ---- */
  if (k30.marginPct > 0 && k30.marginPct < 12) {
    out.push({
      kind: 'risk', severity: 'warn', module: 'accounting',
      title_ar: `هامش ربح منخفض (${k30.marginPct}%)`,
      title_en: `Low gross margin (${k30.marginPct}%)`,
      body_ar: 'هامش الربح الإجمالي أقل من مستوى الكفاءة 12%. راجع أسعار الجملة مقابل تكلفة الشراء، وطبّق أسعار متعددة المستويات.',
      body_en: 'Gross margin is below the 12% health benchmark. Review wholesale pricing versus purchase cost and enforce tiered pricing.',
      metric: k30.marginPct,
    });
  }

  /* ---- receivables concentration ---- */
  const topDebtors = q<Row>(
    `SELECT name, balance, credit_limit FROM partners WHERE kind IN ('customer','both') AND balance > 0
     ORDER BY balance DESC LIMIT 5`);
  const arTotal = k30.arBalance;
  const top5 = round2(topDebtors.reduce((t, r) => t + r.balance, 0));
  if (arTotal > 0 && topDebtors.length) {
    const conc = round2((top5 / arTotal) * 100);
    out.push({
      kind: 'risk', severity: conc > 60 ? 'critical' : 'info', module: 'accounting',
      title_ar: `تركّز الذمم المدينة ${conc}%`,
      title_en: `Receivables concentration ${conc}%`,
      body_ar: `أكبر 5 عملاء تمثل ${top5.toLocaleString('en-US')} ر.س من إجمالي الذمم ${arTotal.toLocaleString('en-US')} ر.س. ${conc > 60 ? 'تركّز مرتفع — راجع حدود الائتمان.' : 'التركّز ضمن النطاق الآمن.'}`,
      body_en: `Top 5 customers hold ${top5.toLocaleString('en-US')} SAR of ${arTotal.toLocaleString('en-US')} SAR total. ${conc > 60 ? 'High concentration — review credit limits.' : 'Within a safe range.'}`,
      metric: conc, data: { topDebtors },
    });
  }

  /* ---- overdue AR ---- */
  const overdue = q<Row>(
    `SELECT p.name, p.phone, so.order_no, so.total - so.paid AS due, date(so.placed_at) AS since,
            CAST(julianday('now') - julianday(so.placed_at) AS INTEGER) AS age
     FROM sales_orders so JOIN partners p ON p.id=so.partner_id
     WHERE so.total - so.paid > 1 AND so.status<>'cancelled' AND so.paid < so.total
     ORDER BY due DESC LIMIT 8`);
  const totalOverdue = round2(overdue.reduce((t, r) => t + r.due, 0));
  if (totalOverdue > 0) {
    const worst = overdue[0];
    out.push({
      kind: 'risk', severity: worst.age > 60 ? 'critical' : 'warn', module: 'accounting',
      title_ar: `${overdue.length} فاتورة متأخرة السداد`,
      title_en: `${overdue.length} overdue invoices`,
      body_ar: `إجمالي المتأخرات ${totalOverdue.toLocaleString('en-US')} ر.س. أقدمها "${worst.name}" بمبلغ ${round2(worst.due).toLocaleString('en-US')} ر.س منذ ${worst.age} يوماً.`,
      body_en: `Total overdue ${totalOverdue.toLocaleString('en-US')} SAR. Oldest is ${worst.name} for ${round2(worst.due).toLocaleString('en-US')} SAR, ${worst.age} days old.`,
      metric: totalOverdue, data: { overdue },
    });
  }

  /* ---- inventory: dead stock ---- */
  const dead = q<Row>(
    `SELECT p.name_ar, p.name_en, p.qty, p.cost_price, ROUND(p.qty*p.cost_price) AS value, c.name_ar AS cat
     FROM products p LEFT JOIN categories c ON c.id=p.category_id
     WHERE p.is_service=0 AND p.qty > 0
       AND p.id NOT IN (SELECT product_id FROM sales_items WHERE order_id IN (SELECT id FROM sales_orders WHERE placed_at >= ?))
     ORDER BY value DESC LIMIT 6`);
  const deadValue = round2(dead.reduce((t, r) => t + (r.value ?? 0), 0));
  if (deadValue > 5000) {
    out.push({
      kind: 'opportunity', severity: 'warn', module: 'inventory',
      title_ar: `مخزون راكد بقيمة ${deadValue.toLocaleString('en-US')} ر.س`,
      title_en: `Dead stock worth ${deadValue.toLocaleString('en-US')} SAR`,
      body_ar: `${dead.length} صنف لم يُبع خلال 6 أشهر. اقترح حزمة تخفيض 10–20% لتحرير رأس المال.`,
      body_en: `${dead.length} SKUs had no sales in 6 months. Consider a 10–20% markdown bundle to free up capital.`,
      metric: deadValue, data: { dead },
    });
  }

  /* ---- restock ---- */
  const low = lowStock().slice(0, 6);
  if (low.length) {
    const need = round2(low.reduce((t, r) => t + Math.max(0, (r.reorder_level * 2) - r.qty) * r.cost_price, 0));
    out.push({
      kind: 'opportunity', severity: 'warn', module: 'inventory',
      title_ar: `${k30.lowStockCount} صنف تحت حد الطلب`,
      title_en: `${k30.lowStockCount} SKUs below reorder level`,
      body_ar: `أبرزها: ${low.slice(0, 3).map((r) => r.name_ar).join('، ')}. تكلفة إعادة التخزين التقديرية ${need.toLocaleString('en-US')} ر.س.`,
      body_en: `Top items: ${low.slice(0, 3).map((r) => r.name_en).join(', ')}. Estimated restock cost ${need.toLocaleString('en-US')} SAR.`,
      metric: need, data: { low },
    });
  }

  /* ---- repair capacity ---- */
  const openTickets = scalar<number>(`SELECT COUNT(*) AS v FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')`);
  const capacity = scalar<number>(`SELECT COALESCE(SUM(max_active),0) AS v FROM technicians WHERE is_active=1`);
  if (capacity && openTickets > capacity * 0.8) {
    out.push({
      kind: 'risk', severity: openTickets > capacity ? 'critical' : 'warn', module: 'repairs',
      title_ar: `الورشة فوق طاقتها (${openTickets}/${capacity})`,
      title_en: `Workshop over capacity (${openTickets}/${capacity})`,
      body_ar: 'عدد التذاكر المفتوحة يقارب أو يتجاوز الطاقة الاستيعابية للفنيين. وزّع التذاكر أو فعّل فنياً إضافياً.',
      body_en: 'Open tickets are at or above technician capacity. Rebalance assignments or add a technician.',
      metric: openTickets, data: { capacity },
    });
  }

  /* ---- VAT anomaly ---- */
  const v = vatReturn(yearStart, todayStr);
  if (v.netPayable > 0 && v.salesBase > 0) {
    const eff = round2((v.netPayable / v.salesBase) * 100);
    if (eff > 12) {
      out.push({
        kind: 'anomaly', severity: 'warn', module: 'accounting',
        title_ar: `معدل ضريبة فعلي ${eff}%`,
        title_en: `Effective VAT rate ${eff}%`,
        body_ar: `المستحق ${v.netPayable.toLocaleString('en-US')} ر.س على مبيعات ${v.salesBase.toLocaleString('en-US')} ر.س. راجع الفواتير المعفاة أو غير المستحقة في المبيعات المسجلة خارج النظام.`,
        body_en: `Payable ${v.netPayable.toLocaleString('en-US')} SAR on sales of ${v.salesBase.toLocaleString('en-US')} SAR. Review exempt or out-of-scope invoices.`,
        metric: eff,
      });
    }
  }

  /* ---- profit forecast ---- */
  const pl = incomeStatement(yearStart, todayStr);
  const dayOfYear = Math.ceil((Date.now() - new Date(yearStart).getTime()) / 864e5);
  const projected = round2((pl.netProfit / Math.max(1, dayOfYear)) * 365);
  out.push({
    kind: 'forecast', severity: 'info', module: 'accounting',
    title_ar: `صافي ربح السنة المتوقع ${projected.toLocaleString('en-US')} ر.س`,
    title_en: `Projected annual net profit ${projected.toLocaleString('en-US')} SAR`,
    body_ar: `المحقق حتى اليوم ${pl.netProfit.toLocaleString('en-US')} ر.س خلال ${dayOfYear} يوماً. الهامش الصافي ${pl.netMarginPct}%.`,
    body_en: `Achieved YTD ${pl.netProfit.toLocaleString('en-US')} SAR over ${dayOfYear} days. Net margin ${pl.netMarginPct}%.`,
    metric: projected, data: { pl, dayOfYear },
  });

  /* ---- customers at risk ---- */
  const churn = q<Row>(
    `SELECT p.name, p.phone, p.segment, MAX(so.placed_at) AS last_order,
            CAST(julianday('now') - julianday(MAX(so.placed_at)) AS INTEGER) AS days_idle,
            COUNT(so.id) AS orders
     FROM partners p JOIN sales_orders so ON so.partner_id=p.id
     WHERE so.status<>'cancelled'
     GROUP BY p.id HAVING days_idle > 75 ORDER BY days_idle DESC LIMIT 6`);
  if (churn.length) {
    out.push({
      kind: 'opportunity', severity: 'info', module: 'sales',
      title_ar: `${churn.length} عميل راكد (>75 يوماً)`,
      title_en: `${churn.length} dormant customers (>75 days)`,
      body_ar: `أبرزهم: ${churn.slice(0, 3).map((c) => `${c.name} (${c.days_idle} يوم)`).join('، ')}. فعّل حملة عروض لاستعادة تعاملهم.`,
      body_en: `Top: ${churn.slice(0, 3).map((c) => `${c.name} (${c.days_idle}d)`).join(', ')}. Launch a win-back offer.`,
      data: { churn },
    });
  }

  return out;
}

export function refreshInsights(): number {
  const ins = buildInsights();
  tx(() => {
    const db = getDB();
    db.run(`DELETE FROM ai_insights WHERE date(created_at) = date('now')`);
    ins.forEach((i) =>
      db.run(
        `INSERT INTO ai_insights (kind,severity,module,title_ar,title_en,body_ar,body_en,metric,data_json)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [i.kind, i.severity, i.module, i.title_ar, i.title_en, i.body_ar, i.body_en, i.metric ?? null, JSON.stringify(i.data ?? {})],
      ));
  });
  return ins.length;
}

/* ==================================================== 2. ASSISTANT */
export interface Answer {
  text_ar: string;
  text_en: string;
  intent: string;
  table?: { columns: { key: string; label_ar: string; label_en: string }[]; rows: any[] };
  kpis?: { label_ar: string; label_en: string; value: string; tone?: 'good' | 'bad' | 'neutral' }[];
  chart?: { title_ar: string; title_en: string; data: { label: string; value: number }[] };
  followups?: { ar: string; en: string }[];
}

/* --- lightweight Arabic/English normaliser --- */
const AR_MONTH_WORDS: Record<string, number> = {
  يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, أبريل: 4, مايو: 5, يونيو: 6,
  يوليو: 7, اغسطس: 8, أغسطس: 8, سبتمبر: 9, اكتوبر: 10, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

function parsePeriod(text: string): { from: string; to: string; label_ar: string; label_en: string } | null {
  const t = text.toLowerCase();
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  for (const [w, m] of Object.entries(AR_MONTH_WORDS)) {
    if (t.includes(w)) {
      const year = /\b(20\d\d)\b/.exec(text)?.[1] ?? String(now.getFullYear());
      return {
        from: `${year}-${String(m).padStart(2, '0')}-01`,
        to: `${year}-${String(m).padStart(2, '0')}-28`,
        label_ar: `${w} ${year}`, label_en: `${w} ${year}`,
      };
    }
  }
  if (/اليوم|today/.test(t)) return { from: iso(now), to: iso(now), label_ar: 'اليوم', label_en: 'Today' };
  if (/امس|أمس|yesterday/.test(t)) {
    const d = new Date(Date.now() - 864e5);
    return { from: iso(d), to: iso(d), label_ar: 'أمس', label_en: 'Yesterday' };
  }
  if (/اسبوع|أسبوع|week/.test(t)) {
    return { from: iso(new Date(Date.now() - 7 * 864e5)), to: iso(now), label_ar: 'آخر 7 أيام', label_en: 'Last 7 days' };
  }
  if (/الشهر الماض|شهر سابق|last month/.test(t)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(d), to: iso(e), label_ar: 'الشهر الماضي', label_en: 'Last month' };
  }
  if (/شهر|month/.test(t)) return { from: iso(new Date(Date.now() - 30 * 864e5)), to: iso(now), label_ar: 'آخر 30 يوماً', label_en: 'Last 30 days' };
  if (/سنه|سنة|year|سنوي|annual/.test(t)) {
    const yy = /\b(20\d\d)\b/.exec(text)?.[1] ?? String(now.getFullYear());
    return { from: `${yy}-01-01`, to: `${yy}-12-31`, label_ar: `سنة ${yy}`, label_en: `Year ${yy}` };
  }
  if (/ربع|r1|q1/.test(t)) return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-03-31`, label_ar: 'الربع الأول', label_en: 'Q1' };
  if (/r2|q2/.test(t)) return { from: `${now.getFullYear()}-04-01`, to: `${now.getFullYear()}-06-30`, label_ar: 'الربع الثاني', label_en: 'Q2' };
  if (/r3|q3/.test(t)) return { from: `${now.getFullYear()}-07-01`, to: `${now.getFullYear()}-09-30`, label_ar: 'الربع الثالث', label_en: 'Q3' };
  if (/r4|q4/.test(t)) return { from: `${now.getFullYear()}-10-01`, to: `${now.getFullYear()}-12-31`, label_ar: 'الربع الرابع', label_en: 'Q4' };
  return null;
}

const moneyFmt = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

export function ask(question: string): Answer {
  const text = (question || '').trim();
  const t = text.toLowerCase();
  const period = parsePeriod(text);
  const from = period?.from ?? d30;
  const to = period?.to ?? todayStr;
  const plabelAr = period?.label_ar ?? 'آخر 30 يوماً';
  const plabelEn = period?.label_en ?? 'Last 30 days';
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  /* ---------- greetings / help ---------- */
  if (has('مرحبا', 'السلام', 'مرحباً', 'hi', 'hello', 'hey', 'هلا')) {
    return {
      intent: 'greeting', text_ar: 'أهلاً بك 👋 أنا مساعد جلوبال ستور. أستطيع تحليل المبيعات والأرباح والذمم والمخزون والصيانة. اسألني أي شيء.',
      text_en: 'Hello! 👋 I am the Global Store assistant. I can analyse sales, profit, receivables, inventory and the workshop. Ask me anything.',
      followups: [
        { ar: 'إجمالي مبيعات الشهر الماضي', en: 'Total sales last month' },
        { ar: 'ما هي المنتجات الأكثر ربحية؟', en: 'Which products are most profitable?' },
        { ar: 'من هم العملاء المتأخرون على السداد؟', en: 'Who has overdue invoices?' },
        { ar: 'كم تبلغ قيمة المخزون؟', en: 'What is the inventory value?' },
      ],
    };
  }

  /* ---------- revenue / sales ---------- */
  if (has('مبيعات', 'مبيع', 'إيرادات', 'ايرادات', 'revenue', 'sales', 'دخل')) {
    const k = kpis(from, to);
    const trend = q<Row>(
      `SELECT date(placed_at) AS day, COALESCE(SUM(total),0) AS v, COUNT(*) AS n
       FROM sales_orders WHERE status<>'cancelled' AND date(placed_at) BETWEEN ? AND ?
       GROUP BY day ORDER BY day`, [from, to]);
    const byChannel = q<Row>(
      `SELECT channel, COUNT(*) AS n, COALESCE(SUM(total),0) AS v, COALESCE(SUM(cost_total),0) AS c
       FROM sales_orders WHERE status<>'cancelled' AND date(placed_at) BETWEEN ? AND ?
       GROUP BY channel ORDER BY v DESC`, [from, to]);
    const chAr: Record<string, string> = { retail: 'تجزئة', wholesale: 'جملة', online: 'أونلاين' };
    return {
      intent: 'revenue',
      text_ar: `إجمالي مبيعات ${plabelAr}: **${moneyFmt(k.revenue)}** من ${k.orders} طلب (${k.customers} عميل). الهامش الإجمالي ${k.marginPct}% والمحصّل نقداً ${moneyFmt(k.revenue - k.receivables)}.`,
      text_en: `Total revenue ${plabelEn}: **${moneyFmt(k.revenue)}** across ${k.orders} orders (${k.customers} customers). Gross margin ${k.marginPct}%, collected ${moneyFmt(k.revenue - k.receivables)}.`,
      kpis: [
        { label_ar: 'الإيرادات', label_en: 'Revenue', value: moneyFmt(k.revenue), tone: 'good' },
        { label_ar: 'الطلبات', label_en: 'Orders', value: String(k.orders) },
        { label_ar: 'الهامش الإجمالي', label_en: 'Gross margin', value: `${k.marginPct}%`, tone: k.marginPct > 12 ? 'good' : 'bad' },
        { label_ar: 'ذمم لم تُحصّل', label_en: 'Uncollected', value: moneyFmt(k.receivables), tone: 'bad' },
      ],
      table: {
        columns: [
          { key: 'channel', label_ar: 'القناة', label_en: 'Channel' },
          { key: 'n', label_ar: 'الطلبات', label_en: 'Orders' },
          { key: 'v', label_ar: 'الإيراد', label_en: 'Revenue' },
          { key: 'm', label_ar: 'الهامش', label_en: 'Margin' },
        ],
        rows: byChannel.map((r) => ({ ...r, channel: chAr[r.channel] ?? r.channel, m: `${r.v ? round2(((r.v - r.c) / r.v) * 100) : 0}%` })),
      },
      chart: {
        title_ar: 'المبيعات اليومية', title_en: 'Daily sales',
        data: trend.map((r) => ({ label: r.day.slice(5), value: round2(r.v) })),
      },
      followups: [
        { ar: 'أفضل 10 منتجات مبيعاً', en: 'Top 10 selling products' },
        { ar: 'صافي الربح في هذه الفترة', en: 'Net profit in this period' },
      ],
    };
  }

  /* ---------- profit ---------- */
  if (has('ربح', 'أرباح', 'خسارة', 'هامش', 'profit', 'margin', 'loss', 'صافي')) {
    const p = incomeStatement(from, to);
    return {
      intent: 'profit',
      text_ar: `صافي الربح ${plabelAr}: **${moneyFmt(p.netProfit)}** بهامش صافي ${p.netMarginPct}%. صافي الإيرادات ${moneyFmt(p.netRevenue)}، تكلفة المبيعات ${moneyFmt(p.totalCogs)}، المصروفات التشغيلية ${moneyFmt(p.totalOpex)}.`,
      text_en: `Net profit ${plabelEn}: **${moneyFmt(p.netProfit)}**, net margin ${p.netMarginPct}%. Net revenue ${moneyFmt(p.netRevenue)}, COGS ${moneyFmt(p.totalCogs)}, opex ${moneyFmt(p.totalOpex)}.`,
      kpis: [
        { label_ar: 'صافي الإيراد', label_en: 'Net revenue', value: moneyFmt(p.netRevenue) },
        { label_ar: 'مجمل الربح', label_en: 'Gross profit', value: moneyFmt(p.gross), tone: 'good' },
        { label_ar: 'المصروفات', label_en: 'Opex', value: moneyFmt(p.totalOpex), tone: 'bad' },
        { label_ar: 'صافي الربح', label_en: 'Net profit', value: moneyFmt(p.netProfit), tone: p.netProfit >= 0 ? 'good' : 'bad' },
      ],
      table: {
        columns: [
          { key: 'name_ar', label_ar: 'البند', label_en: 'Line' },
          { key: 'amount', label_ar: 'المبلغ', label_en: 'Amount' },
        ],
        rows: p.opex.map((o) => ({ ...o, amount: round2(o.amount) })),
      },
      followups: [{ ar: 'قائمة الدخل الكاملة', en: 'Full income statement' }, { ar: 'الميزانية العمومية', en: 'Balance sheet' }],
    };
  }

  /* ---------- products ---------- */
  if (has('منتج', 'منتجات', 'أكثر مبيعا', 'الأكثر', 'product', 'top', 'best', 'sku')) {
    const rows = q<Row>(
      `SELECT p.name_ar, p.name_en, p.sku, SUM(si.qty) AS units, SUM(si.line_total) AS revenue,
              SUM(si.line_total - si.cost_price*si.qty) AS profit, p.qty AS stock
       FROM sales_items si JOIN sales_orders so ON so.id=si.order_id JOIN products p ON p.id=si.product_id
       WHERE so.status<>'cancelled' AND date(so.placed_at) BETWEEN ? AND ?
       GROUP BY p.id ORDER BY revenue DESC LIMIT 10`, [from, to]);
    return {
      intent: 'products',
      text_ar: `أفضل ${rows.length} منتج من حيث الإيراد خلال ${plabelAr}. إجمالي وحدات مباعة: ${rows.reduce((t, r) => t + r.units, 0)}.`,
      text_en: `Top ${rows.length} products by revenue during ${plabelEn}.`,
      table: {
        columns: [
          { key: 'name_ar', label_ar: 'المنتج', label_en: 'Product' },
          { key: 'units', label_ar: 'الوحدات', label_en: 'Units' },
          { key: 'revenue', label_ar: 'الإيراد', label_en: 'Revenue' },
          { key: 'profit', label_ar: 'الربح', label_en: 'Profit' },
          { key: 'stock', label_ar: 'المخزون', label_en: 'Stock' },
        ],
        rows,
      },
      chart: { title_ar: 'أعلى المنتجات', title_en: 'Top products', data: rows.map((r) => ({ label: String(r.name_ar).slice(0, 22), value: round2(r.revenue) })) },
    };
  }

  /* ---------- receivables / customers ---------- */
  if (has('ذمم', 'مديونية', 'متأخر', 'تحصيل', 'receivable', 'overdue', 'debt', 'عميل', 'customer', 'client')) {
    const rows = q<Row>(
      `SELECT p.name, p.phone, p.city, p.credit_limit, p.balance,
              CAST(julianday('now') - julianday(MAX(so.placed_at)) AS INTEGER) AS days_idle
       FROM partners p JOIN sales_orders so ON so.partner_id=p.id
       WHERE p.kind IN ('customer','both') AND p.balance > 0 AND so.status<>'cancelled'
       GROUP BY p.id ORDER BY p.balance DESC LIMIT 10`);
    const total = round2(rows.reduce((t, r) => t + r.balance, 0));
    const overdue = rows.filter((r) => r.days_idle > 45);
    return {
      intent: 'receivables',
      text_ar: `إجمالي الذمم المدينة: **${moneyFmt(total)}** من ${rows.length} عميل. ${overdue.length} عميل تجاوزت مبيعاتهم 45 يوماً بلا سداد — اجمعها بأولوية عالية.`,
      text_en: `Total receivables: **${moneyFmt(total)}** from ${rows.length} customers. ${overdue.length} have no collection for 45+ days — prioritise these.`,
      table: {
        columns: [
          { key: 'name', label_ar: 'العميل', label_en: 'Customer' },
          { key: 'phone', label_ar: 'الجوال', label_en: 'Phone' },
          { key: 'balance', label_ar: 'المستحق', label_en: 'Outstanding' },
          { key: 'credit_limit', label_ar: 'حد الائتمان', label_en: 'Credit limit' },
          { key: 'days_idle', label_ar: 'أيام بلا طلب', label_en: 'Idle days' },
        ],
        rows,
      },
      followups: [{ ar: 'سجل حساب عميل محدد', en: 'Ledger of a specific customer' }, { ar: 'كم نقداً في الصندوق؟', en: 'How much cash on hand?' }],
    };
  }

  /* ---------- inventory ---------- */
  if (has('مخزون', 'مخز', 'مخزونات', 'مخزن', 'inventory', 'stock', 'أصناف', 'نفد')) {
    const low = lowStock().slice(0, 10);
    const total = round2(scalar<number>(`SELECT COALESCE(SUM(qty*cost_price),0) AS v FROM products WHERE is_service=0`));
    const units = scalar<number>(`SELECT COALESCE(SUM(qty),0) AS v FROM products WHERE is_service=0`);
    const skus = scalar<number>(`SELECT COUNT(*) AS v FROM products WHERE is_service=0`);
    return {
      intent: 'inventory',
      text_ar: `قيمة المخزون بالتكلفة: **${moneyFmt(total)}** على ${units.toLocaleString('en-US')} وحدة عبر ${skus} صنف. ${low.length} صنف تحت حد إعادة الطلب.`,
      text_en: `Inventory at cost: **${moneyFmt(total)}** across ${units.toLocaleString('en-US')} units / ${skus} SKUs. ${low.length} SKUs below reorder level.`,
      kpis: [
        { label_ar: 'قيمة المخزون', label_en: 'Inventory value', value: moneyFmt(total) },
        { label_ar: 'عدد الأصناف', label_en: 'SKUs', value: String(skus) },
        { label_ar: 'تحت حد الطلب', label_en: 'Below reorder', value: String(low.length), tone: low.length ? 'bad' : 'good' },
      ],
      table: {
        columns: [
          { key: 'name_ar', label_ar: 'الصنف', label_en: 'Item' },
          { key: 'sku', label_ar: 'الكود', label_en: 'SKU' },
          { key: 'qty', label_ar: 'المتاح', label_en: 'On hand' },
          { key: 'reorder_level', label_ar: 'حد الطلب', label_en: 'Reorder at' },
          { key: 'cost_price', label_ar: 'التكلفة', label_en: 'Cost' },
        ],
        rows: low,
      },
      followups: [{ ar: 'ما هي المنتجات الراكدة؟', en: 'Which products are dead stock?' }],
    };
  }

  /* ---------- repairs ---------- */
  if (has('صيان', 'ورشة', 'تذاكر', 'تذكرة', 'repair', 'workshop', 'technician', 'فني', 'فنيين')) {
    const open = scalar<number>(`SELECT COUNT(*) AS v FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')`);
    const done = scalar<number>(`SELECT COUNT(*) AS v FROM repair_tickets WHERE status IN ('completed','delivered')`);
    const rev = round2(scalar<number>(`SELECT COALESCE(SUM(final_cost),0) AS v FROM repair_tickets WHERE status IN ('completed','delivered')`));
    const avg = round2(rev / Math.max(1, done));
    const rows = q<Row>(
      `SELECT ticket_no, device_model, status, final_cost, intake_at, promised_at, ai_eta_hours
       FROM repair_tickets WHERE status NOT IN ('completed','delivered','cancelled')
       ORDER BY priority='urgent' DESC, intake_at ASC LIMIT 10`);
    return {
      intent: 'repairs',
      text_ar: `الورشة: **${open}** تذكرة مفتوحة و${done} مكتملة بإيراد ${moneyFmt(rev)} (متوسط ${moneyFmt(avg)}/تذكرة).`,
      text_en: `Workshop: **${open}** open tickets, ${done} completed with ${moneyFmt(rev)} revenue (avg ${moneyFmt(avg)}/ticket).`,
      kpis: [
        { label_ar: 'تذاكر مفتوحة', label_en: 'Open tickets', value: String(open), tone: open > 12 ? 'bad' : 'neutral' },
        { label_ar: 'مكتملة', label_en: 'Completed', value: String(done), tone: 'good' },
        { label_ar: 'إيراد الصيانة', label_en: 'Repair revenue', value: moneyFmt(rev), tone: 'good' },
      ],
      table: {
        columns: [
          { key: 'ticket_no', label_ar: 'رقم التذكرة', label_en: 'Ticket' },
          { key: 'device_model', label_ar: 'الجهاز', label_en: 'Device' },
          { key: 'status', label_ar: 'الحالة', label_en: 'Status' },
          { key: 'ai_eta_hours', label_ar: 'ETA (ساعة)', label_en: 'ETA (h)' },
        ],
        rows,
      },
    };
  }

  /* ---------- suppliers ---------- */
  if (has('مورد', 'موردين', 'مشتريات', 'شراء', 'supplier', 'purchase', 'payable', 'دائن')) {
    const rows = q<Row>(
      `SELECT p.name, p.phone, p.balance AS payable, COUNT(po.id) AS orders, COALESCE(SUM(po.total),0) AS total
       FROM partners p JOIN purchase_orders po ON po.partner_id=p.id
       WHERE p.kind IN ('supplier','both') AND po.status<>'cancelled'
       GROUP BY p.id ORDER BY payable ASC LIMIT 10`);
    const total = round2(rows.reduce((t, r) => t + (r.payable < 0 ? -r.payable : 0), 0));
    return {
      intent: 'suppliers',
      text_ar: `إجمالي المستحق للموردين: **${moneyFmt(total)}** عبر ${rows.length} مورد نشط.`,
      text_en: `Total payables to suppliers: **${moneyFmt(total)}** across ${rows.length} active suppliers.`,
      table: {
        columns: [
          { key: 'name', label_ar: 'المورد', label_en: 'Supplier' },
          { key: 'phone', label_ar: 'الجوال', label_en: 'Phone' },
          { key: 'orders', label_ar: 'أوامر الشراء', label_en: 'POs' },
          { key: 'total', label_ar: 'إجمالي المشتريات', label_en: 'Purchased' },
          { key: 'payable', label_ar: 'المستحق', label_en: 'Payable' },
        ],
        rows,
      },
    };
  }

  /* ---------- balance sheet / cash ---------- */
  if (has('ميزانية', 'رصيد', 'أصول', 'خصوم', 'balance sheet', 'cash', 'نقد', 'صندوق', 'بنك', 'bank')) {
    const bs = balanceSheet(to);
    const cash = round2(scalar<number>(`SELECT COALESCE(SUM(debit-credit),0) AS v FROM journal_lines jl
      JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
      JOIN accounts a ON a.id=jl.account_id WHERE a.code IN (?,?,?)`, [ACC.CASH, ACC.BANK, ACC.GATEWAY]));
    return {
      intent: 'balance',
      text_ar: `إجمالي الأصول **${moneyFmt(bs.totalAssets)}** = خصوم ${moneyFmt(bs.totalLiab)} + حقوق ملكية ${moneyFmt(bs.totalEquity)}. النقد المتاح ${moneyFmt(cash)}. ${bs.balanced ? '✅ الميزانية متوازنة.' : '⚠️ يوجد فرق في الميزانية.'}`,
      text_en: `Total assets **${moneyFmt(bs.totalAssets)}** = liabilities ${moneyFmt(bs.totalLiab)} + equity ${moneyFmt(bs.totalEquity)}. Cash position ${moneyFmt(cash)}. ${bs.balanced ? '✅ Balanced.' : '⚠️ Out of balance.'}`,
      kpis: [
        { label_ar: 'النقدية', label_en: 'Cash', value: moneyFmt(cash), tone: 'good' },
        { label_ar: 'المخزون', label_en: 'Inventory', value: moneyFmt(bs.inventory) },
        { label_ar: 'الذمم المدينة', label_en: 'Receivables', value: moneyFmt(bs.currentAssets) },
        { label_ar: 'الذمم الدائنة', label_en: 'Payables', value: moneyFmt(bs.totalLiab), tone: 'bad' },
      ],
    };
  }

  /* ---------- VAT ---------- */
  if (has('ضريب', 'vat', 'قيمة مضافه', 'الزكاة')) {
    const v = vatReturn(from, to);
    return {
      intent: 'vat',
      text_ar: `إقرار ضريبة القيمة المضافة لـ${plabelAr}: المخرجات ${moneyFmt(v.outputVat)}، المدخلات ${moneyFmt(v.inputVat)}، الصافي ${v.netPayable >= 0 ? 'مستحق' : 'مسترد'} ${moneyFmt(Math.abs(v.netPayable))}.`,
      text_en: `VAT return ${plabelEn}: output ${moneyFmt(v.outputVat)}, input ${moneyFmt(v.inputVat)}, net ${v.netPayable >= 0 ? 'payable' : 'refundable'} ${moneyFmt(Math.abs(v.netPayable))}.`,
      kpis: [
        { label_ar: 'ضريبة المخرجات', label_en: 'Output VAT', value: moneyFmt(v.outputVat) },
        { label_ar: 'ضريبة المدخلات', label_en: 'Input VAT', value: moneyFmt(v.inputVat), tone: 'good' },
        { label_ar: 'الصافي', label_en: 'Net', value: moneyFmt(v.netPayable), tone: v.netPayable > 0 ? 'bad' : 'good' },
      ],
    };
  }

  /* ---------- trial balance / integrity ---------- */
  if (has('ميزان', 'دفتر', 'قيود', 'trial', 'ledger', 'journal', 'توازن')) {
    const tb = trialBalance(from, to);
    return {
      intent: 'ledger',
      text_ar: `ميزان المراجعة (${plabelAr}): مجموع المدين ${moneyFmt(tb.totalDebit)} / مجموع الدائن ${moneyFmt(tb.totalCredit)} — ${tb.balanced ? '✅ متوازن' : '⚠️ غير متوازن'}. عدد الحسابات ذات الحركة: ${tb.rows.filter((r) => r.balance !== 0).length}.`,
      text_en: `Trial balance (${plabelEn}): debits ${moneyFmt(tb.totalDebit)} / credits ${moneyFmt(tb.totalCredit)} — ${tb.balanced ? '✅ balanced' : '⚠️ out of balance'}.`,
      table: {
        columns: [
          { key: 'code', label_ar: 'الكود', label_en: 'Code' },
          { key: 'name_ar', label_ar: 'الحساب', label_en: 'Account' },
          { key: 'debit', label_ar: 'مدين', label_en: 'Debit' },
          { key: 'credit', label_ar: 'دائن', label_en: 'Credit' },
        ],
        rows: tb.rows.filter((r) => r.debit || r.credit).slice(0, 15),
      },
    };
  }

  /* ---------- forecast / what-if ---------- */
  if (has('توقع', 'مستقبل', 'سيناريو', 'لو', 'forecast', 'predict', ' expect')) {
    const k = kpis(d30, todayStr);
    const daily = k.revenue / 30;
    return {
      intent: 'forecast',
      text_ar: `متوسط الإيراد اليومي ${moneyFmt(round2(daily))}. بتثبيت المعدل: الشهر القادم ≈ ${moneyFmt(round2(daily * 30))}، والربع القادم ≈ ${moneyFmt(round2(daily * 90))}.`,
      text_en: `Average daily revenue ${moneyFmt(round2(daily))}. Holding the rate: next month ≈ ${moneyFmt(round2(daily * 30))}, next quarter ≈ ${moneyFmt(round2(daily * 90))}.`,
      chart: {
        title_ar: 'توقع 30 يوماً', title_en: '30-day projection',
        data: Array.from({ length: 6 }, (_, i) => ({ label: `W${i + 1}`, value: round2(daily * 7 * (1 + i * 0.03)) })),
      },
    };
  }

  /* ---------- fallback: helpful summary ---------- */
  const k = kpis(from, to);
  const ins = buildInsights().slice(0, 3);
  return {
    intent: 'fallback',
    text_ar: `لم أفهم السؤال بدقة، لذلك هذه صورة سريعة عن ${plabelAr}: الإيرادات ${moneyFmt(k.revenue)} من ${k.orders} طلب، الذمم ${moneyFmt(k.arBalance)}، المخزون ${moneyFmt(k.inventoryValue)}، وتذاكر صيانة مفتوحة ${k.openTickets}.`,
    text_en: `I could not map that question precisely, so here is a snapshot for ${plabelEn}: revenue ${moneyFmt(k.revenue)} across ${k.orders} orders, receivables ${moneyFmt(k.arBalance)}, inventory ${moneyFmt(k.inventoryValue)}, open repair tickets ${k.openTickets}.`,
    kpis: [
      { label_ar: 'الإيرادات', label_en: 'Revenue', value: moneyFmt(k.revenue), tone: 'good' },
      { label_ar: 'الطلبات', label_en: 'Orders', value: String(k.orders) },
      { label_ar: 'الذمم', label_en: 'Receivables', value: moneyFmt(k.arBalance), tone: 'bad' },
      { label_ar: 'المخزون', label_en: 'Inventory', value: moneyFmt(k.inventoryValue) },
    ],
    table: {
      columns: [
        { key: 'title_ar', label_ar: 'رؤى الذكاء الاصطناعي', label_en: 'AI insights' },
        { key: 'body_ar', label_ar: 'التفاصيل', label_en: 'Detail' },
      ],
      rows: ins,
    },
    followups: [
      { ar: 'إجمالي مبيعات الشهر', en: 'Total sales this month' },
      { ar: 'ما هي أهم مخاطر العمل؟', en: 'What are the top business risks?' },
      { ar: 'كم يبلغ صافي الربح؟', en: 'What is the net profit?' },
    ],
  };
}

export function saveMessage(sessionId: string, role: 'user' | 'assistant', content: string, intent?: string, data?: any) {
  tx(() =>
    getDB().run(`INSERT INTO ai_messages (session_id,role,content,intent,data_json) VALUES (?,?,?,?,?)`,
      [sessionId, role, content, intent ?? null, data ? JSON.stringify(data) : null]));
}

export function history(sessionId: string, limit = 40) {
  return q<Row>(`SELECT * FROM ai_messages WHERE session_id=? ORDER BY id DESC LIMIT ?`, [sessionId, limit]).reverse();
}

export function clearHistory(sessionId: string) {
  tx(() => getDB().run(`DELETE FROM ai_messages WHERE session_id=?`, [sessionId]));
}

export function insightsFeed(limit = 30) {
  return q<Row>(`SELECT * FROM ai_insights ORDER BY
    CASE severity WHEN 'critical' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, id DESC LIMIT ?`, [limit]);
}

/* ================================================== 3. RECOMMENDER */
export function restockSuggestions() {
  const rows = q<Row>(
    `SELECT p.id, p.sku, p.name_ar, p.name_en, p.qty, p.reorder_level, p.cost_price, b.name_ar AS brand,
            COALESCE((SELECT SUM(si.qty) FROM sales_items si JOIN sales_orders so ON so.id=si.order_id
                      WHERE si.product_id=p.id AND so.placed_at >= date('now','-60 day')),0) AS sold60
     FROM products p LEFT JOIN brands b ON b.id=p.brand_id
     WHERE p.is_service=0 AND (p.qty <= p.reorder_level OR p.qty <= COALESCE((SELECT SUM(si.qty) FROM sales_items si JOIN sales_orders so ON so.id=si.order_id WHERE si.product_id=p.id AND so.placed_at >= date('now','-60 day')),0)*0.5)
     ORDER BY sold60 DESC LIMIT 25`);
  return rows.map((r) => {
    const daily = round2(r.sold60 / 60);
    const cover = daily > 0 ? Math.floor(r.qty / daily) : 999;
    const suggest = Math.max(r.reorder_level * 2, Math.ceil(daily * 45));
    return { ...r, daily, daysOfCover: cover, suggestQty: suggest, suggestCost: round2(suggest * r.cost_price) };
  });
}

export function profitByProduct(limit = 20) {
  return q<Row>(
    `SELECT p.sku, p.name_ar, p.name_en, p.retail_price, p.cost_price,
            COALESCE(SUM(si.qty),0) AS units, COALESCE(SUM(si.line_total),0) AS revenue,
            COALESCE(SUM(si.line_total - si.cost_price*si.qty),0) AS profit,
            p.qty AS stock
     FROM products p LEFT JOIN sales_items si ON si.product_id=p.id
     LEFT JOIN sales_orders so ON so.id=si.order_id AND so.status<>'cancelled'
     WHERE p.is_service=0
     GROUP BY p.id HAVING revenue > 0 ORDER BY profit DESC LIMIT ?`, [limit])
    .map((r) => ({ ...r, margin: r.revenue ? round2((r.profit / r.revenue) * 100) : 0 }));
}

export function customerSegments() {
  const rows = q<Row>(
    `SELECT p.id, p.name, p.phone, p.city, p.segment, p.balance, p.loyalty_points,
            COUNT(so.id) AS orders, COALESCE(SUM(so.total),0) AS spent, MAX(so.placed_at) AS last_order
     FROM partners p LEFT JOIN sales_orders so ON so.partner_id=p.id AND so.status<>'cancelled'
     WHERE p.kind IN ('customer','both') GROUP BY p.id`);
  const scored = rows.map((r) => {
    const days = r.last_order ? Math.floor((Date.now() - new Date(r.last_order.replace(' ', 'T')).getTime()) / 864e5) : 999;
    const vip = r.spent > 100000 && r.orders >= 10;
    const atRisk = days > 75;
    const champion = r.spent > 50000 && days <= 45;
    const tier = vip ? 'vip' : atRisk ? 'at_risk' : champion ? 'champion' : r.orders > 3 ? 'regular' : 'new';
    return { ...r, days_idle: days, tier };
  });
  const groups = ['vip', 'champion', 'regular', 'new', 'at_risk'] as const;
  return {
    rows: scored,
    groups: groups.map((g) => {
      const m = scored.filter((s) => s.tier === g);
      return { tier: g, count: m.length, revenue: round2(m.reduce((t, s) => t + s.spent, 0)), avgOrder: m.length ? round2(m.reduce((t, s) => t + s.spent, 0) / m.length) : 0 };
    }),
  };
}

export function healthScore() {
  const tb = trialBalance();
  const bs = balanceSheet(todayStr);
  const k = kpis(d30, todayStr);
  const parts = [
    { key: 'balanced', label_ar: 'توازن الدفاتر', label_en: 'Books balanced', score: tb.balanced ? 100 : 0, weight: 0.3 },
    { key: 'liquidity', label_ar: 'السيولة', label_en: 'Liquidity', score: Math.min(100, round2((k.cashPosition / Math.max(1, k.arBalance)) * 100)), weight: 0.2 },
    { key: 'margin', label_ar: 'هامش الربح', label_en: 'Profit margin', score: Math.min(100, round2(k.marginPct * 5)), weight: 0.25 },
    { key: 'collection', label_ar: 'التحصيل', label_en: 'Collections', score: Math.max(0, 100 - round2((k.receivables / Math.max(1, k.revenue)) * 100)), weight: 0.15 },
    { key: 'stock', label_ar: 'كفاءة المخزون', label_en: 'Stock efficiency', score: Math.max(0, 100 - k.lowStockCount), weight: 0.1 },
  ];
  const total = round2(parts.reduce((t, p) => t + p.score * p.weight, 0));
  return { total, parts, balanced: bs.balanced };
}

export function fyInfo() {
  const fy = currentFY();
  return { ...fy, daysElapsed: fy ? Math.ceil((Date.now() - new Date(fy.start).getTime()) / 864e5) : 0, d365 };
}
