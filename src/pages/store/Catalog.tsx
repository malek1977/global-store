/* =====================================================================
 *  Storefront — catalogue with filters / search / sorting
 * ===================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Smartphone, Package, ShoppingBag, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useCart } from '../../app/state';
import { q, type Row } from '../../db/db';
import { Badge, Button, EmptyState, Select } from '../../ui/primitives';
import { money } from '../../lib/format';

export default function Catalog() {
  const { t, lang, isRTL } = useI18n();
  const [sp, setSp] = useSearchParams();
  const cart = useCart();
  const [showFilters, setShowFilters] = useState(false);

  const cat = sp.get('cat') ?? '';
  const search = sp.get('q') ?? '';
  const brand = sp.get('brand') ?? '';
  const cond = sp.get('cond') ?? '';
  const sort = sp.get('sort') ?? 'best';
  const [priceMax, setPriceMax] = useState(0);

  const cats = useQuery(() => q<Row>('SELECT * FROM categories ORDER BY sort'), []);
  const brands = useQuery(() => q<Row>('SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id AND p.is_active=1) AS n FROM brands b ORDER BY n DESC'), []);
  const priceCap = useQuery(() => {
    const r = q<Row>('SELECT COALESCE(MAX(retail_price),0) AS m FROM products WHERE is_active=1');
    return Math.ceil((r[0]?.m ?? 5000) / 500) * 500;
  }, []);

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };

  useEffect(() => { if (!priceMax && priceCap) setPriceMax(priceCap as unknown as number); }, [priceCap, priceMax]);

  const rows = useQuery(() => {
    const where: string[] = ['p.is_active=1'];
    const params: any[] = [];
    if (cat) { where.push('c.slug=?'); params.push(cat); }
    if (brand) { where.push('b.slug=?'); params.push(brand); }
    if (cond) { where.push('p.condition=?'); params.push(cond); }
    if (search) {
      where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ? OR p.desc_ar LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (priceMax) { where.push('p.retail_price <= ?'); params.push(priceMax); }
    return q<Row>(
      `SELECT p.*, c.name_ar AS cat_ar, c.name_en AS cat_en, c.slug AS cat_slug, b.name_ar AS brand_ar, b.name_en AS brand_en, b.slug AS brand_slug,
              (SELECT COALESCE(SUM(si.qty),0) FROM sales_items si JOIN sales_orders so ON so.id=si.order_id WHERE si.product_id=p.id AND so.status<>'cancelled') AS sold
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN brands b ON b.id=p.brand_id
       WHERE ${where.join(' AND ')}`, params);
  }, [cat, brand, cond, search, priceMax]);

  const sorted = useMemo(() => {
    const r = [...rows];
    if (sort === 'priceAsc') r.sort((a, b) => a.retail_price - b.retail_price);
    else if (sort === 'priceDesc') r.sort((a, b) => b.retail_price - a.retail_price);
    else if (sort === 'newest') r.sort((a, b) => b.id - a.id);
    else if (sort === 'name') r.sort((a, b) => (lang === 'ar' ? a.name_ar.localeCompare(b.name_ar, 'ar') : a.name_en.localeCompare(b.name_en)));
    else r.sort((a, b) => b.sold - a.sold);
    return r;
  }, [rows, sort, lang]);

  const activeFilters = [cat, brand, cond, search].filter(Boolean).length;
  const activeCat = cats.find((c) => c.slug === cat);

  const Filters = (
    <div className="space-y-6">
      <div>
        <p className="label">{t('prod.category')}</p>
        <div className="space-y-0.5">
          <button onClick={() => setParam('cat', '')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${!cat ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'hover:bg-ink-100 dark:hover:bg-white/5'}`}>
            {t('c.all')} {!cat && <Check size={14} />}
          </button>
          {cats.map((c) => (
            <button key={c.id} onClick={() => setParam('cat', c.slug)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${cat === c.slug ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/5'}`}>
              <span className="truncate">{lang === 'ar' ? c.name_ar : c.name_en}</span>
              {cat === c.slug && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>

      <div className="divider !my-0" />

      <div>
        <p className="label">{t('prod.brand')}</p>
        <div className="max-h-56 space-y-0.5 overflow-y-auto pe-1">
          {brands.filter((b) => b.n > 0).map((b) => (
            <button key={b.id} onClick={() => setParam('brand', b.slug)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition ${brand === b.slug ? 'bg-brand-500/15 font-semibold text-brand-700 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/5'}`}>
              <span className="truncate">{lang === 'ar' ? b.name_ar : b.name_en}</span>
              <span className="text-[10px] text-ink-400">{b.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider !my-0" />

      <div>
        <p className="label">{t('prod.condition')}</p>
        <div className="flex flex-wrap gap-2">
          {[['', 'c.all'], ['new', lang === 'ar' ? 'جديد' : 'New'], ['refurbished', lang === 'ar' ? 'مجدّد' : 'Refurbished'], ['used', lang === 'ar' ? 'مستعمل' : 'Used']].map(([v, l]) => (
            <button key={v} onClick={() => setParam('cond', v)}
              className={`chip ${cond === v ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-600 dark:border-white/12 dark:text-ink-300'}`}>
              {l as string}
            </button>
          ))}
        </div>
      </div>

      <div className="divider !my-0" />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="label !mb-0">{t('prod.price')}</p>
          <span className="num text-xs font-bold text-brand-600 dark:text-brand-400">{money(priceMax, 'SAR', lang, 0)}</span>
        </div>
        <input type="range" min={0} max={priceCap} step={50} value={priceMax}
          onChange={(e) => setPriceMax(+e.target.value)}
          className="w-full accent-brand-500" />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-600">{t('nav.home')}</Link>
        <span>/</span>
        <span className="font-semibold text-ink-800 dark:text-ink-200">
          {activeCat ? (lang === 'ar' ? activeCat.name_ar : activeCat.name_en) : t('nav.store')}
        </span>
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl dark:text-white">
            {activeCat ? (lang === 'ar' ? activeCat.name_ar : activeCat.name_en) : t('nav.store')}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{sorted.length} {t('prod.results')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<SlidersHorizontal size={15} />} className="lg:hidden"
            onClick={() => setShowFilters((v) => !v)}>
            {t('prod.filters')}{activeFilters > 0 && ` (${activeFilters})`}
          </Button>
          <div className="w-48">
            <Select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              <option value="best">{t('prod.sort.best')}</option>
              <option value="newest">{t('prod.sort.newest')}</option>
              <option value="priceAsc">{t('prod.sort.priceAsc')}</option>
              <option value="priceDesc">{t('prod.sort.priceDesc')}</option>
              <option value="name">{t('prod.sort.name')}</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
          <div className="surface sticky top-24 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><SlidersHorizontal size={16} className="text-brand-500" />{t('prod.filters')}</h2>
              {activeFilters > 0 && (
                <button onClick={() => { setSp(new URLSearchParams(), { replace: true }); setPriceMax(priceCap as unknown as number); }}
                  className="text-xs font-bold text-brand-600 hover:underline">{t('prod.clear')}</button>
              )}
            </div>
            {Filters}
          </div>
        </aside>

        <div>
          {sorted.length === 0 ? (
            <div className="surface"><EmptyState title={t('prod.noResults')} sub={t('prod.clear')} icon={<Package size={26} />} /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {sorted.map((p) => (
                <ProductCard key={p.id} p={p} onAdd={() => {
                  cart.add({ id: p.id, qty: 1, price: p.retail_price, name: p.name_ar, nameEn: p.name_en, max: p.qty });
                  cart.setOpen(true);
                }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* mobile filter sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setShowFilters(false)} />
          <div className={`absolute bottom-0 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-ink-900 ${isRTL ? '' : ''}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">{t('prod.filters')}</h3>
              <button onClick={() => setShowFilters(false)}><X size={20} /></button>
            </div>
            {Filters}
            <Button className="mt-6 w-full" onClick={() => setShowFilters(false)}>{t('c.apply')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProductCard({ p, onAdd, compact }: { p: Row; onAdd?: () => void; compact?: boolean }) {
  const { t, lang } = useI18n();
  const cart = useCart();
  const out = p.qty <= 0;
  const low = p.qty > 0 && p.qty <= (p.reorder_level ?? 5);
  const off = p.cost_price > 0 ? Math.round(((p.retail_price - p.cost_price) / p.retail_price) * 100) : 0;

  return (
    <div className="surface card-hover group flex flex-col overflow-hidden">
      <Link to={`/product/${p.id}`} className="relative grid flex-1 place-items-center overflow-hidden bg-gradient-to-br from-ink-100 to-ink-50 p-4 dark:from-white/[0.06] dark:to-transparent">
        <Smartphone size={compact ? 30 : 40} className="text-brand-500/35 transition duration-500 group-hover:scale-110 group-hover:text-brand-500/70" />
        <div className="absolute start-2 top-2 flex flex-col gap-1.5">
          {p.condition && p.condition !== 'new' && <Badge tone="info">{p.condition === 'refurbished' ? (lang === 'ar' ? 'مجدّد' : 'Refurb') : (lang === 'ar' ? 'مستعمل' : 'Used')}</Badge>}
          {off > 0 && off < 80 && <Badge tone="bad">{t('prod.save')} {off}%</Badge>}
        </div>
        {out && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[1px] dark:bg-ink-950/70">
            <span className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white">{t('prod.outOfStock')}</span>
          </span>
        )}
      </Link>

      <div className="flex flex-col p-4">
        {p.brand_ar && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">{lang === 'ar' ? p.brand_ar : p.brand_en}</p>}
        <Link to={`/product/${p.id}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug hover:text-brand-600">
          {lang === 'ar' ? p.name_ar : p.name_en}
        </Link>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="num text-base font-extrabold text-brand-600 dark:text-brand-400">{money(p.retail_price, 'SAR', lang)}</p>
            {p.wholesale_price > 0 && (
              <p className="num text-[10px] text-ink-400">{t('prod.wholesaleFrom')} {money(p.wholesale_price, 'SAR', lang, 0)}</p>
            )}
          </div>
          {low && <Badge tone="warn">{p.qty} {lang === 'ar' ? 'متبقٍ' : 'left'}</Badge>}
        </div>

        <Button size="sm" className="mt-3 w-full" disabled={out}
          icon={<ShoppingBag size={14} />}
          onClick={onAdd ?? (() => {
            cart.add({ id: p.id, qty: 1, price: p.retail_price, name: p.name_ar, nameEn: p.name_en, max: p.qty });
            cart.setOpen(true);
          })}>
          {out ? t('prod.outOfStock') : t('prod.addToCart')}
        </Button>
      </div>
    </div>
  );
}
