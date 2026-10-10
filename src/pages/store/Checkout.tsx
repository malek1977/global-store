/* =====================================================================
 *  Storefront — checkout (creates a real sale + journal entry)
 * ===================================================================== */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Banknote, Wallet, Check, ShieldCheck, ShoppingBag, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useCart, useQuery } from '../../app/state';
import { Button, Field, Input, Textarea, EmptyState, useToast, Badge } from '../../ui/primitives';
import { money } from '../../lib/format';
import { createSale } from '../../ops/commerce';
import { q, insert, type Row } from '../../db/db';

export default function Checkout() {
  const { t, lang } = useI18n();
  const cart = useCart();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<'cash' | 'card' | 'bank'>('card');

  const [form, setForm] = useState({
    name: '', phone: '', email: '', city: 'الرياض', address: '', note: '',
  });

  const cities = useQuery(() => q<Row>(
    `SELECT DISTINCT city FROM partners WHERE city IS NOT NULL AND city<>'' UNION
     SELECT 'الرياض' UNION SELECT 'جدة' UNION SELECT 'الدمام' UNION SELECT 'مكة' UNION SELECT 'المدينة' UNION SELECT 'بريدة' UNION SELECT 'تبوك'`
  ), []);

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="surface"><EmptyState title={t('cart.empty')} sub={t('cart.empty.d')} icon={<ShoppingBag size={28} />}
          action={<Link to="/products" className="btn-primary mt-2">{t('cart.continue')}</Link>} /></div>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 3) e.name = t('checkout.nameReq');
    if (!/^05\d{8}$/.test(form.phone.replace(/[\s-]/g, ''))) e.phone = t('checkout.phoneReq');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = t('checkout.emailReq');
    if (!form.city) e.city = t('checkout.city');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const partner = ensurePartner(form.name, form.phone, form.email, form.city);
      const orderId = createSale({
        partner_id: partner,
        channel: 'online',
        branch_id: 1,
        items: cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.price })),
        paid: method === 'cash' ? 0 : cart.total,
        method: method === 'cash' ? 'cash' : method === 'card' ? 'card' : 'bank',
        ship: { name: form.name, phone: form.phone, city: form.city, address: form.address },
        note: form.note,
      });
      cart.clear();
      const row = q<Row>('SELECT order_no FROM sales_orders WHERE id=?', [orderId])[0];
      toast.push({ kind: 'success', title: t('checkout.success'), body: row?.order_no });
      nav(`/order/${row?.order_no ?? orderId}`, { replace: true });
    } catch (err: any) {
      toast.push({ kind: 'error', title: t('c.error'), body: err?.message ?? String(err) });
      setBusy(false);
    }
  };

  const METHODS = [
    { id: 'card', Icon: CreditCard, l: t('acc.card'), d: lang === 'ar' ? 'فيزا / ماستركارد / مدى' : 'Visa / Mastercard / Mada' },
    { id: 'cash', Icon: Banknote, l: t('acc.cash'), d: lang === 'ar' ? 'الدفع عند الاستلام' : 'Pay on delivery' },
    { id: 'bank', Icon: Wallet, l: t('acc.bank'), d: lang === 'ar' ? 'تحويل بنكي' : 'Bank transfer' },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-7 text-2xl font-extrabold tracking-tight sm:text-3xl">{t('checkout.title')}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold"><span className="num grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs text-white">1</span>{t('checkout.contact')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('checkout.name')} required error={errors.name}>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={lang === 'ar' ? 'محمد عبدالله' : 'John Smith'} />
              </Field>
              <Field label={t('checkout.phone')} required error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0551234567" dir="ltr" inputMode="tel" />
              </Field>
              <Field label={t('checkout.email')} error={errors.email}>
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" dir="ltr" type="email" />
              </Field>
              <Field label={t('checkout.city')} required>
                <select value={form.city} onChange={(e) => set('city', e.target.value)} className="input">
                  {cities.map((c: any) => <option key={c.city} value={c.city}>{c.city}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('checkout.address')} hint={lang === 'ar' ? 'الحي، الشارع، رقم المبنى' : 'District, street, building'}>
                  <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} className="min-h-[70px]" />
                </Field>
              </div>
            </div>
          </div>

          <div className="surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold"><span className="num grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs text-white">2</span>{t('checkout.payment')}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {METHODS.map(({ id, Icon, l, d }) => (
                <button key={id} onClick={() => setMethod(id)}
                  className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-start transition ${
                    method === id ? 'border-brand-500 bg-brand-500/[0.06]' : 'border-ink-100 hover:border-brand-300 dark:border-white/10'}`}>
                  <Icon size={20} className={method === id ? 'text-brand-500' : 'text-ink-400'} />
                  <div>
                    <p className="text-sm font-bold">{l}</p>
                    <p className="text-[11px] text-ink-500">{d}</p>
                  </div>
                  {method === id && <Check size={16} className="ms-auto text-brand-500" />}
                </button>
              ))}
            </div>
            {method === 'cash' && (
              <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                {lang === 'ar' ? 'سيتم تجهيز الطلب وتأكيده معك هاتفياً قبل الشحن.' : 'We will call you to confirm before dispatch.'}
              </p>
            )}
          </div>

          <div className="surface p-5 sm:p-6">
            <Field label={lang === 'ar' ? 'ملاحظات' : 'Notes'} hint={t('c.optional')}>
              <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} className="min-h-[70px]" />
            </Field>
          </div>
        </div>

        {/* summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5">
            <h2 className="mb-4 font-bold">{t('cart.title')}</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {cart.items.map((i) => (
                <div key={i.product_id} className="flex items-center gap-3 text-sm">
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-[11px] font-bold text-brand-700 dark:text-brand-300">{i.qty}×</span>
                  <span className="min-w-0 flex-1 truncate">{lang === 'ar' ? i.name : i.nameEn}</span>
                  <span className="num shrink-0 font-semibold">{money(i.price * i.qty, 'SAR', lang)}</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.subtotal')}</dt><dd className="num font-semibold">{money(cart.subtotal, 'SAR', lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.vat')}</dt><dd className="num font-semibold">{money(cart.vat, 'SAR', lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">{t('cart.shipping')}</dt><dd className="font-bold text-signal-600 dark:text-signal-400">{t('cart.free')}</dd></div>
            </dl>
            <div className="divider" />
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{t('cart.total')}</span>
              <span className="num text-xl font-extrabold text-brand-600 dark:text-brand-400">{money(cart.total, 'SAR', lang)}</span>
            </div>

            <Button size="lg" className="mt-5 w-full" loading={busy} onClick={submit}>
              {busy ? <><Loader2 size={17} className="animate-spin" /> {t('c.loading')}</> : t('checkout.place')}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
              <ShieldCheck size={12} className="text-signal-500" /> {t('feat.warranty')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reuse an existing customer by phone, or register a walk-in customer. */
function ensurePartner(name: string, phone: string, email: string, city: string): number | null {
  const clean = phone.replace(/\D/g, '');
  const found = q<{ id: number }>('SELECT id FROM partners WHERE REPLACE(REPLACE(phone," ",""),"-","")=? AND kind IN ("customer","both") LIMIT 1', [clean])[0];
  if (found) return found.id;
  const code = `C-W${String(Date.now()).slice(-6)}`;
  return insert('partners', {
    code, kind: 'customer', name, email: email || null, phone,
    city, credit_limit: 0, payment_terms: 0, segment: 'retail', balance: 0, loyalty_points: 0, is_active: 1,
  });
}
