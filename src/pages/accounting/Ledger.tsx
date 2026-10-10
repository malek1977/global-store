/* =====================================================================
 *  Accounting — general ledger (account drill-down with running balance)
 * ===================================================================== */
import { useState } from 'react';
import { BookOpen, Search as SearchIcon, Download, ArrowRightLeft } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatCard, useToast } from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { ledger, accountBalances, reverseJournal, ACC } from '../../accounting/engine';
import { downloadBlob } from '../../lib/format';
import { useAuth } from '../../app/state';

export default function Ledger() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState<string>(ACC.AR);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const accounts = useQuery(() => q<Row>('SELECT * FROM accounts WHERE is_postable=1 ORDER BY code'), []);
  const balances = useQuery(() => accountBalances({ from: from || undefined, to: to || undefined }), [from, to]);
  const data = useQuery(() => ledger(code, from || undefined, to || undefined), [code, from, to]);

  const cur = accounts.find((a) => a.code === code);

  const exportCsv = () => {
    const rows = [
      ['Date', 'Journal', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'],
      ...data.rows.map((r: any) => [r.entry_date, r.journal_no, r.reference ?? '', r.description ?? '', r.debit, r.credit, r.running]),
    ];
    downloadBlob(rows.map((r) => r.join(',')).join('\n'), `ledger-${code}.csv`, 'text/csv');
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t('acc.account')}>
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} · {lang === 'ar' ? a.name_ar : a.name_en}</option>)}
            </Select>
          </Field>
          <Field label={t('c.from')}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" /></Field>
          <Field label={t('c.to')}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" /></Field>
          <Field label={t('c.actions')}>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={exportCsv} className="flex-1">{t('c.csv')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>{t('c.total')}</Button>
            </div>
          </Field>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard label={lang === 'ar' ? 'رصيد افتتاحي' : 'Opening'} value={money(data.opening, 'SAR', lang)} icon={<BookOpen size={19} />} tone="info" />
        <StatCard label={lang === 'ar' ? 'إجمالي المدين' : 'Total debits'} value={money(data.rows.reduce((s: number, r: any) => s + r.debit, 0), 'SAR', lang)} tone="brand" />
        <StatCard label={lang === 'ar' ? 'إجمالي الدائن' : 'Total credits'} value={money(data.rows.reduce((s: number, r: any) => s + r.credit, 0), 'SAR', lang)} tone="info" />
        <StatCard label={t('acc.balance')} value={money(data.closing, 'SAR', lang)} icon={<ArrowRightLeft size={19} />}
          tone={data.closing > 0 ? 'good' : 'bad'} />
      </div>

      <Card>
        <SectionTitle title={`${t('acc.ledger')} — ${lang === 'ar' ? cur?.name_ar : cur?.name_en}`}
          sub={`${data.rows.length} ${lang === 'ar' ? 'حركة' : 'entries'}`} />
        {data.rows.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<BookOpen size={26} />} /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('acc.date')}</th><th>{lang === 'ar' ? 'رقم القيد' : 'Journal'}</th>
                <th>{t('acc.reference')}</th><th>{t('acc.memo')}</th>
                <th className="text-end">{t('acc.debit')}</th><th className="text-end">{t('acc.credit')}</th>
                <th className="text-end">{t('acc.balance')}</th>
                {can('accounting.post') && <th>{t('c.actions')}</th>}
              </tr></thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.id ?? `${r.journal_id}-${r.debit}-${r.credit}-${Math.random()}`}>
                    <td className="num text-xs">{r.entry_date}</td>
                    <td className="num text-xs font-semibold">{r.journal_no}</td>
                    <td className="num text-xs">{r.reference ?? '—'}</td>
                    <td className="max-w-[220px] truncate text-xs">{r.description ?? r.memo ?? '—'}</td>
                    <td className="num text-end text-xs">{r.debit ? num(r.debit, lang) : '—'}</td>
                    <td className="num text-end text-xs">{r.credit ? num(r.credit, lang) : '—'}</td>
                    <td className="num text-end text-xs font-bold">{num(r.running, lang)}</td>
                    {can('accounting.post') && (
                      <td>
                        <button className="btn-ghost btn-sm" title={lang === 'ar' ? 'عكس القيد' : 'Reverse'}
                          onClick={() => {
                            if (!confirm(lang === 'ar' ? 'سيُنشأ قيد عكسي. متابعة؟' : 'A reversing entry will be created. Continue?')) return;
                            try { reverseJournal(r.journal_id, null); toast.push({ kind: 'success', title: t('c.success') }); }
                            catch (e: any) { toast.push({ kind: 'error', title: t('c.error'), body: String(e.message) }); }
                          }}>↺</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
