/* =====================================================================
 *  Administration — executive dashboard
 * ===================================================================== */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, ShoppingBag, Users, Package, Wallet, Receipt, Wrench, AlertTriangle,
  Sparkles, ArrowUpRight, ArrowDownRight, RefreshCw, Boxes, Landmark, HandCoins,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import { Badge, Button, Card, SectionTitle, StatCard, Progress, EmptyState, Tabs, StatusPill } from '../../ui/primitives';
import { money, num, pct, fmtDateTime } from '../../lib/format';
import { kpis } from '../../ops/commerce';
import { workshopBoard } from '../../ops/repairs';
import { healthScore, refreshInsights, insightsFeed } from '../../ai/engine';
import { RequireAuth } from '../../App';

const PERIODS = [
  { id: 'today', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
  { id: 'quarter', days: 90 },
  { id: 'year', days: 365 },
];

export default function Dashboard() {
  const { t, lang } = useI18n();
  const [pIdx, setPIdx] = useState(2);
  const [tab, setTab] = useState<'overview' | 'workshop'>('overview');

  const to = new Date().toISOString().slice(0, 10);
  const from = useMemo(() => {
    const d = new Date(Date.now() - PERIODS[pIdx].days * 864e5);
    return d.toISOString().slice(0, 10);
  }, [pIdx]);

  const k = useQuery(() => kpis(from, to), [from, to]);
  const wb = useQuery(() => workshopBoard(), [pIdx]);
  const hs = useQuery(() => healthScore(), [pIdx]);
  const insights = useQuery(() => insightsFeed(8), [pIdx]);

  const daily = useQuery(() => q<Row>(
    `SELECT date(placed_at) AS day, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
     FROM sales_orders WHERE status<>'cancelled' AND date(placed_at) BETWEEN ? AND ?
     GROUP BY day ORDER BY day`, [from, to]), [from, to]);

  const channel = useQuery(() => q<Row>(
    `SELECT channel, COALESCE(SUM(total),0) AS v FROM sales_orders
     WHERE status<>'cancelled' AND date(placed_at) BETWEEN ? AND ? GROUP BY channel`, [from, to]), [from, to]);

  const topProducts = useQuery(() => q<Row>(
    `SELECT p.name_ar, p.name_en, SUM(si.qty) AS units, SUM(si.line_total) AS revenue
     FROM sales_items si JOIN sales_orders so ON so.id=si.order_id JOIN products p ON p.id=si.product_id
     WHERE so.status<>'cancelled' AND date(so.placed_at) BETWEEN ? AND ?
     GROUP BY p.id ORDER BY revenue DESC LIMIT 6`, [from, to]), [from, to]);

  const recent = useQuery(() => q<Row>(
    `SELECT so.*, p.name AS customer, u.full_name AS staff FROM sales_orders so
     LEFT JOIN partners p ON p.id=so.partner_id LEFT JOIN users u ON u.id=so.user_id
     ORDER BY so.id DESC LIMIT 8`), [pIdx]);

  const overdue = useQuery(() => q<Row>(
    `SELECT so.order_no, so.total - so.paid AS due, so.placed_at, p.name, p.phone,
            CAST(julianday('now') - julianday(so.placed_at) AS INTEGER) AS age
     FROM sales_orders so JOIN partners p ON p.id=so.partner_id
     WHERE so.paid < so.total AND so.status<>'cancelled'
     ORDER BY due DESC LIMIT 6`), [pIdx]);

  const COLORS = ['#F26722', '#7C5CFF', '#0FA898', '#38BDF8', '#F59E0B'];
  const chAr: Record<string, string> = { retail: 'تجزئة', wholesale: 'جملة', online: 'أونلاين' };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={PERIODS.map((p) => ({ id: String(p.days), label: t(`dash.${p.id}`) }))}
          value={String(PERIODS[pIdx].days)} onChange={(v) => setPIdx(PERIODS.findIndex((p) => String(p.days) === v))} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => refreshInsights()}>
            {t('ai.refresh')}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="stat-grid">
        <StatCard label={t('dash.revenue')} value={money(k.revenue, 'SAR', lang)} tone="brand"
          icon={<Wallet size={19} />} delta={k.marginPct} sub={t('acc.gross')} />
        <StatCard label={t('dash.orders')} value={num(k.orders, lang)} tone="info"
          icon={<ShoppingBag size={19} />} sub={`${k.customers} ${lang === 'ar' ? 'عميل' : 'customers'}`} />
        <StatCard label={t('dash.ar')} value={money(k.arBalance, 'SAR', lang)} tone="bad"
          icon={<HandCoins size={19} />} sub={`${overdue.length} ${lang === 'ar' ? 'متأخرة' : 'overdue'}`} />
        <StatCard label={t('dash.cash')} value={money(k.cashPosition, 'SAR', lang)} tone="good"
          icon={<Landmark size={19} />} sub={t('dash.ap') + ': ' + money(k.apBalance, 'SAR', lang)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dash.inventory')} value={money(k.inventoryValue, 'SAR', lang)} tone="warn"
          icon={<Boxes size={19} />} sub={`${k.lowStockCount} ${lang === 'ar' ? 'تحت الحد' : 'below min'}`} />
        <StatCard label={t('dash.openTickets')} value={num(k.openTickets, lang)} tone="ai"
          icon={<Wrench size={19} />} sub={money(wb.revenue, 'SAR', lang)} />
        <StatCard label={t('adm.purchases')} value={money(k.purchaseTotal, 'SAR', lang)} tone="info"
          icon={<Receipt size={19} />} sub={money(k.payables, 'SAR', lang)} />
        <StatCard label={t('dash.profit')} value={money(k.grossProfit - k.vat, 'SAR', lang)} tone="good"
          icon={<TrendingUp size={19} />} delta={k.marginPct} />
      </div>

      {/* ------------------------------------------------------ AI + chart */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <SectionTitle title={t('dash.salesTrend')}
            sub={`${fmtDateTime(from, lang)} → ${fmtDateTime(to, lang)}`}
            action={
              <div className="flex gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2 w-2 rounded-full bg-brand-500" />{t('dash.revenue')}</span>
                <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2 w-2 rounded-full bg-ai-500" />{t('dash.orders')}</span>
              </div>
            } />
          <div className="h-64">
            {daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F26722" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#F26722" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => String(v).slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<ChartTip currency="SAR" />} />
                  <Area type="monotone" dataKey="revenue" stroke="#F26722" strokeWidth={2.2} fill="url(#gRev)" name="Revenue" />
                  <Area type="monotone" dataKey="orders" stroke="#7C5CFF" strokeWidth={2} fill="url(#gOrd)" name="Orders" yAxisId={0} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState title={t('prod.noResults')} />}
          </div>
        </Card>

        {/* AI insights */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ai-500 via-brand-500 to-signal-500" />
          <SectionTitle title={t('ai.insights')}
            action={<Link to="/app/ai" className="link text-xs">{t('nav.ai')} →</Link>} />
          {insights.length === 0 ? (
            <EmptyState title={t('ai.insights')} sub={t('ai.refresh')} icon={<Sparkles size={22} />}
              action={<Button size="sm" variant="outline" onClick={() => refreshInsights()}>{t('ai.refresh')}</Button>} />
          ) : (
            <div className="max-h-[300px] space-y-2.5 overflow-y-auto pe-1">
              {insights.slice(0, 5).map((i) => (
                <div key={i.id} className={`rounded-xl border p-3.5 ${
                  i.severity === 'critical' ? 'border-red-500/30 bg-red-500/[0.06]'
                  : i.severity === 'warn' ? 'border-amber-500/30 bg-amber-500/[0.06]'
                  : 'border-ai-500/25 bg-ai-500/[0.05]'}`}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="text-xs font-bold leading-snug">{lang === 'ar' ? i.title_ar : i.title_en}</p>
                    {i.severity !== 'info' && (
                      <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${i.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                    )}
                  </div>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                    {lang === 'ar' ? i.body_ar : i.body_en}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ----------------------------------------------- mix + top + health */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <SectionTitle title={t('dash.channelMix')} />
          <div className="h-52">
            {channel.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channel.map((c) => ({ name: lang === 'ar' ? (chAr[c.channel] ?? c.channel) : c.channel, value: c.v }))}
                    dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {channel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip currency="SAR" />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title={t('prod.noResults')} />}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title={t('dash.topProducts')} />
          {topProducts.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.map((p) => ({ name: (lang === 'ar' ? p.name_ar : p.name_en).slice(0, 22), revenue: p.revenue, units: p.units }))}
                  layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<ChartTip currency="SAR" />} cursor={{ fill: 'rgba(242,103,34,.06)' }} />
                  <Bar dataKey="revenue" fill="#F26722" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title={t('prod.noResults')} />}
        </Card>
      </div>

      {/* ------------------------------------------ orders + overdue + hs */}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <SectionTitle title={t('dash.recentOrders')} action={<Link to="/app/accounting/invoices" className="link text-xs">{t('acc.sales')} →</Link>} />
          <div className="table-wrap -mx-5">
            <table className="tbl">
              <thead><tr>
                <th>{t('c.date')}</th><th>{lang === 'ar' ? 'رقم الطلب' : 'Order'}</th>
                <th>{t('adm.customer')}</th><th>{t('c.status')}</th><th className="text-end">{t('acc.total')}</th>
              </tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-ink-500">{fmtDateTime(r.placed_at, lang)}</td>
                    <td className="num text-xs font-semibold">{r.order_no}</td>
                    <td className="max-w-[160px] truncate text-xs">{r.customer ?? '—'}</td>
                    <td><StatusPill status={r.status} lang={lang} /></td>
                    <td className="num text-end font-bold">{money(r.total, 'SAR', lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          {/* health */}
          <Card>
            <SectionTitle title={t('dash.health')} />
            <div className="mb-4 flex items-end gap-3">
              <p className="num text-4xl font-extrabold text-brand-600 dark:text-brand-400">{Math.round(hs.total)}</p>
              <p className="mb-1.5 text-xs font-semibold text-ink-400">/ 100</p>
              <Badge tone={hs.total > 70 ? 'good' : hs.total > 45 ? 'warn' : 'bad'} className="mb-1.5">
                {hs.total > 70 ? (lang === 'ar' ? 'ممتاز' : 'Excellent') : hs.total > 45 ? (lang === 'ar' ? 'مقبول' : 'Fair') : (lang === 'ar' ? 'ضعيف' : 'Weak')}
              </Badge>
            </div>
            <div className="space-y-3">
              {hs.parts.map((p) => (
                <div key={p.key}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-ink-500">{lang === 'ar' ? p.label_ar : p.label_en}</span>
                    <span className="num font-bold">{Math.round(p.score)}</span>
                  </div>
                  <Progress value={p.score} tone={p.score > 70 ? 'good' : p.score > 40 ? 'warn' : 'bad'} />
                </div>
              ))}
            </div>
          </Card>

          {/* overdue */}
          <Card>
            <SectionTitle title={lang === 'ar' ? 'فواتير متأخرة' : 'Overdue invoices'} />
            {overdue.length ? (
              <div className="space-y-2.5">
                {overdue.map((o) => (
                  <div key={o.order_no} className="flex items-center justify-between gap-2 rounded-xl bg-red-500/[0.06] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{o.name}</p>
                      <p className="num text-[10px] text-ink-400">{o.order_no} · {o.age}{lang === 'ar' ? ' يوم' : 'd'}</p>
                    </div>
                    <p className="num shrink-0 text-xs font-extrabold text-red-500">{money(o.due, 'SAR', lang)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="py-6 text-center text-xs text-signal-600">✓ {lang === 'ar' ? 'لا توجد متأخرات' : 'No overdue balances'}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ChartTip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs shadow-lift dark:border-white/10 dark:bg-ink-900">
      {label && <p className="mb-1 font-bold">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="num font-bold">{currency ? money(p.value, currency, 'en') : num(p.value, 'en')}</span>
        </p>
      ))}
    </div>
  );
}
