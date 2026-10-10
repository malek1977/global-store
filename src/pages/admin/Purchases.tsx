/* =====================================================================
 *  Administration — purchase orders
 * ===================================================================== */
import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Truck, Package, Search as SearchIcon } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, StatusPill, Textarea, useToast,
} from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { createPurchase } from '../../ops/commerce';

export default function Purchases() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<Row | null>(null);
  const [create, setCreate] = useState(false);

  const orders = useQuery(() => q<Row>(
    `SELECT po.*, p.name AS supplier, p.phone, b.name_ar AS branch,
            (SELECT COUNT(*) FROM purchase_items pi WHERE pi.order_id=po.id) AS item_count
     FROM purchase_orders po
     LEFT JOIN partners p ON p.id=po.partner_id
     LEFT JOIN branches b ON b.id=po.branch_id
     ${search ? 'WHERE po.order_no LIKE ? OR p.name LIKE ?' : ''}
     ORDER BY po.id DESC LIMIT 80`,
    search ? [`%${search}%`, `%${search}%`] : []), [search]);

  const suppliers = useQuery(() => q<Row>(`SELECT * FROM partners WHERE kind IN ('supplier','both') ORDER BY name`), []);
  const totals = {
    count: orders.length,
    value: orders.reduce((s, o) => s + o.total, 0),
    unpaid: orders.reduce((s, o) => s + Math.max(0, o.total - o.paid), 0),
  };

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('adm.purchases')} value={num(totals.count, lang)} icon={<ShoppingCart size={19} />} tone="brand" />
        <StatCard label={lang === 'ar' ? 'إجمالي المشتريات' : 'Total purchased'} value={money(totals.value, 'SAR', lang)} icon={<Package size={19} />} tone="info" />
        <StatCard label={lang === 'ar' ? 'غير مسدّد' : 'Outstanding'} value={money(totals.unpaid, 'SAR', lang)} icon={<Truck size={19} />} tone="bad" />
        <StatCard label={t('adm.suppliers')} value={num(suppliers.length, lang)} icon={<Truck size={19} />} tone="good" />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold">{t('adm.purchases')}</h2>
          <div className="ms-auto flex gap-2">
            <div className="w-56"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} /></div>
            {can('admin.purchases.write') && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreate(true)}>{t('adm.newPurchase')}</Button>
            )}
          </div>
        </div>

        {orders.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<ShoppingCart size={26} />} /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{lang === 'ar' ? 'رقم الأمر' : 'PO number'}</th><th>{t('c.date')}</th>
                <th>{t('adm.suppliers')}</th><th className="text-end">{lang === 'ar' ? 'الأصناف' : 'Items'}</th>
                <th className="text-end">{t('acc.total')}</th><th className="text-end">{lang === 'ar' ? 'المدفوع' : 'Paid'}</th>
                <th className="text-end">{lang === 'ar' ? 'المتبقي' : 'Due'}</th>
                <th>{t('c.status')}</th><th>{t('c.actions')}</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num text-xs font-bold">{o.order_no}</td>
                    <td className="text-xs">{fmtDate(o.ordered_at, lang)}</td>
                    <td className="max-w-[180px] truncate text-xs font-semibold">{o.supplier}</td>
                    <td className="num text-end text-xs">{o.item_count ?? '—'}</td>
                    <td className="num text-end text-xs font-bold">{money(o.total, 'SAR', lang)}</td>
                    <td className="num text-end text-xs">{money(o.paid, 'SAR', lang)}</td>
                    <td className="num text-end text-xs font-bold text-red-500">{money(Math.max(0, o.total - o.paid), 'SAR', lang)}</td>
                    <td><StatusPill status={o.status === 'received' ? 'delivered' : o.status} lang={lang} /></td>
                    <td><Button size="sm" variant="ghost" onClick={() => setView(o)}>{t('prod.details')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ViewModal order={view} onClose={() => setView(null)} />
      <CreateModal open={create} suppliers={suppliers} onClose={() => setCreate(false)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

function ViewModal({ order, onClose }: { order: Row | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const items = useQuery(() => q<Row>(
    `SELECT pi.*, p.name_ar, p.name_en, p.sku FROM purchase_items pi JOIN products p ON p.id=pi.product_id WHERE pi.order_id=?`,
    [order?.id ?? 0]), [order?.id]);
  if (!order) return null;
  return (
    <Modal open onClose={onClose} title={`${t('adm.newPurchase')} ${order.order_no}`} size="lg">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label={t('adm.suppliers')} value={order.supplier ?? '—'} />
        <Mini label={t('c.date')} value={fmtDate(order.ordered_at, lang)} />
        <Mini label={t('acc.total')} value={money(order.total, 'SAR', lang)} />
        <Mini label={lang === 'ar' ? 'المتبقي' : 'Due'} value={money(order.total - order.paid, 'SAR', lang)} />
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>{t('adm.products')}</th><th>{t('prod.sku')}</th><th className="text-end">{t('prod.qty')}</th><th className="text-end">{t('adm.cost')}</th><th className="text-end">{t('acc.total')}</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="text-xs font-semibold">{lang === 'ar' ? i.name_ar : i.name_en}</td>
                <td className="num text-xs">{i.sku}</td>
                <td className="num text-end text-xs">{num(i.qty, lang)}</td>
                <td className="num text-end text-xs">{money(i.unit_cost, 'SAR', lang)}</td>
                <td className="num text-end text-xs font-bold">{money(i.line_total, 'SAR', lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CreateModal({ open, suppliers, onClose, onDone }: {
  open: boolean; suppliers: Row[]; onClose: () => void; onDone: (m: string) => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [supplier, setSupplier] = useState<number | ''>('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState('');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<any[]>([]);
  const [pick, setPick] = useState('');

  const products = useQuery(() => q<Row>(
    `SELECT id, sku, name_ar, name_en, cost_price, qty FROM products
     WHERE is_service=0 AND is_active=1 ${search ? 'AND (name_ar LIKE ? OR name_en LIKE ? OR sku LIKE ?)' : ''} LIMIT 25`,
    search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []), [search, open]);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const add = (pid: number) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    setLines((ls) => [...ls, { product_id: p.id, name: lang === 'ar' ? p.name_ar : p.name_en, sku: p.sku, qty: 1, unit_cost: p.cost_price }]);
    setPick('');
  };

  const save = () => {
    if (!supplier) { onDone(lang === 'ar' ? 'اختر المورد' : 'Choose a supplier'); return; }
    if (!lines.length) { onDone(lang === 'ar' ? 'أضف صنفاً واحداً على الأقل' : 'Add at least one item'); return; }
    try {
      const id = createPurchase({
        partner_id: Number(supplier), user_id: user?.id ?? null, branch_id: 3,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, unit_price: l.unit_cost })),
        paid: parseFloat(paid || '0'), supplier_ref: ref || undefined, note: note || undefined,
      });
      const po = q<Row>('SELECT order_no FROM purchase_orders WHERE id=?', [id])[0];
      onDone(`${po.order_no} — ${money(total, 'SAR', lang)}`);
      onClose(); setLines([]); setRef(''); setNote(''); setPaid('');
    } catch (e: any) { onDone(String(e.message ?? e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('adm.newPurchase')} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button>
        <Button onClick={save} disabled={!lines.length}>{t('adm.save')} · {money(total, 'SAR', lang)}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('adm.suppliers')} required>
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value ? +e.target.value : '')}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label={lang === 'ar' ? 'مرجع المورد' : 'Supplier ref'}>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
        </Field>
        <Field label={lang === 'ar' ? 'المدفوع الآن' : 'Paid now'}>
          <Input value={paid} onChange={(e) => setPaid(e.target.value)} dir="ltr" inputMode="decimal" placeholder="0" />
        </Field>
      </div>

      <div className="mt-4">
        <Field label={lang === 'ar' ? 'إضافة صنف' : 'Add item'}>
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} />
            <Select value={pick} onChange={(e) => add(+e.target.value)} className="w-56">
              <option value="">—</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {lang === 'ar' ? p.name_ar : p.name_en}</option>)}
            </Select>
          </div>
        </Field>
      </div>

      {lines.length > 0 && (
        <div className="mt-4 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5 dark:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{l.name}</p>
                <p className="num text-[10px] text-ink-400">{l.sku}</p>
              </div>
              <Input value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: +e.target.value || 1 } : x))}
                className="w-16 !py-1.5 text-center" inputMode="numeric" dir="ltr" />
              <Input value={l.unit_cost} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, unit_cost: +e.target.value || 0 } : x))}
                className="w-24 !py-1.5" inputMode="decimal" dir="ltr" />
              <span className="num w-24 text-end text-xs font-bold">{money(l.qty * l.unit_cost, 'SAR', lang)}</span>
              <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-ink-400 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-ink-50 p-4 dark:bg-white/5">
        <div className="flex justify-between text-xs"><span className="text-ink-500">{t('cart.subtotal')}</span><span className="num font-bold">{money(subtotal, 'SAR', lang)}</span></div>
        <div className="mt-1 flex justify-between text-xs"><span className="text-ink-500">{t('cart.vat')} 15%</span><span className="num font-bold">{money(vat, 'SAR', lang)}</span></div>
        <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 font-bold dark:border-white/10"><span>{t('acc.total')}</span><span className="num text-brand-600 dark:text-brand-400">{money(total, 'SAR', lang)}</span></div>
      </div>

      <div className="mt-3">
        <Field label={lang === 'ar' ? 'ملاحظات' : 'Notes'}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[60px]" />
        </Field>
      </div>
    </Modal>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-center dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold">{value}</p>
    </div>
  );
}
