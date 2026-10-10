/* =====================================================================
 *  GLOBAL STORE — UI primitives
 * ===================================================================== */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Check, ChevronDown, Info, Loader2, Search, X, Sparkles, TrendingDown, TrendingUp, Inbox,
} from 'lucide-react';
import { useI18n, type Lang } from '../i18n';
import { hueOf } from '../lib/format';

/* ------------------------------------------------------------------ cn */
export function cn(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(' ');
}

/* --------------------------------------------------------------- logo */
export function Logo({ size = 40, withText = true, mono = false }: { size?: number; withText?: boolean; mono?: boolean }) {
  const { lang, t } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative grid shrink-0 place-items-center overflow-hidden rounded-[26%] shadow-glow"
        style={{ width: size, height: size, background: 'linear-gradient(135deg,#FF7C39 0%,#F26722 45%,#B33F0C 100%)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_15%,rgba(255,255,255,.45),transparent_70%)]" />
        <svg viewBox="0 0 48 48" width={size * 0.62} height={size * 0.62} className="relative">
          <path d="M9 37V15a6 6 0 0 1 6-6h10a8 8 0 0 1 8 8v20" fill="none" stroke="white" strokeWidth="4.6" strokeLinecap="round" />
          <path d="M19 37V21a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v16" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          <rect x="35" y="11" width="4.4" height="26" rx="2.2" fill="white" />
        </svg>
      </div>
      {withText && (
        <div className="leading-none">
          <div className={cn('font-extrabold tracking-tight', mono ? 'text-ink-900 dark:text-white' : '')}
               style={{ fontSize: size * 0.42 }}>
            {lang === 'ar' ? (
              <span className="gradient-text">جلوبال</span>
            ) : (
              <span className="gradient-text">Global</span>
            )}
            <span className={mono ? '' : 'text-ink-800 dark:text-ink-100'}>
              {lang === 'ar' ? ' ستور' : ' Store'}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.16em] text-ink-400">
            {t('nav.accounting')} · {t('nav.admin')}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Button */
type BtnProps = {
  variant?: 'primary' | 'outline' | 'ghost' | 'dark' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }: BtnProps) {
  const v = { primary: 'btn-primary', outline: 'btn-outline', ghost: 'btn-ghost', dark: 'btn-dark', ai: 'btn-ai' }[variant];
  const s = { sm: 'btn-sm', md: '', lg: 'btn-lg' }[size];
  return (
    <button className={cn(v, s, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- inputs */
export function Field({ label, hint, error, required, children }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}{required && <span className="text-brand-500"> *</span>}</label>}
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
        : hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...p} />;
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input min-h-[92px] resize-y', className)} {...p} />;
}

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn('input appearance-none pe-9', className)} {...p}>{children}</select>
      <ChevronDown size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        className="input ps-10 pe-9"
        value={value}
        placeholder={placeholder ?? t('c.search')}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5">
      <span className={cn('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-700')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'start-[22px]' : 'start-0.5')} />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

/* --------------------------------------------------------------- card */
export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface p-5', className)} {...p}>{children}</div>;
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink-900 dark:text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- badge */
export type Tone = 'brand' | 'good' | 'bad' | 'warn' | 'info' | 'neutral' | 'ai';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-300',
  good: 'bg-brand-500/15 text-signal-700 ring-1 ring-signal-500/25 dark:text-signal-300',
  bad: 'bg-brand-500/15 text-red-600 ring-1 ring-red-500/25 dark:text-red-300',
  warn: 'bg-brand-500/15 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-300',
  info: 'bg-brand-500/15 text-sky-600 ring-1 ring-sky-500/25 dark:text-sky-300',
  neutral: 'bg-ink-500/10 text-ink-600 ring-1 ring-ink-500/20 dark:text-ink-300',
  ai: 'bg-brand-500/15 text-ai-700 ring-1 ring-ai-500/25 dark:text-ai-300',
};

export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return <span className={cn('badge', TONES[tone], className)}>{icon}{children}</span>;
}

export function StatusPill({ status, lang }: { status: string; lang: Lang }) {
  const map: Record<string, Tone> = {
    confirmed: 'info', delivered: 'good', completed: 'good', cancelled: 'bad', draft: 'neutral',
    received: 'neutral', diagnosing: 'info', awaiting_parts: 'warn', in_progress: 'info',
    testing: 'info', returned: 'warn', received_po: 'neutral',
  };
  const labels: Record<string, [string, string]> = {
    confirmed: ['مؤكد', 'Confirmed'], delivered: ['تم التسليم', 'Delivered'], completed: ['مكتمل', 'Completed'],
    cancelled: ['ملغي', 'Cancelled'], draft: ['مسودة', 'Draft'], received: ['تم الاستلام', 'Received'],
    diagnosing: ['قيد التشخيص', 'Diagnosing'], awaiting_parts: ['بانتظار قطع', 'Awaiting parts'],
    in_progress: ['قيد الإصلاح', 'In progress'], testing: ['قيد الاختبار', 'Testing'],
  };
  const l = labels[status] ?? [status, status];
  return <Badge tone={map[status] ?? 'neutral'}>{lang === 'ar' ? l[0] : l[1]}</Badge>;
}

/* -------------------------------------------------------------- stats */
export function StatCard({ label, value, delta, icon, tone = 'brand', sub, onClick }: {
  label: string; value: string; delta?: number; icon?: ReactNode; tone?: Tone; sub?: string; onClick?: () => void;
}) {
  const { lang } = useI18n();
  const up = (delta ?? 0) >= 0;
  return (
    <div onClick={onClick} className={cn('surface card-hover group p-5', onClick && 'cursor-pointer')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{label}</p>
          <p className="num mt-2 text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">{value}</p>
          {(delta !== undefined || sub) && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold">
              {delta !== undefined && (
                <span className={cn('inline-flex items-center gap-0.5', up ? 'text-signal-600 dark:text-signal-400' : 'text-red-500')}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {lang === 'ar' ? `${Math.abs(delta).toFixed(1)}%` : `${Math.abs(delta).toFixed(1)}%`}
                </span>
              )}
              {sub && <span className="truncate font-normal text-ink-400">{sub}</span>}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', TONES[tone])}>{icon}</div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- tabs */
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="no-scrollbar -mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((tb) => (
        <button key={tb.id} onClick={() => onChange(tb.id)}
          className={cn('chip shrink-0',
            value === tb.id
              ? 'border-brand-500 bg-brand-500 text-white shadow-[0_6px_18px_-8px_rgba(242,103,34,.9)]'
              : 'border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-600 dark:border-white/12 dark:text-ink-300 dark:hover:border-brand-400/50')}>
          {tb.label}
          {tb.count !== undefined && (
            <span className={cn('num rounded-full px-1.5 text-[10px]',
              value === tb.id ? 'bg-white/25' : 'bg-ink-100 dark:bg-white/10')}>{tb.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- modal */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const { isRTL } = useI18n();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl dark:bg-ink-900', w)}>
        <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-base font-bold text-ink-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className={cn('flex gap-2 border-t border-ink-100 px-5 py-4 dark:border-white/10', isRTL ? 'justify-start' : 'justify-end')}>
            {footer}
          </div>
        )}
      </div>
    </div>, document.body);
}

/* ------------------------------------------------------------- toasts */
type Toast = { id: number; kind: 'success' | 'error' | 'info' | 'ai'; title: string; body?: string };
const ToastCtx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>(null as any);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++idRef.current;
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4200);
  }, []);
  const v = useMemo(() => ({ push }), [push]);
  const icons = { success: <Check size={15} />, error: <AlertTriangle size={15} />, info: <Info size={15} />, ai: <Sparkles size={15} /> };
  const tones = {
    success: 'bg-signal-600 text-white', error: 'bg-red-600 text-white',
    info: 'bg-ink-800 text-white dark:bg-ink-700', ai: 'bg-ai-600 text-white',
  };
  return (
    <ToastCtx.Provider value={v}>
      {children}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[200] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lift animate-fade-up', tones[t.kind])}>
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs opacity-90">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* --------------------------------------------------------- empty/load */
export function EmptyState({ title, sub, action, icon }: { title: string; sub?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-white/10">
        {icon ?? <Inbox size={26} />}
      </div>
      <p className="text-base font-bold text-ink-800 dark:text-ink-100">{title}</p>
      {sub && <p className="max-w-sm text-sm text-ink-500 dark:text-ink-400">{sub}</p>}
      {action}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 size={26} className="animate-spin text-brand-500" />
      <p className="text-sm font-medium text-ink-500">{label ?? t('c.loading')}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/* ------------------------------------------------------------- avatar */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const h = hueOf(name);
  const letters = name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('');
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg,hsl(${h} 72% 55%),hsl(${(h + 40) % 360} 68% 42%))` }}
    >
      {letters}
    </div>
  );
}

/* -------------------------------------------------------- progress bar */
export function Progress({ value, tone = 'brand' }: { value: number; tone?: Tone }) {
  const colors: Record<Tone, string> = {
    brand: 'bg-brand-500', good: 'bg-signal-500', bad: 'bg-red-500', warn: 'bg-amber-500',
    info: 'bg-sky-500', neutral: 'bg-ink-400', ai: 'bg-ai-500',
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
      <div className={cn('h-full rounded-full transition-all duration-700', colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------- sparkline */
export function Sparkline({ data, height = 44, tone = '#F26722', fill = true }: {
  data: number[]; height?: number; tone?: string; fill?: boolean;
}) {
  if (!data.length) return <div style={{ height }} />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const span = max - min || 1;
  const w = 100;
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, height - ((v - min) / span) * (height - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height, width: '100%' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* -------------------------------------------------------------- misc */
export function Dot({ tone = 'brand', pulse }: { tone?: Tone; pulse?: boolean }) {
  const colors: Record<Tone, string> = {
    brand: 'bg-brand-500', good: 'bg-signal-500', bad: 'bg-red-500', warn: 'bg-amber-500',
    info: 'bg-sky-500', neutral: 'bg-ink-400', ai: 'bg-ai-500',
  };
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colors[tone], pulse && 'animate-pulse')} />;
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 dark:border-white/15 dark:bg-white/10 dark:text-ink-300">{children}</kbd>;
}
