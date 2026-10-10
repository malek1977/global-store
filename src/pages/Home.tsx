/* =====================================================================
 *  Storefront — home / landing
 * ===================================================================== */
import { Link } from 'react-router-dom';
import {
  ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, Wrench, Truck, Tag, Sparkles,
  Smartphone, Headphones, BatteryCharging, Watch, Tablet, Wrench as ToolIcon, Package,
  Cpu, Star, TrendingUp, Sparkle,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useQuery } from '../app/state';
import { q, type Row } from '../db/db';
import { Badge, Button, SectionTitle, Sparkline } from '../ui/primitives';
import { money } from '../lib/format';

const ICONS: Record<string, any> = {
  smartphone: Smartphone, tablet: Tablet, watch: Watch, headphones: Headphones,
  plug: BatteryCharging, shield: ShieldCheck, panel: Cpu, battery: BatteryCharging,
  database: Package, wrench: ToolIcon, phone: Smartphone, package: Package,
};

export default function Home() {
  const { t, lang, isRTL } = useI18n();
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const cats = useQuery(() => q<Row>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.is_active=1) AS n,
            (SELECT MIN(p.retail_price) FROM products p WHERE p.category_id=c.id AND p.is_service=0) AS from_price
     FROM categories c ORDER BY c.sort`), []);

  const bestsellers = useQuery(() => q<Row>(
    `SELECT p.id, p.sku, p.name_ar, p.name_en, p.retail_price, p.qty,
            (SELECT COALESCE(SUM(si.qty),0) FROM sales_items si JOIN sales_orders so ON so.id=si.order_id
             WHERE si.product_id=p.id AND so.status<>'cancelled') AS sold
     FROM products p WHERE p.is_active=1 AND p.retail_price>0 AND p.is_service=0
     ORDER BY sold DESC LIMIT 8`), []);

  const newest = useQuery(() => q<Row>(
    `SELECT id, sku, name_ar, name_en, retail_price, qty, created_at FROM products
     WHERE is_active=1 AND retail_price>0 ORDER BY id DESC LIMIT 8`), []);

  const stats = useQuery(() => q<Row>(
    `SELECT (SELECT COUNT(*) FROM products WHERE is_active=1) AS products,
            (SELECT COUNT(*) FROM brands) AS brands,
            (SELECT COUNT(*) FROM repair_tickets WHERE status<>'cancelled') AS tickets,
            (SELECT COUNT(DISTINCT customer_name) FROM repair_tickets) AS customers`), [1]);

  const deals = useQuery(() => q<Row>(
    `SELECT id, sku, name_ar, name_en, retail_price, cost_price, qty FROM products
     WHERE is_active=1 AND is_service=0 AND qty > 0
       AND (cost_price*1.35) > retail_price
     ORDER BY (retail_price - cost_price*1.35) DESC LIMIT 4`), []);

  const repairHighlight = useQuery(() => q<Row>(
    `SELECT ticket_no, device_brand, device_model, status, ai_eta_hours FROM repair_tickets
     WHERE status NOT IN ('delivered','cancelled') ORDER BY intake_at DESC LIMIT 3`), []);

  return (
    <div>
      {/* ============================================================ hero */}
      <section className="hero-mesh relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fine bg-grid opacity-[0.35]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="animate-fade-up">
              <Badge tone="brand" icon={<Sparkles size={12} />} className="mb-5">{t('hero.badge')}</Badge>
              <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl dark:text-white">
                {t('hero.title1')}<br />
                <span className="gradient-text">{t('hero.title2')}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-600 dark:text-ink-300">{t('hero.desc')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/products" className="btn-primary btn-lg">
                  {t('hero.cta1')} <Arrow size={18} />
                </Link>
                <Link to="/repair" className="btn-outline btn-lg">{t('hero.cta2')}</Link>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { n: stats[0]?.products ?? 0, l: t('hero.stat.products') },
                  { n: stats[0]?.brands ?? 0, l: t('hero.stat.brands') },
                  { n: stats[0]?.tickets ?? 0, l: t('hero.stat.tickets') },
                  { n: 16, l: t('hero.stat.years') },
                ].map((s) => (
                  <div key={s.l}>
                    <p className="num text-2xl font-extrabold text-brand-600 dark:text-brand-400">+{Number(s.n).toLocaleString('en-US')}</p>
                    <p className="mt-0.5 text-xs font-medium text-ink-500 dark:text-ink-400">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* visual */}
            <div className="relative animate-fade-up [animation-delay:.15s]">
              <div className="relative mx-auto grid max-w-md grid-cols-2 gap-4">
                <div className="surface card-hover col-span-2 overflow-hidden p-0">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-brand-500 to-brand-600 p-5 text-white">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20"><Sparkles size={22} /></div>
                    <div>
                      <p className="text-sm font-extrabold">{lang === 'ar' ? 'محرّك جلوبال الذكي' : 'Global AI Engine'}</p>
                      <p className="text-xs opacity-90">{lang === 'ar' ? 'تحليل لحظي للمبيعات والمخزون' : 'Live sales & inventory intelligence'}</p>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-500">{lang === 'ar' ? 'إيرادات آخر 30 يوماً' : 'Revenue · last 30 days'}</span>
                      <span className="num font-bold text-signal-600 dark:text-signal-400">+18.4%</span>
                    </div>
                    <Sparkline data={[12, 18, 14, 22, 19, 27, 24, 31, 28, 36, 33, 41, 38, 47]} height={64} />
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat label={lang === 'ar' ? 'هامش الربح' : 'Margin'} value="23.6%" tone="good" />
                      <MiniStat label={lang === 'ar' ? 'دقة التنبؤ' : 'Forecast acc.'} value="94.2%" tone="brand" />
                    </div>
                  </div>
                </div>

                {bestSellersSlice(bestsellers, 1).map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} className="surface card-hover p-4">
                    <div className="mb-3 grid h-20 place-items-center rounded-xl bg-ink-100 text-3xl dark:bg-white/5">
                      <Smartphone size={28} className="text-brand-500/70" />
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold leading-snug">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                    <p className="num mt-1.5 text-sm font-extrabold text-brand-600 dark:text-brand-400">{money(p.retail_price, 'SAR', lang)}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Tag, t: t('feat.wholesale'), d: t('feat.wholesale.d'), tone: 'brand' },
            { Icon: Wrench, t: t('feat.repair'), d: t('feat.repair.d'), tone: 'ai' },
            { Icon: ShieldCheck, t: t('feat.warranty'), d: t('feat.warranty.d'), tone: 'good' },
            { Icon: Truck, t: t('feat.delivery'), d: t('feat.delivery.d'), tone: 'info' },
          ].map(({ Icon, t: title, d, tone }) => (
            <div key={title} className="surface card-hover p-6">
              <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${
                tone === 'brand' ? 'bg-brand-500/15 text-brand-600' :
                tone === 'ai' ? 'bg-brand-500/15 text-ai-600' :
                tone === 'good' ? 'bg-brand-500/15 text-signal-600' : 'bg-brand-500/15 text-sky-600'}`}>
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-ink-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================== categories */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionTitle title={t('cat.title')} sub={t('cat.sub')}
          action={<Link to="/products" className="link text-sm">{t('cat.viewAll')} →</Link>} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cats.map((c) => {
            const Icon = ICONS[c.icon] ?? Package;
            return (
              <Link key={c.id} to={`/products?cat=${c.slug}`} className="surface card-hover group p-5 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-600 transition group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white dark:text-brand-400">
                  <Icon size={22} />
                </div>
                <p className="text-sm font-bold leading-tight">{lang === 'ar' ? c.name_ar : c.name_en}</p>
                <p className="mt-1 text-[11px] text-ink-400">{c.n} {lang === 'ar' ? 'صنف' : 'items'}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ========================================================== deals */}
      {deals.length > 0 && (
        <section className="bg-gradient-to-br from-ink-900 to-ink-950 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionTitle title={t('prod.wholesale')} sub={lang === 'ar' ? 'عروض محدودة على أصناف مختارة' : 'Limited offers on selected items'}
              action={<Link to="/products?sort=priceAsc" className="link text-sm text-brand-400">{t('prod.viewAll')} →</Link>} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deals.map((p) => {
                const off = Math.round(((p.cost_price * 1.35 - p.retail_price) / (p.cost_price * 1.35)) * 100);
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className="group overflow-hidden rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.08]">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="grid h-14 w-14 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Smartphone size={24} /></div>
                      <Badge tone="bad">{t('prod.save')} {off}%</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="num text-lg font-extrabold text-brand-400">{money(p.retail_price, 'SAR', lang)}</span>
                      <span className="num text-xs text-ink-500 line-through">{money(Math.round(p.cost_price * 1.35), 'SAR', lang)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ==================================================== repair panel */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="surface overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 lg:p-12">
              <Badge tone="ai" icon={<Sparkle size={12} />} className="mb-4">{lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'AI powered'}</Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white">{t('repair.title')}</h2>
              <p className="mt-3 text-ink-600 dark:text-ink-300">{t('repair.sub')}</p>
              <ul className="mt-7 space-y-3">
                {[
                  t('repair.dataCare'),
                  t('repair.warranty30'),
                  t('repair.parts'),
                  t('repair.walkIn'),
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3 text-sm font-medium">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-signal-500/15 text-signal-600">
                      <ShieldCheck size={13} />
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
              <Link to="/repair" className="btn-primary mt-8">{t('repair.book')} <Arrow size={17} /></Link>
            </div>

            <div className="bg-ink-900 p-8 text-white lg:p-12">
              <p className="mb-5 text-xs font-bold uppercase tracking-wider text-ink-400">
                {lang === 'ar' ? 'تذاكر قيد التنفيذ الآن' : 'Live tickets right now'}
              </p>
              <div className="space-y-3">
                {(repairHighlight.length ? repairHighlight : bestSellersSlice(bestsellers, 3)).map((tk: any, i: number) => (
                  <div key={tk.id ?? i} className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ai-500/20 text-ai-300"><Wrench size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="num truncate text-sm font-bold">{tk.ticket_no ?? tk.sku}</p>
                      <p className="truncate text-xs text-ink-400">{tk.device_model ?? tk.name_ar}</p>
                    </div>
                    <Badge tone={tk.status === 'completed' ? 'good' : 'ai'}>
                      {tk.status ?? t('prod.newest')}
                    </Badge>
                  </div>
                ))}
              </div>
              <Link to="/track" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-400 hover:text-brand-300">
                {t('nav.track')} <Arrow size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================== new arrivals */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <SectionTitle title={t('prod.newest')} action={<Link to="/products" className="link text-sm">{t('prod.viewAll')} →</Link>} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {newest.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="surface card-hover overflow-hidden">
              <div className="grid h-32 place-items-center bg-gradient-to-br from-ink-100 to-ink-50 dark:from-white/5 dark:to-transparent">
                <Smartphone size={34} className="text-brand-500/50" />
              </div>
              <div className="p-4">
                <p className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-snug">{lang === 'ar' ? p.name_ar : p.name_en}</p>
                <p className="num mt-2 text-sm font-extrabold text-brand-600 dark:text-brand-400">{money(p.retail_price, 'SAR', lang)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ==================================================== bestsellers */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionTitle title={t('prod.bestseller')} action={<Link to="/products?sort=best" className="link text-sm">{t('prod.viewAll')} →</Link>} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {bestsellers.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="surface card-hover group p-4">
              <div className="relative mb-3 grid h-28 place-items-center overflow-hidden rounded-xl bg-ink-100 dark:bg-white/5">
                <Smartphone size={32} className="text-brand-500/40 transition group-hover:scale-110 group-hover:text-brand-500" />
                {p.qty <= 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-red-500 py-1 text-center text-[10px] font-bold text-white">{t('prod.outOfStock')}</span>
                )}
                {p.qty > 0 && p.qty <= 5 && (
                  <span className="absolute inset-x-0 bottom-0 bg-amber-500 py-1 text-center text-[10px] font-bold text-white">{p.qty} {lang === 'ar' ? 'متبقٍ' : 'left'}</span>
                )}
              </div>
              <p className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-snug">{lang === 'ar' ? p.name_ar : p.name_en}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="num text-sm font-extrabold text-brand-600 dark:text-brand-400">{money(p.retail_price, 'SAR', lang)}</span>
                {Number(p.sold) > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-ink-400">
                    <TrendingUp size={11} className="text-signal-500" /> {p.sold}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ========================================================= brands */}
      <section className="border-t border-ink-100 bg-white py-14 dark:border-white/10 dark:bg-ink-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-8 text-center text-xs font-bold uppercase tracking-[.2em] text-ink-400">{t('brand.title')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {q<Row>('SELECT name_en, name_ar FROM brands ORDER BY name_en LIMIT 14').map((b) => (
              <span key={b.name_en} className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink-300 transition hover:text-brand-500 dark:text-ink-600">
                <Star size={14} className="text-brand-400" /> {lang === 'ar' ? b.name_ar : b.name_en}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================== cta */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-10 text-white shadow-lift sm:p-14">
          <div className="absolute inset-0 bg-grid-fine bg-grid opacity-20" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                {lang === 'ar' ? 'تعمل بجدارتك؟ ادخل إلى أنظمة جلوبال ستور' : 'Run a shop? Step into the Global Store systems'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                {lang === 'ar'
                  ? 'نظام محاسبي متكامل، إدارة مخزون، ورشة صيانة، ومساعد ذكاء اصطناعي — كلها مترابطة ومهيأة بالعربية والإنجليزية.'
                  : 'A complete accounting suite, inventory management, a repair workshop and an AI assistant — all interlinked, fully bilingual.'}
              </p>
            </div>
            <Link to="/login" className="btn btn-lg bg-white text-brand-700 hover:bg-ink-50">
              {t('nav.login')} <Arrow size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function bestSellersSlice(rows: any[], n: number) {
  return rows.slice(0, n);
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'good' | 'brand' }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 dark:bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`num mt-1 text-lg font-extrabold ${tone === 'good' ? 'text-signal-600 dark:text-signal-400' : 'text-brand-600 dark:text-brand-400'}`}>{value}</p>
    </div>
  );
}
