/* =====================================================================
 *  Storefront layout — public site shell with cart drawer
 * ===================================================================== */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Search, X, Menu, Sun, Moon, Globe, Wrench, Package, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, Trash2, Minus, Plus, ArrowRight, Share2, MessageCircle, Send, AtSign,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useCart, useTheme, useCompany, useQuery } from '../app/state';
import { Button, Logo, Badge, EmptyState } from '../ui/primitives';
import { money } from '../lib/format';
import { q } from '../db/db';

export default function StoreLayout() {
  const { t, lang, toggleLang, isRTL } = useI18n();
  const { theme, toggle } = useTheme();
  const cart = useCart();
  const co = useCompany();
  const [menu, setMenu] = useState(false);
  const [qText, setQText] = useState('');
  const nav = useNavigate();

  useEffect(() => { document.body.style.overflow = menu || cart.open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [menu, cart.open]);

  const categories = useQuery(() => q<any>('SELECT * FROM categories ORDER BY sort'), []);
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/products', label: t('nav.store') },
    { to: '/repair', label: t('nav.repair') },
    { to: '/track', label: t('nav.track') },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-950">
      {/* ------------------------------------------------------------ top */}
      <div className="bg-ink-900 py-2 text-white dark:bg-black/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 text-[11px] font-semibold sm:px-6">
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
            {lang === 'ar' ? 'شحن مجاني للطلبات فوق 2000 ر.س داخل الرياض' : 'Free shipping over 2,000 SAR in Riyadh'}
          </p>
          <div className="hidden items-center gap-4 sm:flex">
            <a href={`tel:${co.phone ?? ''}`} className="flex items-center gap-1.5 hover:text-brand-300">
              <Phone size={12} /> {co.phone ?? '+966 55 510 0000'}
            </a>
            <Link to="/login" className="hover:text-brand-300">{t('nav.dashboard')}</Link>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- header */}
      <header className="glass-bar sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <button onClick={() => setMenu(true)} className="btn-ghost -ms-2 !px-2 lg:hidden" aria-label="menu">
              <Menu size={20} />
            </button>
            <Link to="/" className="shrink-0"><Logo size={38} withText={false} /></Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-brand-400'
                    }`}>
                  {l.label}
                </NavLink>
              ))}
              <div className="group relative">
                <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:text-brand-600 dark:text-ink-300">
                  {t('nav.categories')}
                </button>
                <div className="invisible absolute start-0 top-full w-64 translate-y-1 rounded-2xl border border-ink-100 bg-white p-2 opacity-0 shadow-lift transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 dark:border-white/10 dark:bg-ink-900">
                  {categories.slice(0, 10).map((c) => (
                    <Link key={c.id} to={`/products?cat=${c.slug}`}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-brand-500/10 dark:text-ink-200 dark:hover:bg-white/5">
                      <span>{lang === 'ar' ? c.name_ar : c.name_en}</span>
                      <Arrow size={13} className="text-ink-300" />
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <form
              onSubmit={(e) => { e.preventDefault(); nav(`/products?q=${encodeURIComponent(qText)}`); }}
              className="relative ms-auto hidden max-w-sm flex-1 md:block"
            >
              <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder={t('nav.search')} className="input h-10 ps-9" />
            </form>

            <div className="ms-auto flex items-center gap-1 md:ms-0">
              <button onClick={toggle} className="btn-ghost !px-2" title={t('c.theme')}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button onClick={toggleLang} className="btn-ghost gap-1.5 !px-2.5" title={t('c.lang')}>
                <Globe size={17} />
                <span className="text-xs font-extrabold">{lang === 'ar' ? 'EN' : 'ع'}</span>
              </button>
              <button onClick={() => cart.setOpen(true)} className="btn-ghost relative !px-2.5" aria-label={t('nav.cart')}>
                <ShoppingBag size={19} />
                {cart.count > 0 && (
                  <span className="num absolute -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {cart.count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* mobile search */}
          <form onSubmit={(e) => { e.preventDefault(); nav(`/products?q=${encodeURIComponent(qText)}`); }} className="relative pb-3 md:hidden">
            <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder={t('nav.search')} className="input h-10 ps-9" />
          </form>
        </div>
      </header>

      {/* ---------------------------------------------------------- main */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* -------------------------------------------------------- footer */}
      <footer className="mt-20 bg-ink-900 text-ink-300 dark:bg-black/50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo size={40} />
              <p className="mt-4 text-sm leading-relaxed text-ink-400">{t('hero.desc')}</p>
              <div className="mt-5 flex gap-2">
                {[
                  { Icon: Share2, href: co.share_url || '#', label: String(co.name_en ?? 'Global Store') },
                  { Icon: MessageCircle, href: `https://wa.me/${String(co.phone ?? '').replace(/\D/g, '')}`, label: 'WhatsApp' },
                  { Icon: Send, href: `mailto:${co.email ?? ''}`, label: 'Email' },
                  { Icon: AtSign, href: '#social', label: 'Social' },
                ].map(({ Icon, href, label }) => (
                  <a key={label} href={href} title={label} aria-label={label} rel="noopener noreferrer"
                     className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-ink-300 transition hover:bg-brand-500 hover:text-white">
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-white">{t('cat.title')}</h4>
              <ul className="space-y-2.5 text-sm">
                {categories.slice(0, 6).map((c) => (
                  <li key={c.id}><Link to={`/products?cat=${c.slug}`} className="transition hover:text-brand-400">{lang === 'ar' ? c.name_ar : c.name_en}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-white">{t('nav.store')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/products" className="hover:text-brand-400">{t('prod.viewAll')}</Link></li>
                <li><Link to="/products?sort=best" className="hover:text-brand-400">{t('prod.bestseller')}</Link></li>
                <li><Link to="/repair" className="hover:text-brand-400">{t('nav.repair')}</Link></li>
                <li><Link to="/track" className="hover:text-brand-400">{t('nav.track')}</Link></li>
                <li><Link to="/login" className="hover:text-brand-400">{t('nav.dashboard')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-white">{t('nav.contact')}</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2.5"><MapPin size={15} className="mt-0.5 shrink-0 text-brand-400" /><span>{co.address_ar ?? 'الرياض'}</span></li>
                <li className="flex items-center gap-2.5"><Phone size={15} className="shrink-0 text-brand-400" /><a href={`tel:${co.phone}`} className="num" dir="ltr">{co.phone}</a></li>
                <li className="flex items-center gap-2.5"><Mail size={15} className="shrink-0 text-brand-400" /><a href={`mailto:${co.email}`}>{co.email}</a></li>
              </ul>
              <div className="mt-5 flex gap-2">
                <Badge tone="brand" icon={<Wrench size={12} />}>{t('repair.warranty30')}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs sm:flex-row">
            <p>© {new Date().getFullYear()} {t('app.name')} — {t('c.footer')}</p>
            <p className="flex items-center gap-2 text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-500" />
              {t('c.demo')} · {t('nav.accounting')} + {t('nav.admin')} + {t('nav.ai')}
            </p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------- mobile drawer */}
      {menu && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMenu(false)} />
          <div className={`absolute top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-lift dark:bg-ink-900 ${isRTL ? 'right-0' : 'left-0'}`}>
            <div className="mb-6 flex items-center justify-between">
              <Logo size={36} />
              <button onClick={() => setMenu(false)} className="btn-ghost !px-2"><X size={20} /></button>
            </div>
            <nav className="space-y-1">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setMenu(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-brand-500/10 dark:text-ink-200">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="divider" />
            <p className="mb-2 px-4 text-[11px] font-bold uppercase tracking-wider text-ink-400">{t('nav.categories')}</p>
            <nav className="space-y-0.5">
              {categories.map((c) => (
                <Link key={c.id} to={`/products?cat=${c.slug}`} onClick={() => setMenu(false)}
                  className="block rounded-xl px-4 py-2.5 text-sm text-ink-600 hover:bg-brand-500/10 dark:text-ink-300">
                  {lang === 'ar' ? c.name_ar : c.name_en}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- cart drawer */}
      {cart.open && (
        <div className="fixed inset-0 z-[95]">
          <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => cart.setOpen(false)} />
          <div className={`absolute top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-lift dark:bg-ink-900 ${isRTL ? 'left-0 border-r' : 'right-0 border-l'} border-ink-100 dark:border-white/10`}>
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-ink-900/95">
              <h3 className="flex items-center gap-2 font-bold">
                <ShoppingBag size={18} className="text-brand-500" />
                {t('cart.title')}
                <Badge tone="brand">{cart.count}</Badge>
              </h3>
              <button onClick={() => cart.setOpen(false)} className="btn-ghost !px-2"><X size={19} /></button>
            </div>

            {cart.items.length === 0 ? (
              <EmptyState title={t('cart.empty')} sub={t('cart.empty.d')} icon={<ShoppingBag size={26} />}
                action={<Button className="mt-2" onClick={() => { cart.setOpen(false); nav('/products'); }}>{t('cart.continue')}</Button>} />
            ) : (
              <>
                <div className="divide-y divide-ink-50 dark:divide-white/5">
                  {cart.items.map((i) => (
                    <div key={i.product_id} className="flex gap-3 p-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink-100 text-lg dark:bg-white/10">
                        <Package size={20} className="text-ink-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{lang === 'ar' ? i.name : i.nameEn}</p>
                        <p className="num mt-0.5 text-xs text-ink-500">{money(i.price, 'SAR', lang)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center rounded-lg border border-ink-200 dark:border-white/12">
                            <button onClick={() => cart.setQty(i.product_id, i.qty - 1)} className="px-2 py-1 text-ink-500 hover:text-brand-600"><Minus size={13} /></button>
                            <span className="num w-8 text-center text-xs font-bold">{i.qty}</span>
                            <button onClick={() => cart.setQty(i.product_id, i.qty + 1)} disabled={i.max > 0 && i.qty >= i.max}
                              className="px-2 py-1 text-ink-500 hover:text-brand-600 disabled:opacity-30"><Plus size={13} /></button>
                          </div>
                          <button onClick={() => cart.remove(i.product_id)} className="text-ink-400 transition hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <p className="num shrink-0 text-sm font-bold">{money(i.price * i.qty, 'SAR', lang)}</p>
                    </div>
                  ))}
                </div>

                <div className="sticky bottom-0 space-y-2.5 border-t border-ink-100 bg-white/95 p-5 backdrop-blur dark:border-white/10 dark:bg-ink-900/95">
                  <Row label={t('cart.subtotal')} value={money(cart.subtotal, 'SAR', lang)} />
                  <Row label={t('cart.vat')} value={money(cart.vat, 'SAR', lang)} />
                  <Row label={t('cart.shipping')} value={t('cart.free')} tone="good" />
                  <div className="divider !my-3" />
                  <Row label={t('cart.total')} value={money(cart.total, 'SAR', lang)} big />
                  <Button size="lg" className="w-full" icon={<ArrowRight size={17} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />}
                    onClick={() => { cart.setOpen(false); nav('/checkout'); }}>
                    {t('cart.checkout')}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => { cart.setOpen(false); nav('/cart'); }}>{t('cart.title')}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'good' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={big ? 'font-bold' : 'text-ink-500'}>{label}</span>
      <span className={`num font-bold ${big ? 'text-base' : ''} ${tone === 'good' ? 'text-signal-600 dark:text-signal-400' : ''}`}>{value}</span>
    </div>
  );
}
