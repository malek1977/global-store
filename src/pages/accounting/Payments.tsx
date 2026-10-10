/* =====================================================================
 *  Accounting — receipts & payments (cash flow)
 * ===================================================================== */
import { useState } from 'react';
import { Receipt, ArrowDownLeft, ArrowUpRight, Plus, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, Tabs, useToast,
} from '../../ui/primitives';
import { money, num, fmtDate, downloadBlob } from '../../lib/format';
import { recordPayment } from '../../ops/commerce';
import { ChartTip } from '../admin/Dashboard';

export default function PaymentsPage() {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [newOpen, setNewOpen] = useState(false);

  const rows = useQuery(() => q<Row>(
    `SELECT p.*, pa.name AS party, pa.code, so.order_no AS sales_ref, po.order_no AS po_ref
     FROM payments p
     LEFT JOIN partners pa ON pa.id=p.partner_id
     LEFT JOIN sales_orders so ON so.id=p.order_id AND p.direction='in'
     LEFT JOIN purchase_orders po ON po.id=p.order_id AND p.direction='out'
     ORDER BY p.id DESC LIMIT 150`), []);

  const filtered = rows.filter((r) => r.direction === dir);
  const sumIn = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + r.amount, 0);
  const sumOut = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + r.amount, 0);

  const monthly = q<Row>(
    `SELECT strftime('%Y-%m', paid_at) AS ym,
            SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) AS in_amt,
            SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) AS out_amt
     FROM payments WHERE paid_at >= date('now','-12 month') GROUP BY ym ORDER BY ym`);

  const byMethod = q<Row>(`SELECT method, COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM payments GROUP BY method ORDER BY v DESC`);

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={lang === 'ar' ? 'سندات القبض' : 'Receipts'} value={money(sumIn, 'SAR', lang)} icon={<ArrowDownLeft size={19} />} tone="good" sub={`${rows.filter((r) => r.direction === 'in').length}`} />
        <StatCard label={lang === 'ar' ? 'سندات الصرف' : 'Payments'} value={money(sumOut, 'SAR', lang)} icon={<ArrowUpRight size={19} />} tone="bad" sub={`${rows.filter((r) => r.direction === 'out').length}`} />
        <StatCard label={lang === 'ar' ? 'صافي التدفق' : 'Net cash flow'} value={money(sumIn - sumOut, 'SAR', lang)} icon={<Receipt size={19} />} tone="brand" />
        <StatCard label={lang === 'ar' ? 'عدد السندات' : 'Documents'} value={num(rows.length, lang)} tone="info" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <SectionTitle title={lang === 'ar' ? 'التدفق النقدي الشهري' : 'Monthly cash flow'} />
          <div className="h-60">
            {monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" vertical={false} />
                  <XAxis dataKey="ym" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<ChartTip currency="SAR" />} />
                  <Bar dataKey="in_amt" name={lang === 'ar' ? 'قبض' : 'In'} fill="#0FA898" radius={[5, 5, 0, 0]} barSize={14} />
                  <Bar dataKey="out_amt" name={lang === 'ar' ? 'صرف' : 'Out'} fill="#F26722" radius={[5, 5, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title={t('prod.noResults')} />}
          </div>
        </Card>

        <Card>
          <SectionTitle title={lang === 'ar' ? 'حسب الطريقة' : 'By method'} />
          <div className="space-y-2.5">
            {byMethod.map((m) => (
              <div key={m.method} className="flex items-center justify-between rounded-xl bg-ink-50 px-3.5 py-2.5 dark:bg-white/5">
                <span className="text-xs font-semibold">{t(`acc.${m.method}`) ?? m.method}</span>
                <span className="num text-xs font-bold">{money(m.v, 'SAR', lang)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs
            tabs={[
              { id: 'in', label: lang === 'ar' ? 'سندات القبض' : 'Receipts', count: rows.filter((r) => r.direction === 'in').length },
              { id: 'out', label: lang === 'ar' ? 'سندات الصرف' : 'Payments', count: rows.filter((r) => r.direction === 'out').length },
            ]}
            value={dir} onChange={(v) => setDir(v as any)} />
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => {
              const csv = [['Date', 'Party', 'Method', 'Amount', 'Reference'], ...filtered.map((r) => [r.paid_at, r.party, r.method, r.amount, r.reference ?? ''])];
              downloadBlob(csv.map((r) => r.join(',')).join('\n'), `payments-${dir}.csv`, 'text/csv');
            }}>{t('c.csv')}</Button>
            {can('accounting.post') && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setNewOpen(true)}>{t('adm.payment')}</Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<Receipt size={26} />} /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('c.date')}</th><th>{lang === 'ar' ? 'المرجع' : 'Reference'}</th>
                <th>{dir === 'in' ? t('adm.customer') : t('adm.suppliers')}</th>
                <th>{lang === 'ar' ? 'الفاتورة' : 'Document'}</th><th>{t('acc.method')}</th>
                <th className="text-end">{t('acc.amount')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="num text-xs">{fmtDate(p.paid_at, lang)}</td>
                    <td className="num text-xs font-semibold">{p.reference}</td>
                    <td className="max-w-[180px] truncate text-xs">{p.party ?? '—'}</td>
                    <td className="num text-xs">{p.sales_ref ?? p.po_ref ?? '—'}</td>
                    <td><Badge tone={p.method === 'cash' ? 'warn' : 'info'}>{t(`acc.${p.method}`) ?? p.method}</Badge></td>
                    <td className={`num text-end text-xs font-bold ${p.direction === 'in' ? 'text-signal-600 dark:text-signal-400' : 'text-red-500'}`}>
                      {p.direction === 'in' ? '+' : '−'}{money(p.amount, 'SAR', lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PaymentModal open={newOpen} defaultDir={dir} onClose={() => setNewOpen(false)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

function PaymentModal({ open, defaultDir, onClose, onDone }: { open: boolean; defaultDir: 'in' | 'out'; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [partner, setPartner] = useState<number | ''>('');
  const [dir, setDir] = useState<'in' | 'out'>(defaultDir);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [ref, setRef] = useState('');

  const partners = useQuery(() => q<Row>(
    `SELECT * FROM partners WHERE kind IN ('${defaultDir === 'in' ? 'customer' : 'supplier'}','both') ORDER BY name`), [open, defaultDir]);

  const save = () => {
    if (!partner) { onDone(lang === 'ar' ? 'اختر الطرف' : 'Choose a party'); return; }
    const a = parseFloat(amount || '0');
    if (a <= 0) { onDone(lang === 'ar' ? 'قيمة غير صالحة' : 'Invalid amount'); return; }
    try {
      recordPayment({ partner_id: Number(partner), direction: dir, amount: a, method: method as any, reference: ref || undefined, user_id: user?.id ?? null });
      onDone(`${money(a, 'SAR', lang)}`); onClose(); setAmount(''); setRef('');
    } catch (e: any) { onDone(String(e.message ?? e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('adm.payment')} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save}>{t('adm.save')}</Button></>}>
      <div className="space-y-4">
        <Field label={lang === 'ar' ? 'النوع' : 'Type'}>
          <Select value={dir} onChange={(e) => setDir(e.target.value as any)}>
            <option value="in">{lang === 'ar' ? 'قبض من عميل' : 'Receive from customer'}</option>
            <option value="out">{lang === 'ar' ? 'صرف لمورد' : 'Pay supplier'}</option>
          </Select>
        </Field>
        <Field label={dir === 'in' ? t('adm.customer') : t('adm.suppliers')} required>
          <Select value={partner} onChange={(e) => setPartner(e.target.value ? +e.target.value : '')}>
            <option value="">—</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(Math.abs(p.balance), 'SAR', lang)}</option>)}
          </Select>
        </Field>
        <Field label={t('acc.amount')} required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" inputMode="decimal" autoFocus />
        </Field>
        <Field label={t('acc.method')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {['cash', 'bank', 'card', 'transfer', 'cheque'].map((m) => <option key={m} value={m}>{t(`acc.${m}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('acc.reference')} hint={t('c.optional')}>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
        </Field>
      </div>
    </Modal>
  );
}
