/* =====================================================================
 *  Accounting — income statement / balance sheet / VAT printable views
 * ===================================================================== */
import { useState } from 'react';
import { Printer, Download, Calculator, Scale, Percent, FileText } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useCompany } from '../../app/state';
import { Button, Card, Field, Input, SectionTitle, Select, Tabs, Badge, Progress } from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { incomeStatement, balanceSheet, vatReturn, trialBalance } from '../../accounting/engine';
import { downloadBlob } from '../../lib/format';

export default function Statements() {
  const { t, lang } = useI18n();
  const co = useCompany();
  const [tab, setTab] = useState('pl');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const pl = useQuery(() => incomeStatement(from, to), [from, to, tab]);
  const bs = useQuery(() => balanceSheet(to), [to, tab]);
  const vat = useQuery(() => vatReturn(from, to), [from, to, tab]);
  const tb = useQuery(() => trialBalance(from, to), [from, to, tab]);

  const exportCsv = () => {
    let rows: any[][] = [];
    if (tab === 'pl') {
      rows = [
        ['Line', 'Amount'],
        ['Net revenue', pl.netRevenue], ['COGS', pl.totalCogs], ['Gross profit', pl.gross],
        ...pl.opex.map((o) => [o.name_en, o.amount]),
        ['EBIT', pl.ebit], ['Net profit', pl.netProfit],
      ];
    } else if (tab === 'bs') {
      rows = [
        ['Line', 'Amount'],
        ['Current assets', bs.currentAssets], ['Inventory', bs.inventory], ['Fixed assets', bs.fixed],
        ['Total assets', bs.totalAssets], ['Total liabilities', bs.totalLiab], ['Total equity', bs.totalEquity],
      ];
    } else if (tab === 'vat') {
      rows = [['Line', 'Amount'], ['Output VAT', vat.outputVat], ['Input VAT', vat.inputVat], ['Net', vat.netPayable]];
    } else {
      rows = [['Code', 'Account', 'Debit', 'Credit'], ...tb.rows.map((r) => [r.code, r.name_en, r.debit, r.credit])];
    }
    downloadBlob(rows.map((r) => r.join(',')).join('\n'), `${tab}-${to}.csv`, 'text/csv');
  };

  const printText = () => {
    const head = `${co.name_en ?? ''} — ${co.name_ar ?? ''}\nVAT No: ${co.vat_number ?? ''}\nPeriod: ${from} → ${to}\n${'='.repeat(60)}\n`;
    let body = '';
    if (tab === 'pl') {
      body = `Net revenue   ${pl.netRevenue.toFixed(2)}\nCOGS          ${pl.totalCogs.toFixed(2)}\nGross profit  ${pl.gross.toFixed(2)}\n` +
        pl.opex.map((o) => `${o.name_en.padEnd(14)} ${o.amount.toFixed(2)}`).join('\n') +
        `\nEBIT          ${pl.ebit.toFixed(2)}\nNET PROFIT    ${pl.netProfit.toFixed(2)}`;
    } else if (tab === 'bs') {
      body = `Assets      ${bs.totalAssets.toFixed(2)}\nLiabilities ${bs.totalLiab.toFixed(2)}\nEquity      ${bs.totalEquity.toFixed(2)}\n${bs.balanced ? 'BALANCED' : 'OUT OF BALANCE'}`;
    } else if (tab === 'vat') {
      body = `Output ${vat.outputVat.toFixed(2)}\nInput  ${vat.inputVat.toFixed(2)}\nNet    ${vat.netPayable.toFixed(2)} (${vat.direction})`;
    } else {
      body = tb.rows.filter((r) => r.debit || r.credit).map((r) => `${r.code} ${r.name_en.padEnd(34)} ${r.debit.toFixed(2).padStart(14)} ${r.credit.toFixed(2).padStart(14)}`).join('\n');
    }
    downloadBlob(head + body, `${tab}-${to}.txt`, 'text/plain;charset=utf-8');
  };

  const tabs = [
    { id: 'pl', label: t('acc.pl'), icon: Calculator },
    { id: 'bs', label: t('acc.bs'), icon: Scale },
    { id: 'vat', label: t('acc.vat'), icon: Percent },
    { id: 'tb', label: t('acc.trial'), icon: FileText },
  ];

  return (
    <div className="space-y-5">
      <Card className="no-print">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t('c.from')}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" /></Field>
          <Field label={t('c.to')}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" /></Field>
          <Field label={lang === 'ar' ? 'سريع' : 'Quick range'}>
            <Select value="" onChange={(e) => {
              const y = new Date().getFullYear();
              if (e.target.value === 'y') { setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
              if (e.target.value === 'm') { const d = new Date(); setFrom(d.toISOString().slice(0, 8) + '01'); setTo(d.toISOString().slice(0, 10)); }
              if (e.target.value === 'q') { const d = new Date(); const q0 = Math.floor(d.getMonth() / 3) * 3 + 1;
                setFrom(`${y}-${String(q0).padStart(2, '0')}-01`); setTo(new Date(y, q0 + 2, 0).toISOString().slice(0, 10)); }
            }}>
              <option value="">{lang === 'ar' ? 'اختر…' : 'Choose…'}</option>
              <option value="m">{lang === 'ar' ? 'هذا الشهر' : 'This month'}</option>
              <option value="q">{lang === 'ar' ? 'هذا الربع' : 'This quarter'}</option>
              <option value="y">{lang === 'ar' ? 'هذه السنة' : 'This year'}</option>
            </Select>
          </Field>
          <Field label={t('c.actions')}>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Printer size={14} />} className="flex-1" onClick={() => window.print()}>{t('c.print')}</Button>
              <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={exportCsv}>{t('c.csv')}</Button>
            </div>
          </Field>
        </div>
        <div className="mt-4"><Tabs tabs={tabs.map(({ id, label }) => ({ id, label }))} value={tab} onChange={setTab} /></div>
      </Card>

      <Card className="print-full">
        {/* document head */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4 dark:border-white/10">
          <div>
            <p className="text-lg font-extrabold">{co.name_ar} <span className="text-ink-400">·</span> {co.name_en}</p>
            <p className="text-xs text-ink-500">{co.address_ar}</p>
            <p className="num text-xs text-ink-400">VAT: {co.vat_number} · CR: {co.cr_number}</p>
          </div>
          <div className="text-end">
            <p className="text-sm font-bold">
              {tab === 'pl' ? t('acc.pl') : tab === 'bs' ? t('acc.bs') : tab === 'vat' ? t('acc.vat') : t('acc.trial')}
            </p>
            <p className="num text-xs text-ink-500">{from} → {to}</p>
            <p className="num mt-0.5 text-[10px] text-ink-400">{fmtDate(new Date(), lang)}</p>
          </div>
        </div>

        {tab === 'pl' && (
          <div className="space-y-4">
            <Row l={t('acc.netRevenue')} v={pl.netRevenue} strong />
            <Row l={t('acc.cogs')} v={-pl.totalCogs} />
            <Row l={t('acc.gross')} v={pl.gross} strong />
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">{t('acc.expenses')}</p>
              <div className="space-y-1">
                {pl.opex.map((o) => <Row key={o.code} l={lang === 'ar' ? o.name_ar : o.name_en} v={-o.amount} small />)}
              </div>
            </div>
            <Row l={t('acc.ebit')} v={pl.ebit} strong />
            <div className="rounded-xl bg-ink-900 p-4 text-white dark:bg-white/10 dark:text-ink-900">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold">{t('acc.net')}</p>
                <p className="num text-2xl font-extrabold">{money(pl.netProfit, 'SAR', lang)}</p>
              </div>
              <Progress value={Math.min(100, Math.max(0, pl.netMarginPct + 10))} tone="good" />
              <p className="num mt-1.5 text-[11px] opacity-80">{lang === 'ar' ? 'هامش صافي' : 'Net margin'}: {pl.netMarginPct}%</p>
            </div>
          </div>
        )}

        {tab === 'bs' && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">{t('acc.assets')}</p>
              <Row l={lang === 'ar' ? 'الموجودات المتداولة' : 'Current assets'} v={bs.currentAssets} small />
              <Row l={t('dash.inventory')} v={bs.inventory} small />
              <Row l={lang === 'ar' ? 'الأصول الثابتة' : 'Fixed assets'} v={bs.fixed} small />
              <Row l={t('c.total')} v={bs.totalAssets} strong />
            </div>
            <div className="space-y-1.5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">{t('acc.liabilities')} + {t('acc.equity')}</p>
              <Row l={lang === 'ar' ? 'الخصوم المتداولة' : 'Current liabilities'} v={bs.currentLiab} small />
              <Row l={lang === 'ar' ? 'رأس المال' : 'Capital'} v={bs.equity.capital} small />
              <Row l={lang === 'ar' ? 'أرباح محتجزة' : 'Retained earnings'} v={bs.equity.retained} small />
              <Row l={t('c.total')} v={bs.liabilitiesAndEquity} strong />
            </div>
          </div>
        )}

        {tab === 'vat' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Box l={t('acc.outputVat')} v={money(vat.outputVat, 'SAR', lang)} tone="bad" />
            <Box l={t('acc.inputVat')} v={money(vat.inputVat, 'SAR', lang)} tone="good" />
            <Box l={t('acc.netVat')} v={money(Math.abs(vat.netPayable), 'SAR', lang)} tone="brand" sub={vat.direction} />
          </div>
        )}

        {tab === 'tb' && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>{t('acc.code')}</th><th>{t('acc.account')}</th><th className="text-end">{t('acc.debit')}</th><th className="text-end">{t('acc.credit')}</th><th className="text-end">{t('acc.balance')}</th></tr></thead>
              <tbody>
                {tb.rows.filter((r) => r.debit || r.credit).map((r) => (
                  <tr key={r.code}>
                    <td className="num text-xs">{r.code}</td>
                    <td className="text-xs">{lang === 'ar' ? r.name_ar : r.name_en}</td>
                    <td className="num text-end text-xs">{num(r.debit, lang)}</td>
                    <td className="num text-end text-xs">{num(r.credit, lang)}</td>
                    <td className="num text-end text-xs font-bold">{num(r.balance, lang)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ink-50 font-bold dark:bg-white/5">
                <tr><td colSpan={2} className="px-4 py-3">{t('c.total')}</td>
                  <td className="num px-4 py-3 text-end">{money(tb.totalDebit, 'SAR', lang)}</td>
                  <td className="num px-4 py-3 text-end">{money(tb.totalCredit, 'SAR', lang)}</td>
                  <td className="px-4 py-3 text-end">{tb.balanced ? '✅' : '⚠️'}</td></tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-4 text-[10px] text-ink-400 dark:border-white/10">
          <span>{co.name_en} · {co.email}</span>
          <span>{lang === 'ar' ? 'تم إنشاء التقرير آلياً من دفاتر النظام' : 'Generated automatically from the system ledger'}</span>
        </div>
      </Card>

      <div className="no-print flex justify-end">
        <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={printText}>{lang === 'ar' ? 'تصدير نصي' : 'Export text'}</Button>
      </div>
    </div>
  );
}

function Row({ l, v, strong, small }: { l: string; v: number; strong?: boolean; small?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'border-t border-ink-100 pt-2 dark:border-white/10' : ''} ${small ? 'py-1 text-xs' : 'py-1.5 text-sm'}`}>
      <span className={strong ? 'font-bold' : 'text-ink-500'}>{l}</span>
      <span className={`num ${strong ? 'text-base font-extrabold' : 'font-semibold'} ${v < 0 ? 'text-red-500' : ''}`}>{money(Math.abs(v), 'SAR', 'en')}</span>
    </div>
  );
}

function Box({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: string }) {
  const c = tone === 'bad' ? 'text-red-500' : tone === 'good' ? 'text-signal-600 dark:text-signal-400' : 'text-brand-600 dark:text-brand-400';
  return (
    <div className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
      <p className="label">{l}</p>
      <p className={`num text-2xl font-extrabold ${c}`}>{v}</p>
      {sub && <p className="text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}
