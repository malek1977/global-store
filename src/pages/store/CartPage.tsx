/* =====================================================================
 *  Storefront — cart page
 * ===================================================================== */
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, Minus, Plus, Package, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useCart } from '../../app/state';
import { Button, EmptyState, Badge } from '../../ui/primitives';
import { money } from '../../lib/format';

export default function CartPage() {
  const { t, lang, isRTL } = useI18n();
  const cart = useCart();
  const nav = useNavigate();
  const Arrow = isRTL ? null : ArrowRight;

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="surface">
          <EmptyState title={t('cart.empty')} sub={t('cart.empty.d')} icon={<ShoppingBag size={28} />}
            action={<Link to="/products" className="btn-primary mt-2">{t('cart.continue')}</Link>} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('cart.title')}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="surface divide-y divide-ink-50 overflow-hidden dark:divide-white/5">
          {cart.items.map((i) => (
            <div key={i.product_id} className="flex gap-4 p-4 sm:p-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-ink-100 dark:bg-white/5">
                <Package size={26} className="text-ink-400" />
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${i.product_id}`} className="text-sm font-bold leading-snug hover:text-brand-600">
                  {lang === 'ar' ? i.name : i.nameEn}
                </Link>
                <p className="num mt-1 text-xs text-ink-500">{money(i.price, 'SAR', lang)}</p>
                {i.max > 0 && <p className="num mt-0.5 text-[10px] text-ink-400">{i.max} {lang === 'ar' ? 'متوفر' : 'available'}</p>}

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-ink-200 dark:border-white/12">
                    <button onClick={() => cart.setQty(i.product_id, i.qty - 1)} className="px-2.5 py-1.5 text-ink-500 hover:text-brand-600"><Minus size={14} /></button>
                    <span className="num w-9 text-center text-sm font-bold">{i.qty}</span>
                    <button onClick={() => cart.setQty(i.product_id, i.qty + 1)} disabled={i.max > 0 && i.qty >= i.max}
                      className="px-2.5 py-1.5 text-ink-500 hover:text-brand-600 disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => cart.remove(i.product_id)} className="text-ink-400 transition hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="num shrink-0 self-start text-base font-extrabold">{money(i.price * i.qty, 'SAR', lang)}</p>
            </div>
          ))}
          <div className="flex justify-between p-4 sm:p-5">
            <Link to="/products" className="text-sm font-bold text-brand-600 hover:underline">← {t('cart.continue')}</Link>
            <button onClick={cart.clear} className="text-xs font-semibold text-ink-400 hover:text-red-500">{t('cart.remove')} {lang === 'ar' ? 'الكل' : 'all'}</button>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="mb-4 font-bold">{t('cart.total')}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.subtotal')}</dt><dd className="num font-semibold">{money(cart.subtotal, 'SAR', lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.vat')}</dt><dd className="num font-semibold">{money(cart.vat, 'SAR', lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.shipping')}</dt><dd className="font-bold text-signal-600 dark:text-signal-400">{t('cart.free')}</dd></div>
              <div className="divider !my-2" />
              <div className="flex items-baseline justify-between"><dt className="font-bold">{t('cart.total')}</dt><dd className="num text-xl font-extrabold text-brand-600 dark:text-brand-400">{money(cart.total, 'SAR', lang)}</dd></div>
            </dl>

            <Button size="lg" className="mt-5 w-full" onClick={() => nav('/checkout')}>{t('cart.checkout')}</Button>

            <div className="mt-5 space-y-2.5 border-t border-ink-100 pt-4 dark:border-white/10">
              <p className="flex items-center gap-2 text-xs text-ink-500"><ShieldCheck size={14} className="text-signal-500" /> {t('feat.warranty')}</p>
              <p className="flex items-center gap-2 text-xs text-ink-500"><Truck size={14} className="text-sky-500" /> {t('feat.delivery')}</p>
            </div>
            <Badge tone="brand" className="mt-4">{cart.count} {t('cart.items')}</Badge>
          </div>
        </div>
      </div>
      {Arrow && <span className="hidden" />}
    </div>
  );
}
