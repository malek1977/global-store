/* =====================================================================
 *  Accounting — sales & purchase invoices with printable detail
 * ===================================================================== */
import { useState } from 'react';
import { FileText, Printer, Download, XCircle, Package, Search as SearchIcon } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth, useCompany } from '../../app/state';
import { q, one, type Row } from '../../db/db';
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select,
  StatCard, StatusPill, Tabs, useToast,
} from '../../ui/primitives';
import { money, num, fmtDate, fmtDateTime, downloadBlob } from '../../lib/format';
import { cancelSale } from '../../ops/commerce';

export default function Invoices() {
  const { t, lang } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const co = useCompany();
  const [tab, setTab] = useState('sales');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<Row | null>(null);

  const isSales = tab === 'sales';
  const orders = useQuery(() => {
    const where: string[] = ['1=1'];
    const params: any[] = [];
    if (status) { where.push('o.status=?'); params.push(status); }
    if (search) { where.push('(o.order_no LIKE ? OR p.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (isSales) {
      return q<Row>(
        `SELECT o.*, p.name AS party, p.phone, u.full_name AS staff,
                (SELECT COUNT(*) FROM sales_items i WHERE i.order_id=o.id) AS item_count
         FROM sales_orders o LEFT JOIN partners p ON p.id=o.partner_id LEFT JOIN users u ON u.id=o.user_id
         WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 100`, params);
    }
    return q<Row>(
      `SELECT o.*, p.name AS party, p.phone, u.full_name AS staff,
              (SELECT COUNT(*) FROM purchase_items i WHERE i.order_id=o.id) AS item_count
       FROM purchase_orders o LEFT JOIN partners p ON p.id=o.partner_id LEFT JOIN users u ON u.id=o.user_id
       WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT 100`, params);
  }, [tab, search, status]);

  const totals = {
    count: orders.length,
    value: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
    due: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Math.max(0, o.total - o.paid), 0),
    vat: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.vat_amount, 0),
  };

  const tabs = [
    { id: 'sales', label: t('acc.sales'), count: q<Row>('SELECT COUNT(*) AS v FROM sales_orders')[0]?.v },
    { id: 'purchases', label: t('acc.purchases'), count: q<Row>('SELECT COUNT(*) AS v FROM purchase_orders')[0]?.v },
  ];

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('acc.sales')} value={money(totals.value, 'SAR', lang)} icon={<FileText size={19} />} tone="brand" sub={`${totals.count} ${lang === 'ar' ? 'فاتورة' : 'invoices'}`} />
        <StatCard label={lang === 'ar' ? 'ضريبة محصّلة' : 'VAT collected'} value={money(totals.vat, 'SAR', lang)} tone="info" />
        <StatCard label={lang === 'ar' ? 'مبالغ غير محصّلة' : 'Outstanding'} value={money(totals.due, 'SAR', lang)} tone="bad" />
        <StatCard label={lang === 'ar' ? 'متوسط الفاتورة' : 'Avg invoice'} value={money(totals.count ? totals.value / totals.count : 0, 'SAR', lang)} tone="good" />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="ms-auto flex flex-wrap gap-2">
            <div className="w-52"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t('c.search')}…`} /></div>
            <div className="w-36">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('c.all')}</option>
                <option value="confirmed">{lang === 'ar' ? 'مؤكد' : 'Confirmed'}</option>
                <option value="delivered">{lang === 'ar' ? 'تم التسليم' : 'Delivered'}</option>
                <option value="received">{lang === 'ar' ? 'تم الاستلام' : 'Received'}</option>
                <option value="cancelled">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</option>
              </Select>
            </div>
          </div>
        </div>

        {orders.length === 0 ? <EmptyState title={t('prod.noResults')} icon={<FileText size={26} />} /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice'}</th><th>{t('c.date')}</th>
                <th>{isSales ? t('adm.customer') : t('adm.suppliers')}</th><th>{lang === 'ar' ? 'القناة' : 'Channel'}</th>
                <th className="text-end">{t('acc.total')}</th><th className="text-end">{t('acc.vat')}</th>
                <th className="text-end">{lang === 'ar' ? 'المدفوع' : 'Paid'}</th><th>{t('c.status')}</th>
                <th className="no-print">{t('c.actions')}</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="num text-xs font-bold">{o.order_no}</td>
                    <td className="text-xs">{fmtDate(o.placed_at ?? o.ordered_at, lang)}</td>
                    <td className="max-w-[170px] truncate text-xs font-semibold">{o.party ?? '—'}</td>
                    <td className="text-xs">
                      <Badge tone={o.channel === 'wholesale' ? 'brand' : o.channel === 'online' ? 'ai' : 'info'}>
                        {o.channel === 'wholesale' ? (lang === 'ar' ? 'جملة' : 'Wholesale') : o.channel === 'online' ? (lang === 'ar' ? 'أونلاين' : 'Online') : (lang === 'ar' ? 'تجزئة' : 'Retail')}
                      </Badge>
                    </td>
                    <td className="num text-end text-xs font-bold">{money(o.total, 'SAR', lang)}</td>
                    <td className="num text-end text-xs text-ink-500">{money(o.vat_amount, 'SAR', lang)}</td>
                    <td className="num text-end text-xs">
                      <span className={o.total - o.paid > 0.5 ? 'text-red-500 font-bold' : 'text-signal-600 dark:text-signal-400'}>{money(o.paid, 'SAR', lang)}</span>
                    </td>
                    <td><StatusPill status={o.status === 'received' ? 'delivered' : o.status} lang={lang} /></td>
                    <td className="no-print">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setView(o)}>{t('prod.details')}</Button>
                        {isSales && can('accounting.post') && o.status !== 'cancelled' && (
                          <button title={t('adm.delete')} className="btn-ghost btn-sm text-red-500"
                            onClick={() => {
                              if (!confirm(lang === 'ar' ? 'سيتم إلغاء الفاتورة وإرجاع المخزون وإنشاء قيد عكسي. متابعة؟' : 'Cancel invoice, return stock and post a reversal?')) return;
                              try { cancelSale(o.id, user?.id ?? null, 'إلغاء من النظام'); toast.push({ kind: 'success', title: t('c.success') }); }
                              catch (e: any) { toast.push({ kind: 'error', title: t('c.error'), body: String(e.message) }); }
                            }}><XCircle size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InvoiceModal order={view} isSales={isSales} co={co} onClose={() => setView(null)} />
    </div>
  );
}

function InvoiceModal({ order, isSales, co, onClose }: { order: Row | null; isSales: boolean; co: Row; onClose: () => void }) {
  const { t, lang } = useI18n();
  const items = useQuery(() => isSales
    ? q<Row>(`SELECT si.*, p.name_ar, p.name_en, p.sku FROM sales_items si JOIN products p ON p.id=si.product_id WHERE si.order_id=?`, [order?.id ?? 0])
    : q<Row>(`SELECT pi.*, p.name_ar, p.name_en, p.sku FROM purchase_items pi JOIN products p ON p.id=pi.product_id WHERE pi.order_id=?`, [order?.id ?? 0]),
    [order?.id, isSales]);

  if (!order) return null;
  const priceKey = isSales ? 'unit_price' : 'unit_cost';

  const asText = () => {
    const L: string[] = [];
    L.push(`${co.name_ar ?? ''} / ${co.name_en ?? ''}`);
    L.push(`${co.address_ar ?? ''} | VAT No: ${co.vat_number ?? ''}`);
    L.push('='.repeat(56));
    L.push(lang === 'ar' ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice');
    L.push(`${lang === 'ar' ? 'رقم' : 'No'}: ${order.order_no}`);
    L.push(`${lang === 'ar' ? 'التاريخ' : 'Date'}: ${fmtDateTime(order.placed_at ?? order.ordered_at, lang)}`);
    L.push(`${lang === 'ar' ? 'الطرف' : 'Party'}: ${order.party ?? ''}`);
    L.push('-'.repeat(56));
    items.forEach((i: any) => {
      L.push(`${i.sku} | ${i.name_en}`);
      L.push(`  ${i.qty} x ${i[priceKey].toFixed(2)} = ${i.line_total.toFixed(2)}`);
    });
    L.push('-'.repeat(56));
    L.push(`${lang === 'ar' ? 'قبل الضريبة' : 'Subtotal'}: ${order.subtotal.toFixed(2)}`);
    L.push(`VAT 15%: ${order.vat_amount.toFixed(2)}`);
    L.push(`${lang === 'ar' ? 'الإجمالي' : 'TOTAL'}: ${order.total.toFixed(2)}`);
    L.push(`${lang === 'ar' ? 'المدفوع' : 'Paid'}: ${order.paid.toFixed(2)}`);
    L.push(`${lang === 'ar' ? 'المتبقي' : 'Due'}: ${(order.total - order.paid).toFixed(2)}`);
    return L.join('\n');
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={`${isSales ? t('acc.sales') : t('acc.purchases')} ${order.order_no}`}
      footer={<>
        <Button variant="ghost" icon={<Download size={14} />} onClick={() => downloadBlob(asText(), `${order.order_no}.txt`, 'text/plain;charset=utf-8')}>{t('c.export')}</Button>
        <Button icon={<Printer size={14} />} onClick={() => window.print()}>{t('c.print')}</Button>
      </>}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4 dark:border-white/10">
        <div>
          <p className="text-base font-extrabold">{co.name_ar}</p>
          <p className="text-xs text-ink-500">{co.address_ar}</p>
          <p className="num text-[11px] text-ink-400">VAT: {co.vat_number}</p>
        </div>
        <div className="text-end">
          <StatusPill status={order.status === 'received' ? 'delivered' : order.status} lang={lang} />
          <p className="num mt-1.5 text-xs">{order.order_no}</p>
          <p className="num text-[11px] text-ink-500">{fmtDateTime(order.placed_at ?? order.ordered_at, lang)}</p>
        </div>
      </div>

      <p className="mb-3 text-sm font-bold">{isSales ? t('adm.customer') : t('adm.suppliers')}: <span className="font-medium text-ink-600 dark:text-ink-300">{order.party ?? '—'}</span></p>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr>
            <th>{t('prod.sku')}</th><th>{t('adm.products')}</th>
            <th className="text-end">{t('prod.qty')}</th><th className="text-end">{t('prod.price')}</th>
            <th className="text-end">{t('acc.total')}</th>
          </tr></thead>
          <tbody>
            {items.map((i: any) => (
              <tr key={i.id}>
                <td className="num text-xs">{i.sku}</td>
                <td className="text-xs font-semibold">{lang === 'ar' ? i.name_ar : i.name_en}</td>
                <td className="num text-end text-xs">{num(i.qty, lang)}</td>
                <td className="num text-end text-xs">{money(i[priceKey], 'SAR', lang)}</td>
                <td className="num text-end text-xs font-bold">{money(i.line_total, 'SAR', lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 ms-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-ink-500">{t('cart.subtotal')}</span><span className="num font-semibold">{money(order.subtotal, 'SAR', lang)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">{t('acc.vat')} 15%</span><span className="num font-semibold">{money(order.vat_amount, 'SAR', lang)}</span></div>
        <div className="flex justify-between border-t border-ink-100 pt-2 dark:border-white/10">
          <span className="font-bold">{t('c.total')}</span><span className="num text-lg font-extrabold text-brand-600 dark:text-brand-400">{money(order.total, 'SAR', lang)}</span>
        </div>
        <div className="flex justify-between"><span className="text-ink-500">{lang === 'ar' ? 'المدفوع' : 'Paid'}</span><span className="num">{money(order.paid, 'SAR', lang)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">{lang === 'ar' ? 'المتبقي' : 'Due'}</span>
          <span className={`num font-bold ${order.total - order.paid > 0.5 ? 'text-red-500' : 'text-signal-600 dark:text-signal-400'}`}>{money(order.total - order.paid, 'SAR', lang)}</span>
        </div>
      </div>
    </Modal>
  );
}
