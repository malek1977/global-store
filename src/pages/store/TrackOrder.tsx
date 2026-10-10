/* =====================================================================
 *  Storefront — order & repair tracking
 * ===================================================================== */
import { useState } from 'react';
import { Search, Package, Wrench, Clock, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery } from '../../app/state';
import { q, type Row } from '../../db/db';
import { Badge, Button, EmptyState, StatusPill, Input } from '../../ui/primitives';
import { money, fmtDateTime } from '../../lib/format';
import { FLOW } from '../../ops/repairs';

export default function TrackOrder() {
  const { t, lang, isRTL } = useI18n();
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [tab, setTab] = useState<'order' | 'repair'>('order');

  const order = useQuery(() => {
    if (!submitted) return [];
    return q<Row>(
      `SELECT * FROM sales_orders WHERE order_no=? OR REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','')=? OR id=? LIMIT 1`,
      [submitted.trim(), submitted.trim(), submitted.trim()]);
  }, [submitted]);

  const orderItems = useQuery(() => {
    if (!order[0]) return [];
    return q<Row>(`SELECT si.*, p.name_ar, p.name_en FROM sales_items si JOIN products p ON p.id=si.product_id WHERE si.order_id=?`, [order[0].id]);
  }, [order[0]?.id]);

  const tickets = useQuery(() => {
    if (!submitted) return [];
    return q<Row>(
      `SELECT * FROM repair_tickets WHERE ticket_no=? OR REPLACE(REPLACE(customer_phone,' ',''),'-','')=? ORDER BY intake_at DESC LIMIT 5`,
      [submitted.trim(), submitted.trim()]);
  }, [submitted]);

  const search = (e: React.FormEvent) => { e.preventDefault(); setSubmitted(term.trim()); };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('track.title')}</h1>
        <p className="mt-2 text-ink-500">{lang === 'ar' ? 'أدخل رقم الطلب أو التذكرة أو رقم جوالك' : 'Enter your order/ticket number or mobile'}</p>
      </div>

      <form onSubmit={search} className="mx-auto mt-7 flex max-w-lg gap-2">
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('track.ph')} className="flex-1" dir="ltr" />
        <Button type="submit" icon={<Search size={16} />}>{t('track.btn')}</Button>
      </form>

      {submitted && (
        <div className="mt-8">
          <div className="mb-4 flex justify-center gap-2">
            {([['order', t('nav.track'), Package], ['repair', t('nav.repair'), Wrench]] as const).map(([id, l, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`chip ${tab === id ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-600 dark:border-white/12 dark:text-ink-300'}`}>
                <Icon size={14} /> {l}
              </button>
            ))}
          </div>

          {tab === 'order' && (
            order[0] ? (
              <div className="surface p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="num text-lg font-extrabold">{order[0].order_no}</p>
                    <p className="text-xs text-ink-500">{fmtDateTime(order[0].placed_at, lang)}</p>
                  </div>
                  <StatusPill status={order[0].status} lang={lang} />
                </div>
                <div className="space-y-2.5">
                  {orderItems.map((i) => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span className="truncate text-ink-600 dark:text-ink-300">{lang === 'ar' ? i.name_ar : i.name_en} × {i.qty}</span>
                      <span className="num shrink-0 font-semibold">{money(i.line_total, 'SAR', lang)}</span>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <div className="flex items-center justify-between">
                  <span className="font-bold">{t('cart.total')}</span>
                  <span className="num text-lg font-extrabold text-brand-600 dark:text-brand-400">{money(order[0].total, 'SAR', lang)}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                  <Clock size={13} />
                  {lang === 'ar' ? 'التوصيل المتوقع خلال 24–48 ساعة داخل الرياض' : 'Expected delivery within 24–48h in Riyadh'}
                </div>
              </div>
            ) : <div className="surface"><EmptyState title={t('track.notFound')} icon={<Package size={26} />} /></div>
          )}

          {tab === 'repair' && (
            tickets.length ? (
              <div className="space-y-4">
                {tickets.map((tk) => (
                  <div key={tk.id} className="surface p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="num text-lg font-extrabold">{tk.ticket_no}</p>
                        <p className="text-xs text-ink-500">{tk.device_brand} {tk.device_model} · {fmtDateTime(tk.intake_at, lang)}</p>
                      </div>
                      <StatusPill status={tk.status} lang={lang} />
                    </div>

                    <RepairTimeline current={tk.status} />

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-ink-50 p-3 dark:bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('repair.eta')}</p>
                        <p className="num mt-1 text-sm font-extrabold">{tk.ai_eta_hours ? `${tk.ai_eta_hours} ${lang === 'ar' ? 'ساعة' : 'h'}` : '—'}</p>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-3 dark:bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('repair.cost')}</p>
                        <p className="num mt-1 text-sm font-extrabold">{Number(tk.final_cost) > 0 ? money(tk.final_cost, 'SAR', lang) : '—'}</p>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-3 dark:bg-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{t('repair.warranty')}</p>
                        <p className="num mt-1 text-sm font-extrabold">{tk.warranty_days} {lang === 'ar' ? 'يوم' : 'days'}</p>
                      </div>
                    </div>
                    {tk.advice && <p className="mt-4 rounded-xl bg-brand-500/10 p-3 text-xs text-ai-700 dark:text-ai-300">💡 {tk.advice}</p>}
                  </div>
                ))}
              </div>
            ) : <div className="surface"><EmptyState title={t('track.notFound')} icon={<Wrench size={26} />} /></div>
          )}
        </div>
      )}
    </div>
  );
}

export function RepairTimeline({ current }: { current: string }) {
  const { lang } = useI18n();
  const labels: Record<string, [string, string]> = {
    received: ['تم الاستلام', 'Received'], diagnosing: ['قيد التشخيص', 'Diagnosing'],
    awaiting_parts: ['بانتظار قطعة', 'Awaiting parts'], in_progress: ['قيد الإصلاح', 'In progress'],
    testing: ['قيد الاختبار', 'Testing'], completed: ['مكتمل', 'Completed'], delivered: ['تم التسليم', 'Delivered'],
  };
  const idx = FLOW.indexOf(current as any);
  return (
    <div className="no-scrollbar flex overflow-x-auto">
      {FLOW.map((s, i) => {
        const done = i <= idx;
        const active = i === idx;
        return (
          <div key={s} className="flex min-w-[86px] flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : done ? 'bg-brand-500' : 'bg-ink-200 dark:bg-white/10'}`} />
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold transition ${
                active ? 'scale-110 bg-brand-500 text-white shadow-glow' : done ? 'bg-brand-500/20 text-brand-700 dark:text-brand-300' : 'bg-ink-200 text-ink-400 dark:bg-white/10'}`}>
                {done && !active ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === FLOW.length - 1 ? 'opacity-0' : i < idx ? 'bg-brand-500' : 'bg-ink-200 dark:bg-white/10'}`} />
            </div>
            <span className={`text-[10px] font-semibold leading-tight ${active ? 'text-brand-600 dark:text-brand-400' : done ? 'text-ink-600 dark:text-ink-300' : 'text-ink-400'}`}>
              {lang === 'ar' ? labels[s][0] : labels[s][1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
