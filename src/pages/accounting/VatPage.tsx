/* =====================================================================
 *  Accounting — VAT return detail with period picker
 * ===================================================================== */
import { useState } from 'react';
import { Percent, Printer, Download, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useCompany } from '../../app/state';
import { q, type Row } from '../../db/db';
import { Badge, Button, Card, Field, Input, SectionTitle, Select, StatCard } from '../../ui/primitives';
import { money, num, fmtDate, downloadBlob } from '../../lib/format';
import { vatReturn, ACC } from '../../accounting/engine';

export default function VatPage() {
  const { t, lang } = useI18n();
  const co = useCompany();
  const y = new Date().getFullYear();
  const [q1, setQ1] = useState(`${y}-01-01`);
  const [q2, setQ2] = useState(new Date().toISOString().slice(0, 10));

  const v = useQuery(() => vatReturn(q1, q2), [q1, q2]);

  const lines = useQuery(() => q<Row>(
    `SELECT j.entry_date AS d, j.journal_no, j.kind, a.code, a.name_ar, a.name_en,
            jl.debit, jl.credit, j.reference
     FROM journal_lines jl
     JOIN journals j ON j.id=jl.journal_id AND j.status='posted'
     JOIN accounts a ON a.id=jl.account_id
     WHERE a.code IN (?,?) AND j.entry_date BETWEEN ? AND ?
     ORDER BY j.entry_date DESC LIMIT 120`,
    [ACC.VAT_PAY, ACC.VAT_REC, q1, q2]), [q1, q2]);

  const quarters = ['01-01', '04-01', '07-01', '10-01'];
  const asText = () => {
    const L = [
      `${co.name_ar} / ${co.name_en}`,
      `VAT No: ${co.vat_number}`,
      lang === 'ar' ? `إقرار ضريبة القيمة المضافة ${q1} → ${q2}` : `VAT return ${q1} → ${q2}`,
      '='.repeat(50),
      `Output VAT: ${v.outputVat.toFixed(2)}`,
      `Input VAT: ${v.inputVat.toFixed(2)}`,
      `NET: ${v.netPayable.toFixed(2)} (${v.direction})`,
    ];
    return L.join('\n');
  };

  return (
    <div className="space-y-5">
      <Card className="no-print">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t('c.from')}><Input type="date" value={q1} onChange={(e) => setQ1(e.target.value)} dir="ltr" /></Field>
          <Field label={t('c.to')}><Input type="date" value={q2} onChange={(e) => setQ2(e.target.value)} dir="ltr" /></Field>
          <Field label={lang === 'ar' ? 'فترة سريعة' : 'Quick period'}>
            <Select value="" onChange={(e) => {
              const idx = quarters.indexOf(e.target.value);
              if (idx < 0) return;
              const yy = new Date().getFullYear();
              const s = `${yy}-${e.target.value}`;
              setQ1(s);
              setQ2(new Date(yy, idx * 3 + 3, 0).toISOString().slice(0, 10));
            }}>
              <option value="">{lang === 'ar' ? 'اختر الربع…' : 'Choose quarter…'}</option>
              {quarters.map((qq, i) => <option key={qq} value={qq}>Q{i + 1}</option>)}
            </Select>
          </Field>
          <Field label={t('c.actions')}>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Download size={14} />} className="flex-1" onClick={() => downloadBlob(asText(), `vat-${q1}.txt`, 'text/plain;charset=utf-8')}>{t('c.export')}</Button>
              <Button size="sm" variant="ghost" icon={<Printer size={14} />} onClick={() => window.print()}>{t('c.print')}</Button>
            </div>
          </Field>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard label={t('acc.outputVat')} value={money(v.outputVat, 'SAR', lang)} icon={<Percent size={19} />} tone="bad" sub={`${lang === 'ar' ? 'أساس' : 'base'} ${money(v.salesBase, 'SAR', lang)}`} />
        <StatCard label={t('acc.inputVat')} value={money(v.inputVat, 'SAR', lang)} icon={<Percent size={19} />} tone="good" sub={`${lang === 'ar' ? 'أساس' : 'base'} ${money(v.purchaseBase, 'SAR', lang)}`} />
        <StatCard label={t('acc.netVat')} value={money(Math.abs(v.netPayable), 'SAR', lang)} tone={v.netPayable >= 0 ? 'bad' : 'good'}
          sub={v.direction === 'payable' ? (lang === 'ar' ? 'مستحق للجهة' : 'Payable') : (lang === 'ar' ? 'مسترد' : 'Refundable')} />
        <StatCard label={lang === 'ar' ? 'المعدل الفعلي' : 'Effective rate'}
          value={`${v.salesBase ? ((v.netPayable / v.salesBase) * 100).toFixed(2) : '0.00'}%`} tone="info" />
      </div>

      <Card>
        <SectionTitle title={lang === 'ar' ? 'حركة ضريبة القيمة المضافة' : 'VAT ledger movement'} sub={`${q1} → ${q2}`} />
        {lines.length === 0 ? <p className="py-8 text-center text-sm text-ink-400">{t('prod.noResults')}</p> : (
          <div className="table-wrap max-h-[540px] overflow-y-auto">
            <table className="tbl">
              <thead><tr>
                <th>{t('acc.date')}</th><th>{lang === 'ar' ? 'القيد' : 'Journal'}</th>
                <th>{t('acc.account')}</th><th>{t('acc.reference')}</th>
                <th className="text-end">{t('acc.debit')}</th><th className="text-end">{t('acc.credit')}</th>
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="num text-xs">{fmtDate(l.d, lang)}</td>
                    <td className="num text-xs font-semibold">{l.journal_no}</td>
                    <td className="text-xs">{lang === 'ar' ? l.name_ar : l.name_en}</td>
                    <td className="num text-xs">{l.reference ?? '—'}</td>
                    <td className="num text-end text-xs">{l.debit ? num(l.debit, lang) : '—'}</td>
                    <td className="num text-end text-xs">{l.credit ? num(l.credit, lang) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="print-full">
        <div className="flex items-start justify-between border-b border-ink-100 pb-4 dark:border-white/10">
          <div>
            <p className="text-lg font-extrabold">{co.name_ar}</p>
            <p className="text-xs text-ink-500">{lang === 'ar' ? 'إقرار ضريبة القيمة المضافة' : 'Value Added Tax Return'}</p>
          </div>
          <div className="text-end">
            <p className="num text-sm font-bold">{q1} → {q2}</p>
            <p className="num text-xs text-ink-500">VAT: {co.vat_number}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            [lang === 'ar' ? 'مبيعات خاضعة' : 'Taxable sales', money(v.salesBase, 'SAR', lang)],
            [t('acc.outputVat'), money(v.outputVat, 'SAR', lang)],
            [lang === 'ar' ? 'مشتريات خاضعة' : 'Taxable purchases', money(v.purchaseBase, 'SAR', lang)],
            [t('acc.inputVat'), money(v.inputVat, 'SAR', lang)],
            [t('acc.netVat'), money(Math.abs(v.netPayable), 'SAR', lang)],
          ].map(([l, val], i) => (
            <div key={l as string} className={`rounded-xl p-4 ${i === 4 ? 'col-span-3 bg-ink-900 text-white dark:bg-white/10 dark:text-ink-900' : 'bg-ink-50 dark:bg-white/5'}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{l as string}</p>
              <p className="num mt-1 text-xl font-extrabold">{val as string}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
          <ShieldCheck size={14} className="text-signal-500" />
          {lang === 'ar' ? 'مستخرَج آلياً من قيود دفتر اليومية' : 'Auto-derived from general journal entries'}
        </p>
      </Card>
    </div>
  );
}
