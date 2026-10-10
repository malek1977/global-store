/* =====================================================================
 *  Storefront — repair booking (creates a real ticket with AI triage)
 * ===================================================================== */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Wrench, ShieldCheck, Cpu, Clock, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery } from '../../app/state';
import { q, type Row } from '../../db/db';
import { Badge, Button, Field, Input, Textarea, Select } from '../../ui/primitives';
import { money } from '../../lib/format';
import { createTicket, triageTicket } from '../../ops/repairs';

const BRANDS = ['آيفون / iPhone', 'سامسونج / Samsung', 'هواوي / Huawei', 'شاومي / Xiaomi', 'أوبو / OPPO', 'فيفو / vivo', 'نوكيا / Nokia', 'ريدمي / Redmi', 'أونور / HONOR', 'أخرى / Other'];

export default function RepairBooking() {
  const { t, lang } = useI18n();
  const [done, setDone] = useState<{ ticket: string; eta: number; conf: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    name: '', phone: '', email: '', brand: BRANDS[0], model: '', imei: '',
    issue: '', priority: 'normal', passcode: false, est: '',
  });

  const set = (k: string, v: any) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  const techs = useQuery(() => q<Row>('SELECT * FROM technicians WHERE is_active=1'), []);
  const [techId, setTechId] = useState<number | ''>('');

  // live AI triage preview
  const preview = f.issue.length > 3 ? triageTicket({ customer_name: f.name || 'x', device_model: f.model || 'x', issue_ar: f.issue, priority: f.priority as any, est_cost: +f.est || 0 }) : null;

  const submit = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = lang === 'ar' ? 'الاسم مطلوب' : 'Name is required';
    if (!/^05\d{8}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = lang === 'ar' ? 'رقم جوال سعودي غير صحيح' : 'Invalid mobile number';
    if (f.model.trim().length < 2) e.model = lang === 'ar' ? 'حدد موديل الجهاز' : 'Device model is required';
    if (f.issue.trim().length < 8) e.issue = lang === 'ar' ? 'اوصف المشكلة بالتفصيل' : 'Describe the issue in detail';
    setErrors(e);
    if (Object.keys(e).length) return;

    const id = createTicket({
      customer_name: f.name.trim(), customer_phone: f.phone, customer_email: f.email || undefined,
      device_brand: f.brand.split('/')[0].trim(), device_model: f.model.trim(), imei: f.imei || undefined,
      issue_ar: f.issue, issue_en: '', priority: f.priority as any,
      technician_id: techId === '' ? null : Number(techId),
      branch_id: 4, passcode_ok: f.passcode, est_cost: +f.est || 0,
      warranty_days: 30, notes: f.issue,
    }, null);
    const tk = q<Row>('SELECT ticket_no, ai_eta_hours, ai_confidence FROM repair_tickets WHERE id=?', [id])[0];
    setDone({ ticket: tk.ticket_no, eta: tk.ai_eta_hours, conf: tk.ai_confidence });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="surface overflow-hidden text-center">
          <div className="bg-gradient-to-br from-ai-500 to-ai-700 p-9 text-white">
            <CheckCircle2 size={46} className="mx-auto mb-3" />
            <h1 className="text-xl font-extrabold sm:text-2xl">{t('repair.success')}</h1>
            <p className="num mt-3 inline-block rounded-lg bg-white/20 px-5 py-2 text-base font-bold">{done.ticket}</p>
          </div>
          <div className="p-7">
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-ink-50 p-4 text-start dark:bg-white/5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400"><Clock size={12} />{t('repair.eta')}</p>
                <p className="num mt-1.5 text-lg font-extrabold">{done.eta} {lang === 'ar' ? 'ساعة' : 'hours'}</p>
              </div>
              <div className="rounded-xl bg-brand-500/10 p-4 text-start">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ai-600 dark:text-ai-300"><Sparkles size={12} />{t('adm.confidence')}</p>
                <p className="num mt-1.5 text-lg font-extrabold text-ai-700 dark:text-ai-300">{Math.round(done.conf * 100)}%</p>
              </div>
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300">{t('repair.success.d')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Link to={`/track?no=${done.ticket}`} className="btn-primary">{t('nav.track')}</Link>
              <Button variant="outline" onClick={() => { setDone(null); setF({ name: '', phone: '', email: '', brand: BRANDS[0], model: '', imei: '', issue: '', priority: 'normal', passcode: false, est: '' }); }}>
                {lang === 'ar' ? 'طلب آخر' : 'New request'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* hero */}
      <section className="hero-mesh border-b border-ink-100 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6">
          <Badge tone="ai" icon={<Sparkles size={12} />} className="mb-4">{lang === 'ar' ? 'تشخيص ذكي فوري' : 'Instant smart diagnosis'}</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl dark:text-white">{t('repair.title')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-600 dark:text-ink-300">{t('repair.sub')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs font-semibold text-ink-500">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-signal-500" />{t('repair.dataCare')}</span>
            <span className="flex items-center gap-1.5"><Cpu size={14} className="text-ai-500" />{t('repair.parts')}</span>
            <span className="flex items-center gap-1.5"><Clock size={14} className="text-brand-500" />{t('repair.walkIn')}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* form */}
          <div className="surface p-6">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold"><Wrench size={18} className="text-brand-500" />{t('repair.book')}</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('checkout.name')} required error={errors.name}>
                <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={lang === 'ar' ? 'محمد عبدالله' : 'John Smith'} />
              </Field>
              <Field label={t('checkout.phone')} required error={errors.phone}>
                <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0551234567" dir="ltr" inputMode="tel" />
              </Field>
              <Field label={t('checkout.email')} hint={t('c.optional')}>
                <Input value={f.email} onChange={(e) => set('email', e.target.value)} dir="ltr" type="email" />
              </Field>
              <Field label={t('repair.brand')}>
                <Select value={f.brand} onChange={(e) => set('brand', e.target.value)}>
                  {BRANDS.map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
              <Field label={t('repair.model')} required error={errors.model}>
                <Input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder={lang === 'ar' ? 'iPhone 13 Pro' : 'iPhone 13 Pro'} />
              </Field>
              <Field label={t('repair.imei')}>
                <Input value={f.imei} onChange={(e) => set('imei', e.target.value)} dir="ltr" placeholder="35XXXXXXXXX" />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('repair.issue')} required error={errors.issue}>
                  <Textarea value={f.issue} onChange={(e) => set('issue', e.target.value)} placeholder={t('repair.issuePh')} />
                </Field>
              </div>
              <Field label={t('adm.priority')}>
                <Select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="low">{t('adm.low')}</option>
                  <option value="normal">{t('adm.normal')}</option>
                  <option value="high">{t('adm.high')}</option>
                  <option value="urgent">{t('adm.urgent')}</option>
                </Select>
              </Field>
              <Field label={t('adm.technician')} hint={lang === 'ar' ? 'اتركه فارغاً للتخصيص' : 'Leave blank to auto-assign'}>
                <Select value={techId} onChange={(e) => setTechId(e.target.value === '' ? '' : +e.target.value)}>
                  <option value="">{lang === 'ar' ? 'تلقائي' : 'Auto-assign'}</option>
                  {techs.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.specialty}</option>)}
                </Select>
              </Field>
              <Field label={lang === 'ar' ? 'التكلفة التقديرية' : 'Estimated cost'} hint={t('c.optional')}>
                <Input value={f.est} onChange={(e) => set('est', e.target.value)} inputMode="decimal" dir="ltr" placeholder="250" />
              </Field>
              <Field label={lang === 'ar' ? 'رمز قفل الشاشة' : 'Screen passcode'}>
                <label className="flex h-[46px] cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 px-3.5 text-sm dark:border-white/12">
                  <input type="checkbox" checked={f.passcode} onChange={(e) => set('passcode', e.target.checked)}
                    className="h-4 w-4 accent-brand-500" />
                  {lang === 'ar' ? 'العميل يملك رمز القفل' : 'Customer has the passcode'}
                </label>
              </Field>
            </div>

            <Button size="lg" className="mt-6 w-full" onClick={submit}>{t('repair.submit')}</Button>
          </div>

          {/* AI panel */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="surface overflow-hidden">
              <div className="flex items-center gap-2 bg-gradient-to-r from-ai-500 to-ai-700 px-5 py-3.5 text-white">
                <Sparkles size={16} />
                <p className="text-sm font-bold">{lang === 'ar' ? 'المحرك التشخيصي' : 'Diagnostic engine'}</p>
              </div>
              <div className="space-y-3.5 p-5">
                {preview ? (
                  <>
                    <Line l={t('repair.eta')} v={`${preview.etaHours} ${lang === 'ar' ? 'ساعة' : 'h'}`} tone="brand" />
                    <Line l={t('adm.confidence')} v={`${Math.round(preview.confidence * 100)}%`} tone="ai" />
                    <Line l={t('adm.risk')} v={preview.risk === 'high' ? (lang === 'ar' ? 'مرتفعة' : 'High') : preview.risk === 'med' ? (lang === 'ar' ? 'متوسطة' : 'Medium') : (lang === 'ar' ? 'منخفضة' : 'Low')}
                      tone={preview.risk === 'high' ? 'bad' : preview.risk === 'med' ? 'warn' : 'good'} />
                    {preview.estCost > 0 && <Line l={lang === 'ar' ? 'سعر متوقع' : 'Expected cost'} v={money(preview.estCost, 'SAR', lang)} />}
                    <div className="rounded-xl bg-ink-50 p-3 dark:bg-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{lang === 'ar' ? 'قطع الغيار المتوقعة' : 'Likely parts'}</p>
                      <ul className="mt-1.5 space-y-1">
                        {preview.suggestedParts.map((x) => (
                          <li key={x} className="flex items-center gap-1.5 text-xs"><span className="h-1 w-1 rounded-full bg-ai-500" />{x}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="rounded-xl bg-brand-500/10 p-3 text-[11px] leading-relaxed text-ai-700 dark:text-ai-300">{preview.advice}</p>
                    {preview.risk === 'high' && (
                      <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        {lang === 'ar' ? 'ننصح بتوقيع إقرار مخاطرة قبل بدء الإصلاح.' : 'A risk acknowledgement is recommended before repair starts.'}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="py-6 text-center text-xs text-ink-400">
                    {lang === 'ar' ? 'اكتب وصف المشكلة ليظهر التقدير الفوري.' : 'Describe the issue to see an instant estimate.'}
                  </p>
                )}
              </div>
            </div>

            <div className="surface p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">
                {lang === 'ar' ? 'أجهزة نصلحها' : 'We repair'}
              </p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.slice(0, 8).map((b) => (
                  <span key={b} className="chip border-ink-200 text-[11px] text-ink-600 dark:border-white/12 dark:text-ink-300">
                    <Smartphone size={12} />{b.split('/')[0].trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ l, v, tone }: { l: string; v: string; tone?: 'brand' | 'ai' | 'good' | 'warn' | 'bad' }) {
  const colors: Record<string, string> = {
    brand: 'text-brand-600 dark:text-brand-400', ai: 'text-ai-600 dark:text-ai-300',
    good: 'text-signal-600 dark:text-signal-400', warn: 'text-amber-600 dark:text-amber-300', bad: 'text-red-500',
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-500">{l}</span>
      <span className={`font-bold ${tone ? colors[tone] : ''}`}>{v}</span>
    </div>
  );
}
