/* =====================================================================
 *  Administration — inventory (products, movements, valuation)
 * ===================================================================== */
import { useMemo, useState } from 'react';
import {
  Package, Boxes, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Plus, Minus,
  Search as SearchIcon, Wrench, ArrowRightLeft, Layers,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, update, insert, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, StatusPill, Tabs, Textarea, useToast,
} from '../../ui/primitives';
import { money, num, fmtDateTime } from '../../lib/format';
import { lowStock, stockValuation, adjustStock, inventoryTurnover } from '../../ops/commerce';
import { restockSuggestions } from '../../ai/engine';

export default function Inventory() {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('items');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [adjust, setAdjust] = useState<Row | null>(null);

  const cats = useQuery(() => q<Row>('SELECT * FROM categories ORDER BY sort'), []);
  const low = useQuery(() => lowStock(), [tab]);
  const valuation = useQuery(() => stockValuation(), [tab]);
  const turnover = useQuery(() => inventoryTurnover(90), [tab]);
  const restock = useQuery(() => restockSuggestions(), [tab]);

  const products = useQuery(() => {
    const where = ['p.is_active=1'];
    const params: any[] = [];
    if (cat) { where.push('c.slug=?'); params.push(cat); }
    if (search) {
      where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    return q<Row>(
      `SELECT p.*, c.name_ar AS cat_ar, c.name_en AS cat_en, b.name_ar AS brand_ar
       FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
       WHERE ${where.join(' AND ')} ORDER BY p.qty ASC`, params);
  }, [cat, search]);

  const movements = useQuery(() => q<Row>(
    `SELECT sm.*, p.name_ar, p.name_en, p.sku, u.full_name AS staff
     FROM stock_movements sm JOIN products p ON p.id=sm.product_id
     LEFT JOIN users u ON u.id=sm.user_id
     ORDER BY sm.id DESC LIMIT 60`), [tab]);

  const totalValue = products.reduce((s, p) => s + p.qty * p.cost_price, 0);

  const tabs = [
    { id: 'items', label: t('adm.products'), count: products.length },
    { id: 'low', label: lang === 'ar' ? 'تحت الحد' : 'Low stock', count: low.length },
    { id: 'restock', label: lang === 'ar' ? 'اقتراحات الشراء' : 'Reorder AI', count: restock.length },
    { id: 'valuation', label: t('adm.valuation'), count: valuation.length },
    { id: 'moves', label: t('adm.stockMove'), count: movements.length },
  ];

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('adm.products')} value={num(products.length, lang)} icon={<Package size={19} />} tone="brand"
          sub={`${num(products.reduce((s, p) => s + p.qty, 0), lang)} ${lang === 'ar' ? 'وحدة' : 'units'}`} />
        <StatCard label={t('adm.valuation')} value={money(totalValue, 'SAR', lang)} icon={<Boxes size={19} />} tone="good" />
        <StatCard label={lang === 'ar' ? 'تحت حد الطلب' : 'Below reorder'} value={num(low.length, lang)} icon={<AlertTriangle size={19} />} tone="bad" />
        <StatCard label={lang === 'ar' ? 'دوران المخزون' : 'Inventory turns'} value={`${turnover.turns}×`} icon={<ArrowRightLeft size={19} />} tone="info"
          sub={lang === 'ar' ? 'خلال 90 يوم' : 'last 90 days'} />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === 'items' && (
            <div className="ms-auto flex flex-wrap gap-2">
              <div className="w-56"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} /></div>
              <div className="w-40">
                <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">{t('c.all')}</option>
                  {cats.map((c) => <option key={c.id} value={c.slug}>{lang === 'ar' ? c.name_ar : c.name_en}</option>)}
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ items */}
        {tab === 'items' && (
          products.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<Package size={26} />} /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>{t('adm.products')}</th><th>{t('prod.category')}</th><th>{t('prod.sku')}</th>
                  <th className="text-end">{t('adm.onHand')}</th><th className="text-end">{t('adm.reorderAt')}</th>
                  <th className="text-end">{t('adm.cost')}</th><th className="text-end">{t('adm.retail')}</th>
                  <th className="text-end">{t('c.total')}</th><th>{t('c.actions')}</th>
                </tr></thead>
                <tbody>
                  {products.slice(0, 200).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <p className="max-w-[220px] truncate font-semibold">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                        {p.brand_ar && <p className="text-[10px] text-ink-400">{lang === 'ar' ? p.brand_ar : p.brand_en}</p>}
                      </td>
                      <td className="text-xs">{lang === 'ar' ? p.cat_ar : p.cat_en}</td>
                      <td className="num text-xs">{p.sku}</td>
                      <td className="text-end">
                        <span className={`num font-bold ${p.qty <= 0 ? 'text-red-500' : p.qty <= p.reorder_level ? 'text-amber-500' : ''}`}>{num(p.qty, lang)}</span>
                      </td>
                      <td className="num text-end text-xs text-ink-500">{num(p.reorder_level, lang)}</td>
                      <td className="num text-end text-xs">{money(p.cost_price, 'SAR', lang)}</td>
                      <td className="num text-end text-xs">{money(p.retail_price, 'SAR', lang)}</td>
                      <td className="num text-end text-xs font-bold">{money(p.qty * p.cost_price, 'SAR', lang)}</td>
                      <td>
                        {can('admin.inventory.write') && (
                          <button onClick={() => setAdjust(p)} className="btn-ghost btn-sm">
                            <Wrench size={13} /> {t('adm.adjust')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ------------------------------------------------------- low */}
        {tab === 'low' && (
          low.length === 0 ? <EmptyState title={lang === 'ar' ? 'كل الأصناف فوق الحد' : 'All items above reorder level'} icon={<Package size={26} />} /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>{t('adm.products')}</th><th>{t('prod.sku')}</th>
                  <th className="text-end">{t('adm.onHand')}</th><th className="text-end">{t('adm.reorderAt')}</th>
                  <th className="text-end">{t('adm.cost')}</th><th className="text-end">{t('c.total')}</th>
                </tr></thead>
                <tbody>
                  {low.map((p) => (
                    <tr key={p.id}>
                      <td className="max-w-[260px] truncate font-semibold">{lang === 'ar' ? p.name_ar : p.name_en}</td>
                      <td className="num text-xs">{p.sku}</td>
                      <td className="text-end"><Badge tone={p.qty <= 0 ? 'bad' : 'warn'}>{num(p.qty, lang)}</Badge></td>
                      <td className="num text-end text-xs">{num(p.reorder_level, lang)}</td>
                      <td className="num text-end text-xs">{money(p.cost_price, 'SAR', lang)}</td>
                      <td className="num text-end text-xs font-bold text-amber-500">{money(p.qty * p.cost_price, 'SAR', lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* --------------------------------------------------- restock */}
        {tab === 'restock' && (
          restock.length === 0 ? <EmptyState title={lang === 'ar' ? 'لا توجد اقتراحات' : 'No suggestions'} icon={<Package size={26} />} /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>{t('adm.products')}</th><th>{t('prod.brand')}</th>
                  <th className="text-end">{lang === 'ar' ? 'مبيعات 60 يوم' : 'Sold 60d'}</th>
                  <th className="text-end">{t('adm.onHand')}</th>
                  <th className="text-end">{lang === 'ar' ? 'مدة التغطية' : 'Cover'}</th>
                  <th className="text-end">{lang === 'ar' ? 'الكمية المقترحة' : 'Suggested qty'}</th>
                  <th className="text-end">{lang === 'ar' ? 'التكلفة' : 'Cost'}</th>
                </tr></thead>
                <tbody>
                  {restock.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-[240px]">
                        <p className="truncate font-semibold">{lang === 'ar' ? r.name_ar : r.name_en}</p>
                        <p className="num text-[10px] text-ink-400">{r.sku}</p>
                      </td>
                      <td className="text-xs">{r.brand_ar}</td>
                      <td className="num text-end text-xs">{num(r.sold60, lang)}</td>
                      <td className="num text-end text-xs font-bold">{num(r.qty, lang)}</td>
                      <td className="text-end">
                        <Badge tone={r.daysOfCover < 7 ? 'bad' : r.daysOfCover < 20 ? 'warn' : 'good'}>
                          {r.daysOfCover > 900 ? '∞' : `${r.daysOfCover}${lang === 'ar' ? ' يوم' : 'd'}`}
                        </Badge>
                      </td>
                      <td className="num text-end text-xs font-bold text-brand-600 dark:text-brand-400">{num(r.suggestQty, lang)}</td>
                      <td className="num text-end text-xs">{money(r.suggestCost, 'SAR', lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* -------------------------------------------------- valuation */}
        {tab === 'valuation' && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('prod.category')}</th><th className="text-end">{lang === 'ar' ? 'أصناف' : 'SKUs'}</th>
                <th className="text-end">{lang === 'ar' ? 'وحدات' : 'Units'}</th>
                <th className="text-end">{lang === 'ar' ? 'قيمة التكلفة' : 'At cost'}</th>
                <th className="text-end">{lang === 'ar' ? 'قيمة البيع' : 'At retail'}</th>
                <th className="text-end">{lang === 'ar' ? 'ربح محتمل' : 'Potential margin'}</th>
              </tr></thead>
              <tbody>
                {valuation.map((v) => {
                  const margin = v.retail_value ? ((v.retail_value - v.cost_value) / v.retail_value) * 100 : 0;
                  return (
                    <tr key={v.id}>
                      <td className="font-semibold">{lang === 'ar' ? v.name_ar : v.name_en}</td>
                      <td className="num text-end text-xs">{num(v.items, lang)}</td>
                      <td className="num text-end text-xs">{num(v.units, lang)}</td>
                      <td className="num text-end text-xs font-bold">{money(v.cost_value, 'SAR', lang)}</td>
                      <td className="num text-end text-xs">{money(v.retail_value, 'SAR', lang)}</td>
                      <td className="num text-end text-xs font-bold text-signal-600 dark:text-signal-400">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50 font-bold dark:bg-white/5">
                  <td className="px-4 py-3">{t('c.total')}</td>
                  <td className="num px-4 py-3 text-end">{num(valuation.reduce((s, v) => s + v.items, 0), lang)}</td>
                  <td className="num px-4 py-3 text-end">{num(valuation.reduce((s, v) => s + v.units, 0), lang)}</td>
                  <td className="num px-4 py-3 text-end">{money(valuation.reduce((s, v) => s + v.cost_value, 0), 'SAR', lang)}</td>
                  <td className="num px-4 py-3 text-end">{money(valuation.reduce((s, v) => s + v.retail_value, 0), 'SAR', lang)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ----------------------------------------------------- moves */}
        {tab === 'moves' && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('c.date')}</th><th>{t('adm.products')}</th><th>{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="text-end">{t('prod.qty')}</th><th className="text-end">{t('adm.cost')}</th>
                <th>{t('adm.actions')}</th><th>{lang === 'ar' ? 'بواسطة' : 'By'}</th>
              </tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs text-ink-500">{fmtDateTime(m.created_at, lang)}</td>
                    <td className="max-w-[220px] truncate text-xs font-semibold">{lang === 'ar' ? m.name_ar : m.name_en}</td>
                    <td>
                      <Badge tone={m.kind === 'in' ? 'good' : m.kind === 'out' ? 'info' : m.kind === 'damage' ? 'bad' : 'neutral'}>
                        {m.kind === 'in' ? (lang === 'ar' ? 'وارد' : 'In') :
                         m.kind === 'out' ? (lang === 'ar' ? 'صادر' : 'Out') :
                         m.kind === 'return' ? (lang === 'ar' ? 'مرتجع' : 'Return') :
                         m.kind === 'damage' ? (lang === 'ar' ? 'تالف' : 'Damage') : (lang === 'ar' ? 'تسوية' : 'Adjust')}
                      </Badge>
                    </td>
                    <td className={`num text-end text-xs font-bold ${m.qty > 0 ? 'text-signal-600 dark:text-signal-400' : 'text-red-500'}`}>
                      {m.qty > 0 ? '+' : ''}{num(m.qty, lang)}
                    </td>
                    <td className="num text-end text-xs">{money(m.unit_cost, 'SAR', lang)}</td>
                    <td className="text-xs text-ink-500">{m.note ?? '—'}</td>
                    <td className="text-xs">{m.staff ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------ adjust */}
      <AdjustModal product={adjust} onClose={() => setAdjust(null)} onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

function AdjustModal({ product, onClose, onDone }: { product: Row | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [qty, setQty] = useState('');
  const [kind, setKind] = useState('adjust');
  const [note, setNote] = useState('');

  const delta = parseFloat(qty || '0');
  const after = (product?.qty ?? 0) + delta;

  const save = () => {
    if (!product) return;
    try {
      adjustStock({ product_id: product.id, qty_delta: delta, kind, note, user_id: user?.id ?? null });
      onDone(`${product.sku}: ${product.qty} → ${after}`);
      onClose(); setQty(''); setNote('');
    } catch (e: any) {
      onDone(String(e.message ?? e));
    }
  };

  return (
    <Modal open={!!product} onClose={onClose} title={`${t('adm.adjustStock')} — ${product?.sku ?? ''}`}
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button>
        <Button onClick={save} disabled={!delta}>{t('adm.save')}</Button></>}>
      {product && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">{lang === 'ar' ? product.name_ar : product.name_en}</p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('adm.onHand')} value={num(product.qty, lang)} />
            <Stat label={lang === 'ar' ? 'التعديل' : 'Delta'} value={`${delta > 0 ? '+' : ''}${num(delta, lang)}`} tone={delta < 0 ? 'bad' : 'good'} />
            <Stat label={lang === 'ar' ? 'بعد التسوية' : 'After'} value={num(after, lang)} tone="brand" />
          </div>
          <Field label={lang === 'ar' ? 'الكمية (+/−)' : 'Quantity (+/−)'} required>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" dir="ltr" placeholder="+10 / -2" autoFocus />
          </Field>
          <Field label={lang === 'ar' ? 'نوع الحركة' : 'Movement type'}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="adjust">{lang === 'ar' ? 'تسوية جرد' : 'Stock count'}</option>
              <option value="damage">{lang === 'ar' ? 'تالف / مفقود' : 'Damaged / lost'}</option>
              <option value="in">{lang === 'ar' ? 'وارد يدوي' : 'Manual in'}</option>
              <option value="out">{lang === 'ar' ? 'صادر يدوي' : 'Manual out'}</option>
              <option value="warranty">{lang === 'ar' ? 'ضمان (استبدال)' : 'Warranty replacement'}</option>
            </Select>
          </Field>
          <Field label={lang === 'ar' ? 'ملاحظة' : 'Note'}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px]" />
          </Field>
          {after < 0 && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{lang === 'ar' ? 'لا يمكن أن يكون الرصيد سالباً' : 'Balance cannot go negative'}</p>}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'brand' }) {
  const c = { good: 'text-signal-600 dark:text-signal-400', bad: 'text-red-500', brand: 'text-brand-600 dark:text-brand-400' }[tone ?? ''];
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-center dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`num mt-1 text-lg font-extrabold ${c}`}>{value}</p>
    </div>
  );
}
