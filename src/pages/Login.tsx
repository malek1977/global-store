/* =====================================================================
 *  Sign-in — PBKDF2 verification, lockout, RBAC-aware demo accounts
 * ===================================================================== */
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Lock, User as UserIcon, Sparkles, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth, useReady } from '../app/state';
import { Button, Field, Input, Logo, Badge } from '../ui/primitives';
import { useToast } from '../ui/primitives';

const DEMO = [
  { u: 'admin', r: ['المالك / Owner', 'Owner'], tone: 'brand' as const },
  { u: 'manager', r: ['مدير الفرع', 'Branch manager'], tone: 'info' as const },
  { u: 'accountant', r: ['محاسب رئيسي', 'Chief accountant'], tone: 'good' as const },
  { u: 'sales1', r: ['موظف مبيعات', 'Sales'], tone: 'warn' as const },
  { u: 'tech1', r: ['فني صيانة', 'Technician'], tone: 'ai' as const },
  { u: 'viewer', r: ['مشاهد', 'Viewer'], tone: 'neutral' as const },
];

export default function Login() {
  const { t, lang } = useI18n();
  const { login, user } = useAuth();
  const { ready } = useReady();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const toast = useToast();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (user && ready) { nav(loc.state?.from ?? '/app/dashboard', { replace: true }); }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!u.trim() || !p) { setErr(t('auth.failed')); return; }
    setBusy(true);
    const r = await login(u, p);
    setBusy(false);
    if (r.ok) {
      toast.push({ kind: 'success', title: t('c.success'), body: lang === 'ar' ? 'مرحباً بك في أنظمة جلوبال ستور' : 'Welcome to Global Store systems' });
      nav(loc.state?.from ?? '/app/dashboard', { replace: true });
    } else if (String(r.error).startsWith('locked')) {
      setErr(t('auth.locked'));
    } else {
      const left = String(r.error).split(':')[1];
      setErr(left && left !== 'invalid' ? `${t('auth.failed')} — ${left}` : t('auth.failed'));
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ------------------------------------------------- brand panel */}
      <div className="hero-mesh relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-grid-fine bg-grid opacity-30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/"><Logo size={48} mono /></Link>
          <div>
            <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight text-ink-900 dark:text-white">
              {lang === 'ar' ? 'ثلاثة أنظمة، قاعدة بيانات واحدة' : 'Three systems, one database'}
            </h2>
            <p className="mt-4 max-w-md text-ink-600 dark:text-ink-300">
              {lang === 'ar'
                ? 'المتجر الإلكتروني والنظام المحاسبي والنظام الإداري مترابطة بالكامل — أي عملية بيع أو شراء تُرحَّل تلقائياً إلى الدفاتر المالية.'
                : 'The storefront, the accounting suite and the administration module are fully interlinked — every sale or purchase posts straight to the ledger.'}
            </p>
            <div className="mt-8 space-y-3">
              {[
                { i: Lock, t: lang === 'ar' ? 'تشفير PBKDF2-SHA256 بكلمات المرور' : 'PBKDF2-SHA256 password hashing', d: lang === 'ar' ? '150 ألف دورة + ملح عشوائي لكل مستخدم' : '150k iterations + per-user random salt' },
                { i: ShieldCheck, t: lang === 'ar' ? 'صلاحيات RBAC بست أدوار' : 'RBAC with six roles', d: lang === 'ar' ? 'صلاحيات دقيقة لكل وحدة' : 'Granular per-module permissions' },
                { i: Sparkles, t: lang === 'ar' ? 'ذكاء اصطناعي مدمج' : 'Embedded AI', d: lang === 'ar' ? 'تحليلات وتنبؤ ومساعد محادثة' : 'Analytics, forecasting and chat assistant' },
              ].map(({ i: Icon, t: ti, d }) => (
                <div key={ti} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400">
                    <Icon size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{ti}</p>
                    <p className="text-xs text-ink-500">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-400">© {new Date().getFullYear()} {t('app.name')} · {t('c.demo')}</p>
        </div>
      </div>

      {/* ---------------------------------------------------- form side */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Link to="/"><Logo size={44} /></Link></div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t('auth.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-500">{t('auth.sub')}</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label={t('auth.user')}>
              <div className="relative">
                <UserIcon size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input value={u} onChange={(e) => setU(e.target.value)} className="ps-10" autoComplete="username" dir="ltr" placeholder="admin" autoFocus />
              </div>
            </Field>
            <Field label={t('auth.pass')} error={err || undefined}>
              <div className="relative">
                <Lock size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <Input type={show ? 'text' : 'password'} value={p} onChange={(e) => setP(e.target.value)}
                  className="ps-10 pe-11" autoComplete="current-password" dir="ltr" placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute end-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock size={16} />}>{t('auth.signin')}</Button>
          </form>

          <div className="mt-8 rounded-2xl border border-ink-100 bg-ink-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
              <AlertTriangle size={13} className="text-amber-500" /> {t('auth.demo')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button key={d.u} onClick={() => { setU(d.u); setP('Global@2025'); }}
                  className="flex flex-col items-start gap-1 rounded-xl bg-white p-2.5 text-start ring-1 ring-ink-100 transition hover:ring-brand-400 dark:bg-white/5 dark:ring-white/10">
                  <span className="num text-xs font-bold">{d.u}</span>
                  <Badge tone={d.tone}>{lang === 'ar' ? d.r[0] : d.r[1]}</Badge>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-400">
              {lang === 'ar' ? 'كلمة المرور الموحدة:' : 'Shared password:'} <code className="num rounded bg-ink-100 px-1.5 py-0.5 font-bold dark:bg-white/10">Global@2025</code>
            </p>
          </div>

          <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600">
            <ArrowLeft size={14} style={{ transform: 'scaleX(-1)' }} /> {t('auth.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
