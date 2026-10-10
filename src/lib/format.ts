/* =====================================================================
 *  GLOBAL STORE — formatting & helpers
 * ===================================================================== */

export type Lang = 'ar' | 'en';

export const CURRENCIES: Record<string, { ar: string; en: string; symbol: string }> = {
  SAR: { ar: 'ريال', en: 'SAR', symbol: 'ر.س' },
  AED: { ar: 'درهم', en: 'AED', symbol: 'د.إ' },
  EGP: { ar: 'جنيه', en: 'EGP', symbol: 'ج.م' },
  KWD: { ar: 'دينار', en: 'KWD', symbol: 'د.ك' },
  USD: { ar: 'دولار', en: 'USD', symbol: '$' },
  JOD: { ar: 'دينار', en: 'JOD', symbol: 'د.أ' },
  QAR: { ar: 'ريال', en: 'QAR', symbol: 'ر.ق' },
};

export function currencySymbol(cur: string): string {
  return CURRENCIES[cur]?.symbol ?? cur;
}

export function money(v: number | null | undefined, cur = 'SAR', lang: Lang = 'ar', digits = 2): string {
  const n = Number(v ?? 0);
  const fmt = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const sym = currencySymbol(cur);
  return lang === 'ar' ? `${fmt.format(n)} ${sym}` : `${sym} ${fmt.format(n)}`;
}

export function num(v: number | null | undefined, lang: Lang = 'ar', digits = 0): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(v ?? 0));
}

export function pct(v: number | null | undefined, lang: Lang = 'ar', digits = 1): string {
  return `${num(v ?? 0, lang, digits)}%`;
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d: string | Date | null | undefined, lang: Lang = 'ar'): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  if (isNaN(dt.getTime())) return '—';
  const day = dt.getDate();
  const mo = dt.getMonth();
  const year = dt.getFullYear();
  return lang === 'ar' ? `${day} ${AR_MONTHS[mo]} ${year}` : `${EN_MONTHS[mo]} ${day}, ${year}`;
}

export function fmtDateTime(d: string | Date | null | undefined, lang: Lang = 'ar'): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  if (isNaN(dt.getTime())) return '—';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${fmtDate(dt, lang)} · ${hh}:${mm}`;
}

export function fmtTimeAgo(d: string | null | undefined, lang: Lang = 'ar'): string {
  if (!d) return '—';
  const dt = new Date(d.replace(' ', 'T'));
  if (isNaN(dt.getTime())) return '—';
  const s = (Date.now() - dt.getTime()) / 1000;
  if (s < 60) return lang === 'ar' ? 'الآن' : 'just now';
  const steps: { div: number; ar: string; en: string }[] = [
    { div: 3600, ar: 'ساعة', en: 'h' },
    { div: 86400, ar: 'يوم', en: 'd' },
    { div: 604800, ar: 'أسبوع', en: 'w' },
    { div: 2592000, ar: 'شهر', en: 'mo' },
    { div: 31536000, ar: 'سنة', en: 'y' },
    { div: Infinity, ar: 'سنة', en: 'y' },
  ];
  const step = steps.find((x) => s < x.div)!;
  const n = Math.max(1, Math.floor(s / step.div));
  return lang === 'ar' ? `قبل ${n} ${step.ar}` : `${n}${step.en} ago`;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + (f(x) || 0), 0);

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Deterministic pastel-ish colour from a string (for avatars / categories). */
export function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function downloadBlob(data: BlobPart, filename: string, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function nextDocNo(prefix: string, table: string, col = 'order_no'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
