/* =====================================================================
 *  Accounting — dashboard, chart of accounts, trial balance, postings
 * ===================================================================== */
import { useState } from 'react';
import {
  Wallet, TrendingUp, Landmark, Scale, BookOpen, Download, Plus, AlertTriangle,
  CheckCircle2, ArrowRightLeft, Receipt, Building2,
} from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, Tabs, Textarea, useToast, Progress,
} from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { ChartTip } from '../admin/Dashboard';
import { incomeStatement, balanceSheet, trialBalance, vatReturn, yearlySeries, currentFY, post, ACC, ledger, auditTrail } from '../../accounting/engine';
import { toArabicDigits } from '../../db/seed';

export default function AccountingDashboard() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [year, setYear] = useState(new Date().getFullYear());
  const [entry, setEntry] = useState(false);

  const fy = useQuery(() => currentFY(), [tab]);
  const yFrom = `${year}-01-01`, yTo = `${year}-12-31`;
  const pl = useQuery(() => incomeStatement(yFrom, yTo), [year, tab]);
  const bs = useQuery(() => balanceSheet(yTo), [year, tab]);
  const tb = useQuery(() => trialBalance(yFrom, yTo), [year, tab]);
  const vat = useQuery(() => vatReturn(yFrom, new Date().toISOString().slice(0, 10)), [year, tab]);
  const series = useQuery(() => yearlySeries(year), [year, tab]);
  const accounts = useQuery(() => q<Row>(`SELECT * FROM accounts WHERE is_postable=1 ORDER BY code`), [tab]);

  const monthNames = lang === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chart = series.map((r: any) => ({
    m: monthNames[(+r.m) - 1],
    revenue: Math.round(r.revenue ?? 0),
    profit: Math.round((r.revenue ?? 0) - (r.cogs ?? 0) - (r.expenses ?? 0)),
  }));

  const tabs = [
    { id: 'overview', label: t('acc.dashboard') },
    { id: 'chart', label: t('acc.chart'), count: accounts.length },
    { id: 'trial', label: t('acc.trial') },
    { id: 'pl', label: t('acc.pl') },
    { id: 'bs', label: t('acc.bs') },
    { id: 'vat', label: t('acc.vat') },
    { id: 'audit', label: lang === 'ar' ? 'القيود الأخيرة' : 'Recent entries' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="ms-auto flex items-center gap-2">
          <div className="w-28">
            <Select value={String(year)} onChange={(e) => setYear(+e.target.value)}>
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          {can('accounting.post') && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setEntry(true)}>{t('acc.newEntry')}</Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ overview */}
      {tab === 'overview' && (
        <>
          {fy && (
            <div className="surface flex flex-wrap items-center justify-between gap-3 border-s-4 border-s-brand-500 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-600"><CalendarIcon /></div>
                <div>
                  <p className="text-sm font-bold">{lang === 'ar' ? `السنة المالية ${fy.name}` : `Fiscal year ${fy.name}`}</p>
                  <p className="num text-xs text-ink-500">{fy.start} → {fy.end}</p>
                </div>
              </div>
              <Badge tone={fy.status === 'open' ? 'good' : 'neutral'}>
                {fy.status === 'open' ? (lang === 'ar' ? 'مفتوحة' : 'Open') : (lang === 'ar' ? 'مغلقة' : 'Closed')}
              </Badge>
            </div>
          )}

          <div className="stat-grid">
            <StatCard label={t('acc.net')} value={money(pl.netProfit, 'SAR', lang)} icon={<TrendingUp size={19} />}
              tone={pl.netProfit >= 0 ? 'good' : 'bad'} delta={pl.netMarginPct} sub={t('dash.profit')} />
            <StatCard label={t('acc.gross')} value={money(pl.gross, 'SAR', lang)} icon={<Wallet size={19} />} tone="brand" delta={pl.grossMarginPct} />
            <StatCard label={t('acc.liabilities')} value={money(bs.totalLiab, 'SAR', lang)} icon={<Landmark size={19} />} tone="bad" />
            <StatCard label={t('acc.equity')} value={money(bs.totalEquity, 'SAR', lang)} icon={<Building2 size={19} />} tone="info" />
          </div>

          <Card>
            <SectionTitle title={lang === 'ar' ? 'الإيراد مقابل الربح' : 'Revenue vs profit'} sub={year} />
            <div className="h-64">
              {chart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F26722" stopOpacity={0.35} /><stop offset="100%" stopColor="#F26722" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0FA898" stopOpacity={0.3} /><stop offset="100%" stopColor="#0FA898" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" vertical={false} />
                    <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip content={<ChartTip currency="SAR" />} />
                    <Area type="monotone" dataKey="revenue" stroke="#F26722" strokeWidth={2.2} fill="url(#a1)" name={lang === 'ar' ? 'الإيراد' : 'Revenue'} />
                    <Area type="monotone" dataKey="profit" stroke="#0FA898" strokeWidth={2} fill="url(#a2)" name={lang === 'ar' ? 'الربح' : 'Profit'} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState title={t('prod.noResults')} />}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle title={lang === 'ar' ? 'سلامة الدفاتر' : 'Books integrity'} />
              <div className="space-y-3">
                <CheckRow ok={tb.balanced}
                  good={lang === 'ar' ? 'ميزان المراجعة متوازن' : 'Trial balance balances'}
                  bad={lang === 'ar' ? 'ميزان المراجعة غير متوازن' : 'Trial balance out of balance'}
                  detail={`${money(tb.totalDebit, 'SAR', lang)} = ${money(tb.totalCredit, 'SAR', lang)}`} />
                <CheckRow ok={bs.balanced}
                  good={lang === 'ar' ? 'الميزانية العمومية متوازنة' : 'Balance sheet balances'}
                  bad={lang === 'ar' ? 'الميزانية غير متوازنة' : 'Balance sheet out of balance'}
                  detail={`${money(bs.totalAssets, 'SAR', lang)} = ${money(bs.liabilitiesAndEquity, 'SAR', lang)}`} />
                <div className="rounded-xl bg-ink-50 p-4 dark:bg-white/5">
                  <p className="num text-center text-3xl font-extrabold text-brand-600 dark:text-brand-400">
                    {tb.balanced ? toArabicDigits(tb.rows.filter((r) => r.balance !== 0).length) : '—'}
                  </p>
                  <p className="mt-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    {lang === 'ar' ? 'حساباً له حركة' : 'accounts with movement'}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle title={lang === 'ar' ? 'ملخص قائمة الدخل' : 'Income statement summary'} sub={`${year}`} />
              <dl className="space-y-2.5 text-sm">
                <SumRow l={t('acc.netRevenue')} v={pl.netRevenue} strong />
                <SumRow l={t('acc.cogs')} v={pl.totalCogs} neg />
                <SumRow l={t('acc.gross')} v={pl.gross} strong />
                <SumRow l={t('acc.expenses')} v={pl.totalOpex} neg />
                <SumRow l={t('acc.ebit')} v={pl.ebit} strong />
                <SumRow l={t('acc.net')} v={pl.netProfit} strong big tone={pl.netProfit >= 0 ? 'good' : 'bad'} />
              </dl>
            </Card>
          </div>
        </>
      )}

      {/* -------------------------------------------------- chart of a/c */}
      {tab === 'chart' && (
        <Card>
          <SectionTitle title={t('acc.chart')} sub={lang === 'ar' ? `${accounts.length} حساب رئيسي` : `${accounts.length} ledger accounts`} />
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('acc.code')}</th><th>{t('acc.account')}</th><th>{t('acc.type')}</th>
                <th className="text-end">{lang === 'ar' ? 'الحركة' : 'Activity'}</th>
              </tr></thead>
              <tbody>
                {accounts.map((a) => {
                  const v = pl && a.code.startsWith('4') ? (a.code === '4300' ? pl.returns : 0)
                    : a.code.startsWith('5') && a.code !== '5100' && a.code !== '5200' ? 0 : 0;
                  void v;
                  return (
                    <tr key={a.id}>
                      <td className="num text-xs font-bold">{a.code}</td>
                      <td className="text-xs font-semibold">{lang === 'ar' ? a.name_ar : a.name_en}</td>
                      <td><Badge tone={a.type === 'asset' ? 'info' : a.type === 'liability' ? 'bad' : a.type === 'equity' ? 'ai' : a.type === 'revenue' ? 'good' : 'warn'}>{a.type}</Badge></td>
                      <td className="text-end"><Badge tone="neutral">{a.subtype}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------ trial */}
      {tab === 'trial' && (
        <Card>
          <SectionTitle title={t('acc.trial')} sub={`${year}`}
            action={<Badge tone={tb.balanced ? 'good' : 'bad'}>{tb.balanced ? t('acc.balanced') : t('acc.unbalanced')}</Badge>} />
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('acc.code')}</th><th>{t('acc.account')}</th>
                <th className="text-end">{t('acc.debit')}</th><th className="text-end">{t('acc.credit')}</th>
                <th className="text-end">{t('acc.balance')}</th>
              </tr></thead>
              <tbody>
                {tb.rows.filter((r) => r.debit || r.credit).map((r) => (
                  <tr key={r.code}>
                    <td className="num text-xs">{r.code}</td>
                    <td className="text-xs font-semibold">{lang === 'ar' ? r.name_ar : r.name_en}</td>
                    <td className="num text-end text-xs">{num(r.debit, lang)}</td>
                    <td className="num text-end text-xs">{num(r.credit, lang)}</td>
                    <td className={`num text-end text-xs font-bold ${r.balance > 0 ? 'text-brand-600 dark:text-brand-400' : r.balance < 0 ? 'text-sky-600 dark:text-sky-400' : ''}`}>
                      {num(r.balance, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ink-50 font-bold dark:bg-white/5">
                <tr>
                  <td colSpan={2} className="px-4 py-3">{t('c.total')}</td>
                  <td className="num px-4 py-3 text-end">{money(tb.totalDebit, 'SAR', lang)}</td>
                  <td className="num px-4 py-3 text-end">{money(tb.totalCredit, 'SAR', lang)}</td>
                  <td className="px-4 py-3 text-end">{tb.balanced ? '✅' : '⚠️'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- P&L */}
      {tab === 'pl' && (
        <Card>
          <SectionTitle title={t('acc.pl')} sub={`${pl.from} → ${pl.to}`}
            action={<Badge tone={pl.netProfit >= 0 ? 'good' : 'bad'}>{lang === 'ar' ? 'هامش' : 'Margin'} {pl.netMarginPct}%</Badge>} />
          <div className="space-y-4">
            <Group title={t('acc.revenue')} total={pl.netRevenue}>
              {pl.revenue.map((r: any) => {
                const a = one<Row>('SELECT name_ar,name_en FROM accounts WHERE code=?', [r.code]);
                return <Line key={r.code} l={lang === 'ar' ? a?.name_ar : a?.name_en} v={r.amount} />;
              })}
              {pl.repairRevenue > 0 && <Line l={lang === 'ar' ? 'إيرادات الصيانة' : 'Repair revenue'} v={pl.repairRevenue} />}
              {pl.returns > 0 && <Line l={t('acc.sales')} v={-pl.returns} neg />}
              <Line l={t('acc.netRevenue')} v={pl.netRevenue} strong />
            </Group>

            <Group title={t('acc.cogs')} total={-pl.totalCogs}>
              {pl.cogs.map((c: any) => <Line key={c.code} l={c.ar} v={-c.amount} neg />)}
              <Line l={t('acc.gross')} v={pl.gross} strong />
              <div className="px-4 pb-2">
                <Progress value={Math.min(100, Math.max(0, pl.grossMarginPct))} tone={pl.grossMarginPct > 20 ? 'good' : 'warn'} />
                <p className="num mt-1 text-[11px] text-ink-500">{lang === 'ar' ? 'هامش مجمل' : 'Gross margin'}: {pl.grossMarginPct}%</p>
              </div>
            </Group>

            <Group title={t('acc.expenses')} total={-pl.totalOpex}>
              {pl.opex.map((o: any) => <Line key={o.code} l={lang === 'ar' ? o.name_ar : o.name_en} v={-o.amount} neg />)}
              <Line l={t('acc.ebit')} v={pl.ebit} strong />
            </Group>

            {pl.otherExpenses > 0 && <Group title={lang === 'ar' ? 'مصاريف أخرى' : 'Other expenses'} total={-pl.otherExpenses}>
              <Line l={lang === 'ar' ? 'مصاريف أخرى' : 'Other expenses'} v={-pl.otherExpenses} neg />
            </Group>}

            <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold opacity-90">{t('acc.net')}</p>
                <p className="num text-3xl font-extrabold">{money(pl.netProfit, 'SAR', lang)}</p>
              </div>
              <p className="num mt-1 text-xs opacity-85">{lang === 'ar' ? 'هامش صافي' : 'Net margin'}: {pl.netMarginPct}%</p>
            </div>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------- balance sheet */}
      {tab === 'bs' && (
        <Card>
          <SectionTitle title={t('acc.bs')} sub={bs.asOf}
            action={<Badge tone={bs.balanced ? 'good' : 'bad'}>{bs.balanced ? '✅ ' + t('acc.balanced') : '⚠️ ' + t('acc.unbalanced')}</Badge>} />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <Group title={t('acc.assets')} total={bs.totalAssets}>
                <Line l={lang === 'ar' ? 'الموجودات المتداولة' : 'Current assets'} v={bs.currentAssets} />
                <Line l={t('dash.inventory')} v={bs.inventory} />
                <Line l={lang === 'ar' ? 'الأصول الثابتة' : 'Fixed assets'} v={bs.fixed} />
              </Group>
            </div>
            <div className="space-y-3">
              <Group title={t('acc.liabilities')} total={bs.totalLiab}>
                <Line l={lang === 'ar' ? 'الخصوم المتداولة' : 'Current liabilities'} v={bs.currentLiab} />
              </Group>
              <Group title={t('acc.equity')} total={bs.totalEquity}>
                <Line l={lang === 'ar' ? 'رأس المال' : 'Capital'} v={bs.equity.capital} />
                <Line l={lang === 'ar' ? 'المسحوبات' : 'Drawings'} v={bs.equity.drawings} />
                <Line l={lang === 'ar' ? 'أرباح محتجزة' : 'Retained earnings'} v={bs.equity.retained} />
              </Group>
            </div>
          </div>
          <div className={`mt-5 rounded-2xl p-5 ${bs.balanced ? 'bg-signal-500/10' : 'bg-red-500/10'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{t('c.total')}</p>
              <p className="num text-2xl font-extrabold">{money(bs.totalAssets, 'SAR', lang)}</p>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {bs.balanced ? `✅ ${lang === 'ar' ? 'الأصول = الخصوم + حقوق الملكية' : 'Assets = Liabilities + Equity'}` : `⚠️ ${lang === 'ar' ? 'فرق' : 'Difference'}: ${money(bs.difference, 'SAR', lang)}`}
            </p>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- VAT */}
      {tab === 'vat' && (
        <Card>
          <SectionTitle title={t('acc.vat')} sub={`${vat.from} → ${vat.to}`} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
              <p className="label">{t('acc.outputVat')}</p>
              <p className="num text-2xl font-extrabold text-red-500">{money(vat.outputVat, 'SAR', lang)}</p>
              <p className="num mt-1 text-[11px] text-ink-400">{lang === 'ar' ? 'أساس' : 'base'}: {money(vat.salesBase, 'SAR', lang)}</p>
            </div>
            <div className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
              <p className="label">{t('acc.inputVat')}</p>
              <p className="num text-2xl font-extrabold text-signal-600 dark:text-signal-400">{money(vat.inputVat, 'SAR', lang)}</p>
              <p className="num mt-1 text-[11px] text-ink-400">{lang === 'ar' ? 'أساس' : 'base'}: {money(vat.purchaseBase, 'SAR', lang)}</p>
            </div>
            <div className={`rounded-2xl p-5 ${vat.netPayable >= 0 ? 'bg-red-500/10' : 'bg-signal-500/10'}`}>
              <p className="label">{t('acc.netVat')}</p>
              <p className={`num text-2xl font-extrabold ${vat.netPayable >= 0 ? 'text-red-500' : 'text-signal-600 dark:text-signal-400'}`}>
                {money(Math.abs(vat.netPayable), 'SAR', lang)}
              </p>
              <p className="mt-1 text-[11px] font-bold">{vat.direction === 'payable' ? (lang === 'ar' ? 'مستحق للجهة' : 'Payable to authority') : (lang === 'ar' ? 'مسترد' : 'Refundable')}</p>
            </div>
          </div>

          <div className="mt-5">
            <SectionTitle title={lang === 'ar' ? 'تفصيل حركة الضريبة' : 'VAT movement'} />
            <div className="space-y-3">
              {monthNames.map((m, i) => {
                const mm = String(i + 1).padStart(2, '0');
                const out = q<Row>(
                  `SELECT COALESCE(SUM(jl.credit-jl.debit),0) AS v FROM journal_lines jl
                   JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
                   JOIN accounts a ON a.id=jl.account_id
                   WHERE a.code=? AND strftime('%m',j.entry_date)=?`, [ACC.VAT_PAY, mm])[0]?.v ?? 0;
                const inn = q<Row>(
                  `SELECT COALESCE(SUM(jl.debit-jl.credit),0) AS v FROM journal_lines jl
                   JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
                   JOIN accounts a ON a.id=jl.account_id
                   WHERE a.code=? AND strftime('%m',j.entry_date)=?`, [ACC.VAT_REC, mm])[0]?.v ?? 0;
                const net = out - inn;
                const max = Math.max(...monthNames.map((_, k) => {
                  const kk = String(k + 1).padStart(2, '0');
                  const o2 = q<Row>(`SELECT COALESCE(SUM(jl.credit-jl.debit),0) AS v FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id AND j.status='posted' JOIN accounts a ON a.id=jl.account_id WHERE a.code=? AND strftime('%m',j.entry_date)=?`, [ACC.VAT_PAY, kk])[0]?.v ?? 0;
                  const i2 = q<Row>(`SELECT COALESCE(SUM(jl.debit-jl.credit),0) AS v FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id AND j.status='posted' JOIN accounts a ON a.id=jl.account_id WHERE a.code=? AND strftime('%m',j.entry_date)=?`, [ACC.VAT_REC, kk])[0]?.v ?? 0;
                  return Math.abs(o2 - i2);
                }), 1);
                return (
                  <div key={m} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-semibold">{m}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded-lg bg-ink-100 dark:bg-white/10">
                      <div className={`h-full rounded-lg ${net >= 0 ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-gradient-to-r from-signal-400 to-signal-500'}`}
                        style={{ width: `${Math.min(100, (Math.abs(net) / max) * 100)}%` }} />
                    </div>
                    <span className={`num w-24 shrink-0 text-end text-xs font-bold ${net >= 0 ? 'text-red-500' : 'text-signal-600 dark:text-signal-400'}`}>
                      {num(Math.round(net), lang)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- audit */}
      {tab === 'audit' && <JournalLog />}

      <JournalModal open={entry} onClose={() => setEntry(false)} accounts={accounts}
        onDone={(m) => toast.push({ kind: m.includes('!') ? 'error' : 'success', title: t('acc.post'), body: m })} />
    </div>
  );
}

/* ------------------------------------------------------------ helpers */
function CalendarIcon() {
  return <span className="text-lg">📅</span>;
}

function SumRow({ l, v, strong, neg, big, tone }: { l: string; v: number; strong?: boolean; neg?: boolean; big?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-ink-100 pt-2.5 dark:border-white/10' : ''}`}>
      <span className={strong ? 'font-bold' : 'text-ink-500'}>{l}</span>
      <span className={`num font-bold ${big ? 'text-lg' : strong ? 'text-sm' : ''} ${tone === 'good' ? 'text-signal-600 dark:text-signal-400' : tone === 'bad' ? 'text-red-500' : ''} ${neg ? 'text-red-500' : ''}`}>
        {money(v, 'SAR', 'en')}
      </span>
    </div>
  );
}

function Group({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 dark:border-white/10">
      <div className="flex items-center justify-between bg-ink-50 px-4 py-3 dark:bg-white/5">
        <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
        <p className="num text-sm font-extrabold">{money(total, 'SAR', 'en')}</p>
      </div>
      <div className="space-y-0 px-4 py-3">{children}</div>
    </div>
  );
}

function Line({ l, v, strong, neg }: { l: string; v: number; strong?: boolean; neg?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? 'mt-1 border-t border-ink-100 font-bold dark:border-white/10' : ''}`}>
      <span className={strong ? '' : 'text-ink-500'}>{l}</span>
      <span className={`num ${strong ? 'font-extrabold' : 'font-semibold'} ${neg ? 'text-red-500' : ''}`}>{money(v, 'SAR', 'en')}</span>
    </div>
  );
}

function CheckRow({ ok, good, bad, detail }: { ok: boolean; good: string; bad: string; detail: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl p-4 ${ok ? 'bg-brand-500/10' : 'bg-brand-500/10'}`}>
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-signal-600" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />}
      <div>
        <p className="text-sm font-bold">{ok ? good : bad}</p>
        <p className="num text-[11px] text-ink-500">{detail}</p>
      </div>
    </div>
  );
}

function JournalLog() {
  const { lang } = useI18n();
  const rows = useQuery(() => q<Row>(
    `SELECT j.*, u.full_name AS user FROM journals j LEFT JOIN users u ON u.id=j.created_by
     ORDER BY j.id DESC LIMIT 60`), []);
  return (
    <Card>
      <SectionTitle title={lang === 'ar' ? 'القيود المُرحَّلة' : 'Posted journals'} sub={lang === 'ar' ? 'آخر 60 قيداً' : 'last 60 entries'} />
      <div className="table-wrap max-h-[620px] overflow-y-auto">
        <table className="tbl">
          <thead><tr>
            <th>{t('acc.reference')}</th><th>{t('acc.date')}</th><th>{lang === 'ar' ? 'النوع' : 'Type'}</th>
            <th>{t('acc.memo')}</th><th className="text-end">{t('acc.amount')}</th><th>{lang === 'ar' ? 'بواسطة' : 'By'}</th>
          </tr></thead>
          <tbody>
            {rows.map((j: any) => {
              const amt = one<Row>(
                `SELECT COALESCE(SUM(debit),0) AS v FROM journal_lines WHERE journal_id=?`, [j.id])?.v ?? 0;
              return (
                <tr key={j.id}>
                  <td className="num text-xs font-bold">{j.journal_no}</td>
                  <td className="num text-xs">{j.entry_date}</td>
                  <td><Badge tone={j.kind === 'sale' ? 'good' : j.kind === 'purchase' ? 'info' : j.kind === 'payment' ? 'brand' : j.kind === 'repair' ? 'ai' : 'neutral'}>{j.kind}</Badge></td>
                  <td className="max-w-[240px] truncate text-xs">{j.memo ?? j.reference}</td>
                  <td className="num text-end text-xs font-bold">{num(Math.round(amt), lang)}</td>
                  <td className="text-xs">{j.user ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JournalModal({ open, onClose, accounts, onDone }: {
  open: boolean; onClose: () => void; accounts: Row[]; onDone: (m: string) => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState<{ code: string; debit: string; credit: string; description: string }[]>([
    { code: '', debit: '', credit: '', description: '' },
    { code: '', debit: '', credit: '', description: '' },
  ]);

  const dr = lines.reduce((s, l) => s + (parseFloat(l.debit || '0') || 0), 0);
  const cr = lines.reduce((s, l) => s + (parseFloat(l.credit || '0') || 0), 0);
  const balanced = Math.abs(dr - cr) < 0.01 && dr > 0;

  const save = () => {
    try {
      const id = post({
        date, kind: 'adjust', memo, reference: ref || undefined,
        lines: lines
          .filter((l) => l.code && ((+l.debit || 0) !== 0 || (+l.credit || 0) !== 0))
          .map((l) => ({ code: l.code, debit: +l.debit || 0, credit: +l.credit || 0, description: l.description || undefined })),
        source_table: 'journals', user_id: user?.id ?? null,
      });
      onDone(`JV #${id}`);
      onClose(); setMemo(''); setRef('');
      setLines([{ code: '', debit: '', credit: '', description: '' }, { code: '', debit: '', credit: '', description: '' }]);
    } catch (e: any) { onDone(String(e.message ?? e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('acc.newEntry')} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button>
        <Button onClick={save} disabled={!balanced}>{t('acc.post')}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('acc.date')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" /></Field>
          <Field label={t('acc.reference')}><Input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" /></Field>
        </div>

        <div>
          <div className="mb-2 grid grid-cols-[1fr_100px_100px] gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
            <span>{t('acc.account')}</span><span className="text-end">{t('acc.debit')}</span><span className="text-end">{t('acc.credit')}</span>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px] gap-2">
                <Select value={l.code} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, code: e.target.value } : x))}>
                  <option value="">—</option>
                  {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} · {lang === 'ar' ? a.name_ar : a.name_en}</option>)}
                </Select>
                <Input value={l.debit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, debit: e.target.value } : x))}
                  className="num text-end" dir="ltr" inputMode="decimal" placeholder="0" />
                <Input value={l.credit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, credit: e.target.value } : x))}
                  className="num text-end" dir="ltr" inputMode="decimal" placeholder="0" />
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" icon={<Plus size={13} />}
            onClick={() => setLines((ls) => [...ls, { code: '', debit: '', credit: '', description: '' }])}>
            {lang === 'ar' ? 'إضافة سطر' : 'Add line'}
          </Button>
        </div>

        <div className={`flex items-center justify-between rounded-xl p-4 text-sm font-bold ${balanced ? 'bg-signal-500/10 text-signal-700 dark:text-signal-400' : 'bg-red-500/10 text-red-500'}`}>
          <span>{t('acc.unbalancedError')}</span>
          <span className="num">
            {money(dr, 'SAR', 'en')} / {money(cr, 'SAR', 'en')}
          </span>
        </div>

        <Field label={t('acc.memo')}>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="min-h-[70px]" />
        </Field>
      </div>
    </Modal>
  );
}
