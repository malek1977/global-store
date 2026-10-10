/* =====================================================================
 *  Storefront — product detail
 * ===================================================================== */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ShoppingBag, Minus, Plus, ShieldCheck, Truck, Wrench, Check, Package, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useCart } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import { Badge, Button, Loading, EmptyState } from '../../ui/primitives';
import { money } from '../../lib/format';
import { ProductCard } from './Catalog';

export default function ProductPage() {
  const { id } = useParams();
  const { t, lang, isRTL } = useI18n();
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<'specs' | 'desc'>('specs');

  const p = useQuery(() => one<Row>(
    `SELECT p.*, c.name_ar AS cat_ar, c.name_en AS cat_en, c.slug AS cat_slug,
            b.name_ar AS brand_ar, b.name_en AS brand_en
     FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
     WHERE p.id=? AND p.is_active=1`, [+id!]) as Row | null, [id]);

  const tiers = useQuery(() => q<Row>(
    'SELECT * FROM price_lists WHERE product_id=? ORDER BY min_qty', [+id!]), [id]);

  const related = useQuery(() => q<Row>(
    `SELECT p.*, (SELECT COALESCE(SUM(si.qty),0) FROM sales_items si WHERE si.product_id=p.id) AS sold
     FROM products p WHERE p.category_id=? AND p.id<>? AND p.is_active=1 LIMIT 4`,
    [p?.category_id ?? 0, +id!]), [p?.category_id, id]);

  const sold = useQuery(() => q<Row>(
    `SELECT COALESCE(SUM(si.qty),0) AS units FROM sales_items si
     JOIN sales_orders so ON so.id=si.order_id WHERE si.product_id=? AND so.status<>'cancelled'`, [+id!]), [id]);

  if (!p) return <div className="mx-auto max-w-4xl py-20"><EmptyState title={t('prod.noResults')} icon={<Package size={26} />} /></div>;

  const out = p.qty <= 0;
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const savings = Math.max(0, (p.retail_price - p.wholesale_price) * qty);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-600">{t('nav.home')}</Link><span>/</span>
        <Link to="/products" className="hover:text-brand-600">{t('nav.store')}</Link><span>/</span>
        {p.cat_slug && <><Link to={`/products?cat=${p.cat_slug}`} className="hover:text-brand-600">{lang === 'ar' ? p.cat_ar : p.cat_en}</Link><span>/</span></>}
        <span className="font-semibold text-ink-800 dark:text-ink-200">{lang === 'ar' ? p.name_ar : p.name_en}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ------------------------------------------------------ visual */}
        <div>
          <div className="surface grid aspect-square place-items-center overflow-hidden bg-gradient-to-br from-ink-100 via-white to-ink-50 dark:from-white/[0.06] dark:via-ink-900 dark:to-transparent">
            <Package size={110} className="text-brand-500/25" />
            <div className="absolute flex gap-2 p-5">
              {p.condition !== 'new' && <Badge tone="info">{p.condition === 'refurbished' ? (lang === 'ar' ? 'مجدّد' : 'Refurbished') : (lang === 'ar' ? 'مستعمل' : 'Used')}</Badge>}
              {p.warranty_months > 0 && <Badge tone="good" icon={<ShieldCheck size={12} />}>{p.warranty_months} {lang === 'ar' ? 'شهر ضمان' : 'mo warranty'}</Badge>}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- detail */}
        <div>
          {p.brand_ar && <p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-brand-600 dark:text-brand-400">{lang === 'ar' ? p.brand_ar : p.brand_en}</p>}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-3xl dark:text-white">
            {lang === 'ar' ? p.name_ar : p.name_en}
          </h1>
          <p className="num mt-2 text-xs text-ink-400">{t('prod.sku')}: {p.sku}</p>

          {Number(sold[0]?.units ?? 0) > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500">
              <Check size={14} className="text-signal-500" />
              {lang === 'ar' ? 'تم بيع' : 'Sold'} <span className="num">{sold[0].units}</span> {lang === 'ar' ? 'وحدة' : 'units'}
            </p>
          )}

          <div className="surface mt-6 p-5">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="num text-3xl font-extrabold text-brand-600 dark:text-brand-400">{money(p.retail_price, 'SAR', lang)}</p>
              {p.wholesale_price > 0 && (
                <div className="ms-auto text-end">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('prod.wholesaleFrom')}</p>
                  <p className="num text-lg font-bold text-signal-600 dark:text-signal-400">{money(p.wholesale_price, 'SAR', lang)}</p>
                </div>
              )}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <Package size={13} />
              {t('cart.vat')} (15%) — {money(p.retail_price * 0.15, 'SAR', lang)}
            </p>

            {/* stock */}
            <div className="mt-4 flex items-center gap-2">
              {out ? <Badge tone="bad">{t('prod.outOfStock')}</Badge>
                : p.qty <= p.reorder_level ? <Badge tone="warn">{t('prod.lowStock')} — {p.qty}</Badge>
                : <Badge tone="good" icon={<Check size={12} />}>{t('prod.inStock')} — {p.qty}</Badge>}
            </div>

            {/* tier pricing */}
            {tiers.filter((x) => x.tier === 'wholesale').length > 0 && (
              <div className="mt-5 rounded-xl bg-ink-50 p-3 dark:bg-white/5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">{lang === 'ar' ? 'أسعار الجملة' : 'Wholesale tiers'}</p>
                <div className="grid gap-1.5">
                  {tiers.filter((x) => x.tier === 'wholesale').map((x) => (
                    <div key={x.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink-500">{lang === 'ar' ? `من ${x.min_qty} قطعة` : `From ${x.min_qty} units`}</span>
                      <span className="num font-bold">{money(x.price, 'SAR', lang)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* qty + add */}
            {!out && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-xl border border-ink-200 dark:border-white/12">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3.5 py-3 text-ink-500 hover:text-brand-600"><Minus size={16} /></button>
                  <input type="number" value={qty} min={1} max={p.qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(p.qty, +e.target.value || 1)))}
                    className="num w-14 border-x border-ink-200 bg-transparent py-3 text-center text-sm font-bold dark:border-white/12" />
                  <button onClick={() => setQty((q) => Math.min(p.qty, q + 1))} className="px-3.5 py-3 text-ink-500 hover:text-brand-600"><Plus size={16} /></button>
                </div>
                <Button
                  size="lg" className="flex-1"
                  icon={<ShoppingBag size={18} />}
                  onClick={() => { cart.add({ id: p.id, qty, price: p.retail_price, name: p.name_ar, nameEn: p.name_en, max: p.qty }); cart.setOpen(true); }}
                >
                  {t('prod.addToCart')}
                </Button>
              </div>
            )}
            {savings > 0 && (
              <p className="mt-3 text-xs font-semibold text-signal-600 dark:text-signal-400">
                {t('prod.save')} {money(savings, 'SAR', lang)} {lang === 'ar' ? 'عند شراء بالجملة' : 'with wholesale pricing'}
              </p>
            )}
          </div>

          {/* assurances */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { Icon: ShieldCheck, l: t('feat.warranty') },
              { Icon: Truck, l: t('feat.delivery') },
              { Icon: Wrench, l: t('feat.repair') },
            ].map(({ Icon, l }) => (
              <div key={l} className="surface flex flex-col items-center gap-1.5 p-3 text-center">
                <Icon size={17} className="text-brand-500" />
                <p className="text-[10px] font-semibold leading-tight text-ink-600 dark:text-ink-300">{l}</p>
              </div>
            ))}
          </div>

          {/* tabs */}
          <div className="mt-7">
            <div className="mb-3 flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-white/5">
              {(['specs', 'desc'] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${tab === k ? 'bg-white text-brand-600 shadow-sm dark:bg-ink-900 dark:text-brand-400' : 'text-ink-500'}`}>
                  {k === 'specs' ? t('prod.specs') : t('prod.details')}
                </button>
              ))}
            </div>
            {tab === 'specs' ? (
              <dl className="surface divide-y divide-ink-50 p-0 dark:divide-white/5">
                {[
                  [t('prod.sku'), p.sku],
                  [t('prod.brand'), lang === 'ar' ? p.brand_ar : p.brand_en],
                  [t('prod.category'), lang === 'ar' ? p.cat_ar : p.cat_en],
                  [t('prod.condition'), p.condition === 'new' ? (lang === 'ar' ? 'جديد' : 'New') : p.condition === 'refurbished' ? (lang === 'ar' ? 'مجدّد' : 'Refurbished') : (lang === 'ar' ? 'مستعمل' : 'Used')],
                  [t('prod.warranty'), `${p.warranty_months} ${lang === 'ar' ? 'شهر' : 'months'}`],
                  [t('cart.vat'), `15%`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-center justify-between px-5 py-3 text-sm">
                    <dt className="text-ink-500">{k as string}</dt>
                    <dd className="font-semibold">{v as string}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="surface p-5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                {lang === 'ar' ? p.desc_ar : p.desc_en}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-extrabold text-ink-900 dark:text-white">
            {t('prod.related')} <Arrow size={16} className="text-brand-500" />
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} p={r} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}
