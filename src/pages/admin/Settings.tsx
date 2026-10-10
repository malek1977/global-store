/* =====================================================================
 *  Settings — company, data safety, security posture
 * ===================================================================== */
import { useState } from 'react';
import {
  Settings as SettingsIcon, Building2, Database, ShieldCheck, Download, Upload,
  RefreshCcw, Palette, Languages, HardDrive, AlertTriangle, Check,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useTheme, useCompany } from '../../app/state';
import { one, update, type Row } from '../../db/db';
import { Badge, Button, Card, Field, Input, SectionTitle, Select, useToast, StatCard } from '../../ui/primitives';
import { money, num } from '../../lib/format';
import { exportDatabase, importDatabase, hardReset } from '../../db/db';
import { MAX_ATTEMPTS, LOCK_MS, PERMISSIONS } from '../../lib/security';
import { q } from '../../db/db';

const CURRENCIES = ['SAR', 'AED', 'KWD', 'QAR', 'EGP', 'JOD', 'USD'];

export default function Settings() {
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const co = useCompany();
  const [f, setF] = useState<any>(co);
  const [init, setInit] = useState(false);
  const [busy, setBusy] = useState(false);

  if (co && !init) { setInit(true); setF(co); }

  const counts = useQuery(() => ({
    products: q<Row>('SELECT COUNT(*) AS v FROM products')[0]?.v ?? 0,
    partners: q<Row>('SELECT COUNT(*) AS v FROM partners')[0]?.v ?? 0,
    orders: q<Row>('SELECT COUNT(*) AS v FROM sales_orders')[0]?.v ?? 0,
    journals: q<Row>('SELECT COUNT(*) AS v FROM journals')[0]?.v ?? 0,
    tickets: q<Row>('SELECT COUNT(*) AS v FROM repair_tickets')[0]?.v ?? 0,
    users: q<Row>('SELECT COUNT(*) AS v FROM users')[0]?.v ?? 0,
  }), []);

  const save = () => {
    update('company', 1, f);
    toast.push({ kind: 'success', title: t('c.success'), body: f.name_ar });
  };

  const doExport = () => {
    const bin = exportDatabase();
    const blob = new Blob([bin as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `global-store-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast.push({ kind: 'success', title: lang === 'ar' ? 'تم تصدير النسخة' : 'Backup exported', body: `${(bin.length / 1024).toFixed(0)} KB` });
  };

  const doImport = (file: File) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        importDatabase(new Uint8Array(r.result as ArrayBuffer));
        toast.push({ kind: 'success', title: lang === 'ar' ? 'تم استيراد النسخة' : 'Backup imported' });
      } catch (e: any) {
        toast.push({ kind: 'error', title: t('c.error'), body: String(e.message) });
      }
    };
    r.readAsArrayBuffer(file);
  };

  const doReset = () => {
    if (!confirm(lang === 'ar' ? 'سيتم حذف كل البيانات وإعادة تحميل البيانات التجريبية. متابعة؟' : 'This wipes all data and reloads the demo dataset. Continue?')) return;
    setBusy(true);
    hardReset().then(() => { setBusy(false); toast.push({ kind: 'success', title: t('c.success') }); });
  };

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('adm.products')} value={num(counts.products, lang)} icon={<Building2 size={19} />} tone="brand" />
        <StatCard label={t('adm.partners')} value={num(counts.partners, lang)} tone="info" />
        <StatCard label={lang === 'ar' ? 'فواتير' : 'Orders'} value={num(counts.orders, lang)} tone="good" />
        <StatCard label={lang === 'ar' ? 'قيود محاسبية' : 'Journal entries'} value={num(counts.journals, lang)} tone="ai" />
      </div>

      {/* --------------------------------------------------- company */}
      <Card>
        <SectionTitle title={lang === 'ar' ? 'بيانات المنشأة' : 'Company profile'}
          sub={lang === 'ar' ? 'تظهر على الفواتير والتقارير' : 'Used on invoices and reports'}
          action={<Button size="sm" onClick={save}>{t('adm.save')}</Button>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={lang === 'ar' ? 'الاسم (ع)' : 'Name (AR)'}>
            <Input value={f.name_ar ?? ''} onChange={(e) => setF({ ...f, name_ar: e.target.value })} dir="rtl" />
          </Field>
          <Field label={lang === 'ar' ? 'الاسم (en)' : 'Name (EN)'}>
            <Input value={f.name_en ?? ''} onChange={(e) => setF({ ...f, name_en: e.target.value })} dir="ltr" />
          </Field>
          <Field label={lang === 'ar' ? 'الشعار' : 'Tagline'}>
            <Input value={f.tagline_ar ?? ''} onChange={(e) => setF({ ...f, tagline_ar: e.target.value })} />
          </Field>
          <Field label={lang === 'ar' ? 'الرقم الضريبي' : 'VAT number'}>
            <Input value={f.vat_number ?? ''} onChange={(e) => setF({ ...f, vat_number: e.target.value })} dir="ltr" />
          </Field>
          <Field label={lang === 'ar' ? 'السجل التجاري' : 'CR number'}>
            <Input value={f.cr_number ?? ''} onChange={(e) => setF({ ...f, cr_number: e.target.value })} dir="ltr" />
          </Field>
          <Field label={lang === 'ar' ? 'الجوال' : 'Phone'}>
            <Input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} dir="ltr" />
          </Field>
          <Field label={lang === 'ar' ? 'البريد' : 'Email'}>
            <Input value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" />
          </Field>
          <Field label={lang === 'ar' ? 'العملة' : 'Currency'}>
            <Select value={f.currency ?? 'SAR'} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label={lang === 'ar' ? 'نسبة الضريبة %' : 'VAT rate %'}>
            <Input value={f.vat_rate ?? 0.15} onChange={(e) => setF({ ...f, vat_rate: +e.target.value / 100 })} dir="ltr" inputMode="decimal" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={lang === 'ar' ? 'العنوان' : 'Address'}>
              <Input value={f.address_ar ?? ''} onChange={(e) => setF({ ...f, address_ar: e.target.value })} />
            </Field>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------ appearance */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={lang === 'ar' ? 'المظهر واللغة' : 'Appearance & language'} />
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-ink-50 p-4 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <Palette size={17} className="text-brand-500" />
                <div><p className="text-sm font-bold">{t('c.theme')}</p><p className="text-xs text-ink-500">{theme === 'dark' ? t('c.dark') : t('c.light')}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={toggle}>{theme === 'dark' ? t('c.light') : t('c.dark')}</Button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-ink-50 p-4 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <Languages size={17} className="text-ai-500" />
                <div><p className="text-sm font-bold">{t('c.lang')}</p><p className="text-xs text-ink-500">{lang === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={toggleLang}>{lang === 'ar' ? 'English' : 'العربية'}</Button>
            </div>
          </div>
        </Card>

        {/* security posture */}
        <Card>
          <SectionTitle title={lang === 'ar' ? 'الوضع الأمني' : 'Security posture'} />
          <ul className="space-y-2.5">
            {[
              { ok: true, ar: 'تشفير كلمات المرور بـ PBKDF2-SHA256 (150,000 دورة)', en: 'PBKDF2-SHA256 password hashing (150,000 rounds)' },
              { ok: true, ar: 'ملح عشوائي 128 بت لكل مستخدم', en: '128-bit random salt per user' },
              { ok: true, ar: 'قفل الحساب بعد 5 محاولات فاشلة لمدة 60 ثانية', en: `Account lock after ${MAX_ATTEMPTS} failed attempts for ${LOCK_MS / 1000}s` },
              { ok: true, ar: 'جلسات موقّعة برمز عشوائي 256 بت مع انتهاء صلاحية', en: '256-bit random session tokens with expiry' },
              { ok: true, ar: 'صلاحيات RBAC بـ 6 أدوار و 19 صلاحية', en: 'RBAC with 6 roles and 19 permissions' },
              { ok: true, ar: 'سياسة CSP و Referrer-Policy في التطبيق', en: 'CSP and Referrer-Policy headers' },
              { ok: true, ar: 'سجل تدقيق لكل عملية كتابة', en: 'Audit log for every write operation' },
              { ok: true, ar: 'تخزين محلي معزول (IndexedDB) — لا تُرسل بيانات لأي خادم', en: 'Isolated local storage (IndexedDB) — no data leaves the device' },
            ].map((s) => (
              <li key={s.en} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-signal-500/20 text-signal-600">
                  <Check size={10} />
                </span>
                <span className="text-ink-600 dark:text-ink-300">{lang === 'ar' ? s.ar : s.en}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            {(['store', 'accounting', 'admin'] as const).map((m) => (
              <Badge key={m} tone="neutral">{PERMISSIONS.filter((p) => p.module === m).length} {m}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------- data */}
      <Card>
        <SectionTitle title={lang === 'ar' ? 'البيانات' : 'Data'} sub={lang === 'ar' ? 'النسخ الاحتياطي والاستعادة' : 'Backup and restore'} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('adm.tickets')} value={num(counts.tickets, lang)} tone="ai" />
          <StatCard label={t('adm.users')} value={num(counts.users, lang)} tone="info" />
          <div className="flex flex-col gap-2">
            <Button variant="outline" icon={<Download size={15} />} onClick={doExport}>{t('c.exportData')}</Button>
            <label className="btn-outline cursor-pointer">
              <Upload size={15} /> {t('c.importData')}
              <input type="file" accept=".sqlite,.db,.bin" className="hidden"
                onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
            </label>
            <Button variant="ghost" className="!text-red-500" loading={busy} icon={<RefreshCcw size={15} />} onClick={doReset}>
              {t('c.resetData')}
            </Button>
          </div>
          <div className="rounded-2xl bg-ink-50 p-4 dark:bg-white/5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
              <HardDrive size={13} /> SQLite / WASM
            </p>
            <p className="num mt-2 text-sm font-bold">{num(counts.journals, lang)} {lang === 'ar' ? 'قيد محاسبي' : 'journal entries'}</p>
            <p className="num text-[11px] text-ink-500">{num(counts.orders, lang)} {lang === 'ar' ? 'فاتورة' : 'invoices'}</p>
            <p className="num text-[11px] text-ink-500">{num(counts.products, lang)} {lang === 'ar' ? 'صنف' : 'SKUs'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
