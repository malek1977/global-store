/* =====================================================================
 *  Storefront — order confirmation + printable invoice
 * ===================================================================== */
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Package, Printer, Home, Wrench, Truck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useCompany } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import { Badge, Button, EmptyState } from '../../ui/primitives';
import { money, fmtDateTime } from '../../lib/format';
import { downloadBlob } from '../../lib/format';

export default function OrderConfirm() {
  const { no } = useParams();
  const { t, lang } = useI18n();
  const co = useCompany();

  const order = useQuery(() => q<Row>('SELECT * FROM sales_orders WHERE order_no=? OR id=? LIMIT 1', [no, no])[0], [no]);
  const items = useQuery(() => q<Row>(
    `SELECT si.*, p.name_ar, p.name_en, p.sku FROM sales_items si JOIN products p ON p.id=si.product_id WHERE si.order_id=?`,
    [order?.id ?? 0]), [order?.id]);

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="surface"><EmptyState title={t('track.notFound')} icon={<Package size={26} />}
          action={<Link to="/track" className="btn-primary mt-2">{t('nav.track')}</Link>} /></div>
      </div>
    );
  }

  const invoiceText = () => {
    const L: string[] = [];
    L.push(`${co.name_ar ?? ''} — ${co.name_en ?? ''}`);
    L.push(`${co.address_ar ?? ''} | VAT: ${co.vat_number ?? ''} | ${co.phone ?? ''}`);
    L.push('='.repeat(52));
    L.push(`${lang === 'ar' ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice'}`);
    L.push(`${lang === 'ar' ? 'رقم الفاتورة' : 'Invoice'}: ${order.order_no}`);
    L.push(`${lang === 'ar' ? 'التاريخ' : 'Date'}: ${fmtDateTime(order.placed_at, lang)}`);
    L.push(`${lang === 'ar' ? 'العميل' : 'Customer'}: ${order.ship_name} — ${order.ship_phone ?? ''}`);
    L.push('-'.repeat(52));
    items.forEach((i) => {
      L.push(`${i.name_en}`);
      L.push(`  ${i.qty} x ${i.unit_price.toFixed(2)} = ${i.line_total.toFixed(2)}`);
    });
    L.push('-'.repeat(52));
    L.push(`${lang === 'ar' ? 'المجموع قبل الضريبة' : 'Subtotal'}: ${order.subtotal.toFixed(2)}`);
    L.push(`VAT 15%: ${order.vat_amount.toFixed(2)}`);
    L.push(`${lang === 'ar' ? 'الإجمالي' : 'TOTAL'}: ${order.total.toFixed(2)}`);
    return L.join('\n');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="surface overflow-hidden">
        <div className="bg-gradient-to-br from-signal-500 to-brand-500 p-8 text-center text-white">
          <CheckCircle2 size={48} className="mx-auto mb-3 animate-fade-up" />
          <h1 className="text-xl font-extrabold sm:text-2xl">{t('checkout.success')}</h1>
          <p className="mt-1.5 text-sm opacity-90">{t('checkout.success.d')}</p>
          <p className="num mt-4 inline-block rounded-lg bg-white/20 px-4 py-2 text-sm font-bold">{order.order_no}</p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              { Icon: Package, l: lang === 'ar' ? 'تم استلام الطلب' : 'Order received', v: fmtDateTime(order.placed_at, lang) },
              { Icon: Truck, l: lang === 'ar' ? 'التوصيل المتوقع' : 'Expected delivery', v: lang === 'ar' ? 'خلال 24–48 ساعة' : 'within 24–48h' },
              { Icon: Wrench, l: lang === 'ar' ? 'يحتاج صيانة؟' : 'Need a repair?', v: lang === 'ar' ? 'اطلب عبر الموقع' : 'Book online' },
            ].map(({ Icon, l, v }) => (
              <div key={l} className="rounded-xl bg-ink-50 p-4 text-center dark:bg-white/5">
                <Icon size={18} className="mx-auto mb-2 text-brand-500" />
                <p className="text-xs font-bold">{l}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">{v}</p>
              </div>
            ))}
          </div>

          <div className="divide-y divide-ink-50 rounded-xl border border-ink-100 dark:divide-white/5 dark:border-white/10">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{lang === 'ar' ? i.name_ar : i.name_en}</p>
                  <p className="num text-[11px] text-ink-400">{i.sku} · {i.qty} × {money(i.unit_price, 'SAR', lang)}</p>
                </div>
                <p className="num shrink-0 font-bold">{money(i.line_total, 'SAR', lang)}</p>
              </div>
            ))}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">{t('cart.subtotal')}</dt><dd className="num font-semibold">{money(order.subtotal, 'SAR', lang)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t('cart.vat')} 15%</dt><dd className="num font-semibold">{money(order.vat_amount, 'SAR', lang)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-ink-100 pt-2.5 dark:border-white/10">
              <dt className="font-bold">{t('cart.total')}</dt>
              <dd className="num text-lg font-extrabold text-brand-600 dark:text-brand-400">{money(order.total, 'SAR', lang)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button variant="outline" size="sm" icon={<Printer size={14} />} className="no-print" onClick={() => window.print()}>
              {t('c.print')}
            </Button>
            <Button variant="outline" size="sm" className="no-print"
              onClick={() => downloadBlob(invoiceText(), `${order.order_no}.txt`, 'text/plain;charset=utf-8')}>
              {t('c.export')}
            </Button>
            <Link to="/" className="btn-ghost btn-sm"><Home size={14} /> {t('nav.home')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
