/* =====================================================================
 *  Administration — customers & suppliers + AI segmentation
 * ===================================================================== */
import { useState } from 'react';
import { Users, Truck, Plus, CreditCard, Sparkles, TrendingUp, Phone, Mail, MapPin, Wallet } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, insert, update, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, StatusPill, Tabs, useToast, Avatar,
} from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { recordPayment } from '../../ops/commerce';
import { partnerLedger } from '../../accounting/engine';
import { customerSegments } from '../../ai/engine';

export default function Partners() {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('customers');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [ledgerOf, setLedgerOf] = useState<Row | null>(null);
  const [payOf, setPayOf] = useState<Row | null>(null);

  const kind = tab === 'suppliers' ? 'supplier' : 'customer';
  const seg = useQuery(() => customerSegments(), [tab]);

  const rows = useQuery(() => {
    const where = [`p.kind IN ('${kind}','both')`];
    const params: any[] = [];
    if (search) { where.push('(p.name LIKE ? OR p.phone LIKE ? OR p.code LIKE ? OR p.city LIKE ?)'); const l = `%${search}%`; params.push(l, l, l, l); }
    return q<Row>(
      `SELECT p.*, (SELECT COUNT(*) FROM sales_orders so WHERE so.partner_id=p.id AND so.status<>'cancelled') AS orders,
              (SELECT COALESCE(SUM(so.total),0) FROM sales_orders so WHERE so.partner_id=p.id AND so.status<>'cancelled') AS volume,
              (SELECT MAX(so.placed_at) FROM sales_orders so WHERE so.partner_id=p.id) AS last_order
       FROM partners p WHERE ${where.join(' AND ')} ORDER BY ABS(p.balance) DESC`, params);
  }, [kind, search]);

  const totals = {
    ar: rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0),
    ap: rows.filter((r) => r.balance < 0).reduce((s, r) => s - r.balance, 0),
    overLimit: rows.filter((r) => r.credit_limit > 0 && r.balance > r.credit_limit).length,
  };

  const tabs = [
    { id: 'customers', label: t('adm.customers'), count: q<Row>(`SELECT COUNT(*) AS v FROM partners WHERE kind IN ('customer','both')`)[0]?.v },
    { id: 'suppliers', label: t('adm.suppliers'), count: q<Row>(`SELECT COUNT(*) AS v FROM partners WHERE kind IN ('supplier','both')`)[0]?.v },
    { id: 'segments', label: lang === 'ar' ? 'تقسيم ذكي' : 'AI segments', count: seg.rows.length },
  ];

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={kind === 'supplier' ? t('adm.suppliers') : t('adm.customers')} value={num(rows.length, lang)}
          icon={kind === 'supplier' ? <Truck size={19} /> : <Users size={19} />} tone="brand" />
        <StatCard label={t('adm.outstanding')} value={money(Math.abs(totals.ar || totals.ap), 'SAR', lang)}
          icon={<Wallet size={19} />} tone="bad" />
        <StatCard label={lang === 'ar' ? 'تجاوزوا حد الائتمان' : 'Over credit limit'} value={num(totals.overLimit, lang)}
          icon={<CreditCard size={19} />} tone="warn" />
        <StatCard label={lang === 'ar' ? 'إجمالي حجم التعامل' : 'Total volume'} value={money(rows.reduce((s, r) => s + (r.volume || 0), 0), 'SAR', lang)}
          icon={<TrendingUp size={19} />} tone="good" />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab !== 'segments' && (
            <div className="ms-auto flex gap-2">
              <div className="w-56"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} /></div>
              {can('admin.partners.write') && (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setEdit({ isNew: true, kind } as any)}>
                  {t('adm.new')}
                </Button>
              )}
            </div>
          )}
        </div>

        {tab === 'segments' ? (
          <SegmentsView />
        ) : rows.length === 0 ? (
          <EmptyState title={t('prod.noResults')} icon={<Users size={26} />} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{kind === 'supplier' ? t('adm.suppliers') : t('adm.customer')}</th>
                <th>{lang === 'ar' ? 'الاتصال' : 'Contact'}</th>
                <th>{t('checkout.city')}</th>
                {kind === 'customer' && <><th className="text-end">{t('acc.sales')}</th><th className="text-end">{t('dash.orders')}</th></>}
                <th className="text-end">{t('adm.outstanding')}</th>
                <th className="text-end">{t('adm.creditLimit')}</th>
                <th>{t('c.actions')}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const over = r.credit_limit > 0 && r.balance > r.credit_limit;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{r.name}</p>
                            <p className="num text-[10px] text-ink-400">{r.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">
                        <p className="num">{r.phone ?? '—'}</p>
                        <p className="text-[10px] text-ink-400">{r.email ?? ''}</p>
                      </td>
                      <td className="text-xs">{r.city ?? '—'}</td>
                      {kind === 'customer' && <>
                        <td className="num text-end text-xs font-semibold">{money(r.volume ?? 0, 'SAR', lang)}</td>
                        <td className="num text-end text-xs">{num(r.orders ?? 0, lang)}</td>
                      </>}
                      <td className="text-end">
                        <span className={`num font-bold ${r.balance > 0 ? 'text-red-500' : r.balance < 0 ? 'text-signal-600 dark:text-signal-400' : 'text-ink-400'}`}>
                          {money(Math.abs(r.balance), 'SAR', lang)}
                        </span>
                        {r.balance > 0 && <Badge tone="bad" className="ms-2">{lang === 'ar' ? 'عليه' : 'Dr'}</Badge>}
                        {r.balance < 0 && <Badge tone="good" className="ms-2">{lang === 'ar' ? 'له' : 'Cr'}</Badge>}
                      </td>
                      <td className="text-end">
                        <span className={`num text-xs ${over ? 'font-bold text-red-500' : 'text-ink-500'}`}>{money(r.credit_limit, 'SAR', lang)}</span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {can('admin.partners.write') && (
                            <>
                              <button className="btn-ghost btn-sm" onClick={() => setPayOf(r)} title={t('adm.collect')}>
                                <Wallet size={13} />
                              </button>
                              <button className="btn-ghost btn-sm" onClick={() => setEdit(r)}><Plus size={13} /></button>
                            </>
                          )}
                          <button className="btn-ghost btn-sm" onClick={() => setLedgerOf(r)} title={t('acc.ledger')}>
                            <Sparkles size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PartnerModal partner={edit} onClose={() => setEdit(null)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
      <LedgerModal partner={ledgerOf} onClose={() => setLedgerOf(null)} />
      <PaymentModal partner={payOf} onClose={() => setPayOf(null)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

function SegmentsView() {
  const { t, lang } = useI18n();
  const s = useQuery(() => customerSegments(), []);
  const tone: Record<string, any> = { vip: 'brand', champion: 'good', regular: 'info', new: 'neutral', at_risk: 'bad' };
  const label: Record<string, [string, string]> = {
    vip: ['عملاء VIP', 'VIP'], champion: ['عملاء مخلصون', 'Champions'],
    regular: ['عملاء منتظمون', 'Regular'], new: ['عملاء جدد', 'New'], at_risk: [lang === 'ar' ? 'عملاء معرضون للركود' : 'At risk'],
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {s.groups.map((g) => (
          <div key={g.tier} className="rounded-2xl border border-ink-100 p-4 dark:border-white/10">
            <Badge tone={tone[g.tier]}>{label[g.tier]?.[lang === 'ar' ? 0 : 1]}</Badge>
            <p className="num mt-2.5 text-2xl font-extrabold">{g.count}</p>
            <p className="num text-[11px] text-ink-500">{money(g.revenue, 'SAR', lang)}</p>
            <p className="num mt-1 text-[10px] text-ink-400">{lang === 'ar' ? 'متوسط' : 'avg'} {money(g.avgOrder, 'SAR', lang)}</p>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr>
            <th>{t('adm.customer')}</th><th className="text-end">{t('acc.sales')}</th>
            <th className="text-end">{t('dash.orders')}</th><th className="text-end">{lang === 'ar' ? 'أيام بلا طلب' : 'Idle days'}</th>
            <th>{lang === 'ar' ? 'الشريحة' : 'Segment'}</th>
          </tr></thead>
          <tbody>
            {s.rows.sort((a, b) => b.spent - a.spent).slice(0, 40).map((r: any) => (
              <tr key={r.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} size={28} />
                    <div><p className="text-xs font-semibold">{r.name}</p><p className="num text-[10px] text-ink-400">{r.phone}</p></div>
                  </div>
                </td>
                <td className="num text-end text-xs font-semibold">{money(r.spent, 'SAR', lang)}</td>
                <td className="num text-end text-xs">{r.orders}</td>
                <td className="num text-end text-xs">
                  <Badge tone={r.days_idle > 75 ? 'bad' : r.days_idle > 45 ? 'warn' : 'good'}>{r.days_idle}</Badge>
                </td>
                <td><Badge tone={tone[r.tier]}>{label[r.tier]?.[lang === 'ar' ? 0 : 1]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartnerModal({ partner, onClose, onDone }: { partner: Row | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const isNew = !!partner?.isNew;
  const [f, setF] = useState<any>({});
  const key = partner?.id ?? 'new';
  const [init, setInit] = useState<string>('');

  if (partner && init !== String(key)) {
    setInit(String(key));
    setF({
      name: partner.name ?? '', kind: partner.kind ?? 'customer', phone: partner.phone ?? '',
      email: partner.email ?? '', city: partner.city ?? '', address: partner.address ?? '',
      tax_number: partner.tax_number ?? '', credit_limit: partner.credit_limit ?? 0,
      payment_terms: partner.payment_terms ?? 0, notes: partner.notes ?? '',
    });
  }

  const save = () => {
    if (!f.name?.trim()) { onDone(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required'); return; }
    try {
      if (isNew) {
        const code = `${f.kind === 'supplier' ? 'S' : 'C'}-${String(Date.now()).slice(-6)}`;
        insert('partners', { ...f, code, balance: 0, segment: 'retail', is_active: 1, loyalty_points: 0 });
      } else {
        update('partners', partner!.id, f);
      }
      onDone(f.name);
      onClose();
    } catch (e: any) { onDone(String(e.message ?? e)); }
  };

  return (
    <Modal open={!!partner} onClose={onClose} title={isNew ? t('adm.new') : t('adm.edit')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save}>{t('adm.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={lang === 'ar' ? 'الاسم / المنشأة' : 'Name / company'} required>
          <Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={lang === 'ar' ? 'النوع' : 'Type'}>
          <Select value={f.kind ?? 'customer'} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="customer">{lang === 'ar' ? 'عميل' : 'Customer'}</option>
            <option value="supplier">{lang === 'ar' ? 'مورد' : 'Supplier'}</option>
            <option value="both">{lang === 'ar' ? 'عميل ومورد' : 'Both'}</option>
          </Select>
        </Field>
        <Field label={lang === 'ar' ? 'الجوال' : 'Mobile'}>
          <Input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} dir="ltr" />
        </Field>
        <Field label={lang === 'ar' ? 'البريد' : 'Email'}>
          <Input value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" />
        </Field>
        <Field label={lang === 'ar' ? 'المدينة' : 'City'}>
          <Input value={f.city ?? ''} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label={lang === 'ar' ? 'الرقم الضريبي' : 'Tax number'}>
          <Input value={f.tax_number ?? ''} onChange={(e) => setF({ ...f, tax_number: e.target.value })} dir="ltr" />
        </Field>
        <Field label={t('adm.creditLimit')}>
          <Input value={f.credit_limit ?? 0} onChange={(e) => setF({ ...f, credit_limit: +e.target.value || 0 })} inputMode="decimal" dir="ltr" />
        </Field>
        <Field label={lang === 'ar' ? 'مدة السداد (يوم)' : 'Payment terms (days)'}>
          <Input value={f.payment_terms ?? 0} onChange={(e) => setF({ ...f, payment_terms: +e.target.value || 0 })} inputMode="numeric" dir="ltr" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={lang === 'ar' ? 'العنوان' : 'Address'}>
            <Input value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function LedgerModal({ partner, onClose }: { partner: Row | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const data = useQuery(() => (partner ? partnerLedger(partner.id) : null), [partner?.id]);
  if (!partner || !data) return null;
  return (
    <Modal open={!!partner} onClose={onClose} title={`${t('acc.ledger')} — ${partner.name}`} size="lg">
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Mini label={lang === 'ar' ? 'فواتير' : 'Invoices'} value={String(data.invoices.length)} />
        <Mini label={t('adm.outstanding')} value={money(Math.abs(partner.balance), 'SAR', lang)} />
        <Mini label={lang === 'ar' ? 'دفعات' : 'Payments'} value={String(data.payments.length)} />
      </div>
      <div className="table-wrap max-h-[46vh] overflow-y-auto">
        <table className="tbl">
          <thead><tr><th>{t('c.date')}</th><th>{lang === 'ar' ? 'المرجع' : 'Reference'}</th><th>{lang === 'ar' ? 'النوع' : 'Type'}</th><th className="text-end">{t('acc.total')}</th><th className="text-end">{lang === 'ar' ? 'المدفوع' : 'Paid'}</th><th className="text-end">{lang === 'ar' ? 'المتبقي' : 'Due'}</th></tr></thead>
          <tbody>
            {data.invoices.map((i: any) => (
              <tr key={`${i.kind}-${i.ref_id}`}>
                <td className="text-xs">{fmtDate(i.date, lang)}</td>
                <td className="num text-xs">{i.order_no}</td>
                <td><Badge tone={i.kind === 'sale' ? 'info' : 'neutral'}>{i.kind === 'sale' ? (lang === 'ar' ? 'بيع' : 'Sale') : (lang === 'ar' ? 'شراء' : 'Purchase')}</Badge></td>
                <td className="num text-end text-xs font-semibold">{money(i.total, 'SAR', lang)}</td>
                <td className="num text-end text-xs">{money(i.paid, 'SAR', lang)}</td>
                <td className="num text-end text-xs font-bold text-red-500">{money(i.total - i.paid, 'SAR', lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.payments.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">{t('acc.payments')}</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {data.payments.slice(0, 20).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs dark:bg-white/5">
                <span className="num text-ink-500">{fmtDate(p.date, lang)} · {p.method}</span>
                <span className="num font-bold text-signal-600 dark:text-signal-400">{money(p.amount, 'SAR', lang)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function PaymentModal({ partner, onClose, onDone }: { partner: Row | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [ref, setRef] = useState('');

  const save = () => {
    if (!partner) return;
    const amt = parseFloat(amount || '0');
    if (amt <= 0) { onDone(lang === 'ar' ? 'قيمة غير صالحة' : 'Invalid amount'); return; }
    try {
      recordPayment({
        partner_id: partner.id,
        direction: partner.balance > 0 ? 'in' : 'out',
        amount: amt, method: method as any, reference: ref || undefined, user_id: user?.id ?? null,
      });
      onDone(`${partner.name}: ${money(amt, 'SAR', lang)}`);
      onClose(); setAmount(''); setRef('');
    } catch (e: any) { onDone(String(e.message ?? e)); }
  };

  return (
    <Modal open={!!partner} onClose={onClose} title={`${t('adm.collect')} — ${partner?.name ?? ''}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save}>{t('adm.save')}</Button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-50 p-4 text-center dark:bg-white/5">
          <p className="text-xs text-ink-500">{t('adm.outstanding')}</p>
          <p className="num text-2xl font-extrabold">{money(Math.abs(partner?.balance ?? 0), 'SAR', lang)}</p>
          {partner?.credit_limit > 0 && (
            <p className="mt-1 text-[11px] text-ink-400">{t('adm.creditLimit')}: {money(partner.credit_limit, 'SAR', lang)}</p>
          )}
        </div>
        <Field label={t('acc.amount')} required>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr"
            placeholder={(Math.abs(partner?.balance ?? 0)).toFixed(2)} autoFocus />
        </Field>
        <Field label={t('acc.method')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">{t('acc.cash')}</option>
            <option value="bank">{t('acc.bank')}</option>
            <option value="card">{t('acc.card')}</option>
            <option value="transfer">{t('acc.transfer')}</option>
            <option value="cheque">{t('acc.cheque')}</option>
          </Select>
        </Field>
        <Field label={t('acc.reference')} hint={t('c.optional')}>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
        </Field>
      </div>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-center dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="num mt-1 text-base font-extrabold">{value}</p>
    </div>
  );
}
