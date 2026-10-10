/* =====================================================================
 *  Administration — employees, users, roles
 * ===================================================================== */
import { useState } from 'react';
import { UserCog, Plus, ShieldCheck, KeyRound, Users, Wrench, Briefcase, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useQuery, useAuth } from '../../app/state';
import { q, one, insert, update, remove, type Row } from '../../db/db';
import {
  Badge, Button, Card, Field, Input, Modal, Select, StatCard, Tabs, useToast, Avatar,
} from '../../ui/primitives';
import { money, num, fmtDate } from '../../lib/format';
import { hashPassword, randomSalt, passwordScore, PERMISSIONS } from '../../lib/security';
import { ROLE_PERMISSIONS } from '../../lib/security';

const ROLE_META: Record<string, { tone: any; ar: string; en: string }> = {
  admin: { tone: 'brand', ar: 'مالك النظام', en: 'Administrator' },
  manager: { tone: 'info', ar: 'مدير فرع', en: 'Manager' },
  accountant: { tone: 'good', ar: 'محاسب', en: 'Accountant' },
  technician: { tone: 'ai', ar: 'فني صيانة', en: 'Technician' },
  sales: { tone: 'warn', ar: 'مبيعات', en: 'Sales' },
  viewer: { tone: 'neutral', ar: 'مشاهد', en: 'Viewer' },
};

export default function Employees() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('staff');
  const [edit, setEdit] = useState<Row | null>(null);
  const [pwd, setPwd] = useState<Row | null>(null);

  const staff = useQuery(() => q<Row>(
    `SELECT e.*, b.name_ar AS branch_ar, b.name_en AS branch_en FROM employees e
     LEFT JOIN branches b ON b.id=e.branch_id ORDER BY e.id DESC`), [tab]);
  const users = useQuery(() => q<Row>(
    `SELECT u.*, b.name_ar AS branch_ar FROM users u LEFT JOIN branches b ON b.id=u.branch_id ORDER BY u.id`), [tab]);
  const techs = useQuery(() => q<Row>('SELECT * FROM technicians ORDER BY id'), [tab]);
  const branches = useQuery(() => q<Row>('SELECT * FROM branches ORDER BY id'), [tab]);
  const logs = useQuery(() => q<Row>('SELECT * FROM audit_log ORDER BY id DESC LIMIT 40'), [tab]);

  const payroll = staff.reduce((s, e) => s + (e.salary ?? 0), 0);

  const tabs = [
    { id: 'staff', label: t('adm.employees'), count: staff.length },
    { id: 'users', label: t('adm.users'), count: users.length },
    { id: 'techs', label: t('adm.technicians'), count: techs.length },
    { id: 'roles', label: t('adm.roles'), count: Object.keys(ROLE_PERMISSIONS).length },
    { id: 'audit', label: lang === 'ar' ? 'سجل التدقيق' : 'Audit log', count: logs.length },
  ];

  return (
    <div className="space-y-5">
      <div className="stat-grid">
        <StatCard label={t('adm.employees')} value={num(staff.length, lang)} icon={<Users size={19} />} tone="brand" />
        <StatCard label={t('adm.users')} value={num(users.filter((u) => u.status === 'active').length, lang)} icon={<ShieldCheck size={19} />} tone="good" />
        <StatCard label={t('adm.technicians')} value={num(techs.length, lang)} icon={<Wrench size={19} />} tone="ai" />
        <StatCard label={lang === 'ar' ? 'إجمالي الرواتب' : 'Monthly payroll'} value={money(payroll, 'SAR', lang)} icon={<Briefcase size={19} />} tone="info" />
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === 'staff' && can('admin.employees.write') && (
            <Button size="sm" className="ms-auto" icon={<Plus size={14} />} onClick={() => setEdit({ isNew: true } as any)}>{t('adm.new')}</Button>
          )}
        </div>

        {tab === 'staff' && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('adm.employees')}</th><th>{lang === 'ar' ? 'القسم' : 'Department'}</th>
                <th>{lang === 'ar' ? 'المسمى' : 'Job title'}</th><th>{lang === 'ar' ? 'الفرع' : 'Branch'}</th>
                <th className="text-end">{lang === 'ar' ? 'الراتب' : 'Salary'}</th>
                <th>{lang === 'ar' ? 'تاريخ التعيين' : 'Hired'}</th><th>{t('c.actions')}</th>
              </tr></thead>
              <tbody>
                {staff.map((e) => (
                  <tr key={e.id}>
                    <td><div className="flex items-center gap-2.5"><Avatar name={e.full_name} size={30} />
                      <div><p className="text-xs font-bold">{e.full_name}</p><p className="num text-[10px] text-ink-400">{e.code}</p></div></div></td>
                    <td className="text-xs">{e.department}</td>
                    <td className="text-xs">{e.job_title}</td>
                    <td className="text-xs">{lang === 'ar' ? e.branch_ar : e.branch_en}</td>
                    <td className="num text-end text-xs font-bold">{money(e.salary, 'SAR', lang)}</td>
                    <td className="text-xs">{fmtDate(e.hire_date, lang)}</td>
                    <td>{can('admin.employees.write') && (
                      <button onClick={() => setEdit(e)} className="btn-ghost btn-sm"><KeyRound size={13} /></button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>{t('auth.user')}</th><th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                <th>{t('adm.roles')}</th><th>{lang === 'ar' ? 'الفرع' : 'Branch'}</th>
                <th>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</th>
                <th>{lang === 'ar' ? 'آخر دخول' : 'Last login'}</th><th>{t('c.status')}</th>
                <th>{t('c.actions')}</th>
              </tr></thead>
              <tbody>
                {users.map((u) => {
                  const perms = q<Row>('SELECT COUNT(*) AS v FROM role_permissions WHERE role=?', [u.role])[0]?.v ?? 0;
                  return (
                    <tr key={u.id}>
                      <td className="num text-xs font-bold">{u.username}</td>
                      <td className="text-xs">{u.full_name}</td>
                      <td><Badge tone={ROLE_META[u.role]?.tone ?? 'neutral'}>{lang === 'ar' ? ROLE_META[u.role]?.ar : ROLE_META[u.role]?.en}</Badge></td>
                      <td className="text-xs">{u.branch_ar}</td>
                      <td className="num text-xs">{u.role === 'admin' ? '∞' : perms}</td>
                      <td className="text-xs text-ink-500">{u.last_login_at ? fmtDate(u.last_login_at, lang) : '—'}</td>
                      <td><Badge tone={u.status === 'active' ? 'good' : 'bad'}>{u.status}</Badge></td>
                      <td>
                        <button onClick={() => setPwd(u)} className="btn-ghost btn-sm"><KeyRound size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'techs' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {techs.map((x) => (
              <div key={x.id} className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
                <div className="mb-2 flex items-center gap-3">
                  <Avatar name={x.name} size={40} />
                  <div><p className="font-bold">{x.name}</p><p className="text-xs text-ink-500">{x.specialty}</p></div>
                  <Badge tone="ai" className="ms-auto">★ {x.rating}</Badge>
                </div>
                <p className="num text-xs text-ink-500">{lang === 'ar' ? 'السعة القصوى' : 'Capacity'}: {x.max_active}</p>
                <p className="mt-1.5 truncate text-[10px] text-ink-400">{x.skills}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'roles' && (
          <div className="space-y-4">
            {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
              <div key={role} className="rounded-2xl border border-ink-100 p-5 dark:border-white/10">
                <div className="mb-3 flex items-center gap-3">
                  <Badge tone={ROLE_META[role]?.tone ?? 'neutral'}>{lang === 'ar' ? ROLE_META[role]?.ar : ROLE_META[role]?.en}</Badge>
                  <span className="num text-xs text-ink-400">{role} · {perms.includes('*') ? '∞' : perms.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(perms.includes('*') ? PERMISSIONS.map((p) => p.code) : perms).map((p) => {
                    const meta = PERMISSIONS.find((x) => x.code === p);
                    return (
                      <span key={p} className="chip border-ink-200 text-[10px] text-ink-500 dark:border-white/12 dark:text-ink-400">
                        {meta ? (lang === 'ar' ? meta.label_ar : meta.label_en) : p}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div className="table-wrap max-h-[560px] overflow-y-auto">
            <table className="tbl">
              <thead><tr>
                <th>{t('c.date')}</th><th>{t('auth.user')}</th><th>{lang === 'ar' ? 'الإجراء' : 'Action'}</th>
                <th>{lang === 'ar' ? 'الكيان' : 'Entity'}</th><th className="text-end">ID</th><th>{'IP'}</th>
              </tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="num text-xs">{fmtDate(l.at, lang)}</td>
                    <td className="num text-xs font-bold">{l.username ?? '—'}</td>
                    <td><Badge tone={l.action === 'DELETE' || l.action === 'CANCEL' ? 'bad' : l.action === 'CREATE' ? 'good' : 'neutral'}>{l.action}</Badge></td>
                    <td className="text-xs">{l.entity}</td>
                    <td className="num text-end text-xs">{l.entity_id ?? '—'}</td>
                    <td className="num text-[10px] text-ink-400">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EmployeeModal emp={edit} branches={branches} onClose={() => setEdit(null)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
      <PasswordModal user={pwd} onClose={() => setPwd(null)}
        onDone={(m) => toast.push({ kind: 'success', title: t('c.success'), body: m })} />
    </div>
  );
}

function EmployeeModal({ emp, branches, onClose, onDone }: { emp: Row | null; branches: Row[]; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const isNew = !!emp?.isNew;
  const [f, setF] = useState<any>({});
  const [init, setInit] = useState('');

  if (emp && init !== String(emp.id ?? 'new')) {
    setInit(String(emp.id ?? 'new'));
    setF({ full_name: emp.full_name ?? '', department: emp.department ?? '', job_title: emp.job_title ?? '',
      branch_id: emp.branch_id ?? 1, salary: emp.salary ?? 0, hire_date: emp.hire_date ?? new Date().toISOString().slice(0, 10), phone: emp.phone ?? '' });
  }

  const save = () => {
    if (!f.full_name?.trim()) { onDone(lang === 'ar' ? 'الاسم مطلوب' : 'Name required'); return; }
    try {
      if (isNew) {
        insert('employees', { ...f, code: `EMP-${String(Date.now()).slice(-5)}`, status: 'active' });
      } else update('employees', emp!.id, f);
      onDone(f.full_name); onClose();
    } catch (e: any) { onDone(String(e.message)); }
  };

  return (
    <Modal open={!!emp} onClose={onClose} title={isNew ? t('adm.new') : t('adm.edit')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save}>{t('adm.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={lang === 'ar' ? 'الاسم الكامل' : 'Full name'} required>
          <Input value={f.full_name ?? ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </Field>
        <Field label={lang === 'ar' ? 'القسم' : 'Department'}>
          <Input value={f.department ?? ''} onChange={(e) => setF({ ...f, department: e.target.value })} />
        </Field>
        <Field label={lang === 'ar' ? 'المسمى الوظيفي' : 'Job title'}>
          <Input value={f.job_title ?? ''} onChange={(e) => setF({ ...f, job_title: e.target.value })} />
        </Field>
        <Field label={lang === 'ar' ? 'الفرع' : 'Branch'}>
          <Select value={f.branch_id ?? 1} onChange={(e) => setF({ ...f, branch_id: +e.target.value })}>
            {branches.map((b) => <option key={b.id} value={b.id}>{lang === 'ar' ? b.name_ar : b.name_en}</option>)}
          </Select>
        </Field>
        <Field label={lang === 'ar' ? 'الراتب' : 'Salary'}>
          <Input value={f.salary ?? 0} onChange={(e) => setF({ ...f, salary: +e.target.value || 0 })} dir="ltr" inputMode="decimal" />
        </Field>
        <Field label={lang === 'ar' ? 'تاريخ التعيين' : 'Hire date'}>
          <Input type="date" value={f.hire_date ?? ''} onChange={(e) => setF({ ...f, hire_date: e.target.value })} dir="ltr" />
        </Field>
      </div>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onDone }: { user: Row | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t, lang } = useI18n();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && role === '') setRole(user.role);
  const score = pw ? passwordScore(pw) : null;

  const save = async () => {
    if (pw.length < 8) { onDone(lang === 'ar' ? 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)' : 'Password too short (min 8)'); return; }
    if (pw !== pw2) { onDone(lang === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return; }
    setBusy(true);
    try {
      const salt = randomSalt();
      const h = await hashPassword(pw, salt);
      update('users', user!.id, { pass_hash: h, pass_salt: salt, role, failed_logins: 0 });
      onDone(`${user!.username} → ${role}`); onClose(); setPw(''); setPw2('');
    } catch (e: any) { onDone(String(e.message)); }
    setBusy(false);
  };

  const tones = ['bg-red-500', 'bg-red-400', 'bg-amber-500', 'bg-lime-500', 'bg-signal-500'];

  return (
    <Modal open={!!user} onClose={onClose} title={`${lang === 'ar' ? 'الحساب والصلاحيات' : 'Account & role'} — ${user?.username ?? ''}`} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save} loading={busy}>{t('adm.save')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('adm.roles')}>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.keys(ROLE_PERMISSIONS).map((r) => (
              <option key={r} value={r}>{lang === 'ar' ? ROLE_META[r]?.ar : ROLE_META[r]?.en} ({r})</option>
            ))}
          </Select>
        </Field>
        <Field label={t('auth.pass')} hint={lang === 'ar' ? '8 أحرف على الأقل' : 'minimum 8 characters'}>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" />
        </Field>
        {score && (
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-ink-500">{t('auth.strength')}</span>
              <span className="font-bold">{lang === 'ar' ? score.label : ['', 'Weak', 'Fair', 'Good', 'Strong'][score.score]}</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < score.score ? tones[score.score] : 'bg-ink-200 dark:bg-white/10'}`} />
              ))}
            </div>
          </div>
        )}
        <Field label={t('auth.pass') + ' ×2'}>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" />
        </Field>
      </div>
    </Modal>
  );
}
