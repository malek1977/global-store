/* =====================================================================
 *  Back-office layout — sidebar, topbar, role-aware navigation
 * ===================================================================== */
import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, ShoppingCart, Wrench, UserCog, Settings,
  Calculator, BookOpen, FileText, Receipt, Percent, Sparkles, Menu, X, Sun, Moon,
  Globe, LogOut, Store, Bell, ChevronDown, ShieldCheck, Search,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth, useTheme, useCart, useQuery } from '../app/state';
import { Logo, Avatar, Badge, Button, Modal } from '../ui/primitives';
import { RequireAuth } from '../app/RequireAuth';
import { q, type Row } from '../db/db';
import { money } from '../lib/format';
import { refreshInsights } from '../ai/engine';

export default function AppLayout() {
  const { t, lang, toggleLang, isRTL } = useI18n();
  const { theme, toggle } = useTheme();
  const { user, logout, can } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => { setOpen(false); setMenu(false); }, [loc.pathname]);

  const unread = useQuery(() => q<Row>(`SELECT COUNT(*) AS v FROM ai_insights WHERE is_read=0`)[0]?.v ?? 0, []);

  const groups = [
    {
      label: t('nav.admin'), items: [
        { to: '/app/dashboard', label: t('dash.title'), Icon: LayoutDashboard, perm: '' },
        { to: '/app/inventory', label: t('adm.inventory'), Icon: Package, perm: 'admin.inventory.view' },
        { to: '/app/partners', label: t('adm.partners'), Icon: Users, perm: 'admin.partners.view' },
        { to: '/app/purchases', label: t('adm.purchases'), Icon: ShoppingCart, perm: 'admin.purchases.view' },
        { to: '/app/repairs', label: t('adm.repairs'), Icon: Wrench, perm: 'repairs.view' },
        { to: '/app/employees', label: t('adm.employees'), Icon: UserCog, perm: 'admin.employees.view' },
      ],
    },
    {
      label: t('nav.accounting'), items: [
        { to: '/app/accounting', label: t('acc.dashboard'), Icon: Calculator, perm: 'accounting.view' },
        { to: '/app/accounting/invoices', label: t('acc.sales'), Icon: FileText, perm: 'accounting.view' },
        { to: '/app/accounting/payments', label: t('acc.payments'), Icon: Receipt, perm: 'accounting.view' },
        { to: '/app/accounting/ledger', label: t('acc.ledger'), Icon: BookOpen, perm: 'accounting.view' },
        { to: '/app/accounting/statements', label: t('acc.statements'), Icon: Calculator, perm: 'accounting.view' },
        { to: '/app/accounting/vat', label: t('acc.vat'), Icon: Percent, perm: 'accounting.view' },
      ],
    },
    {
      label: t('c.all'), items: [
        { to: '/app/ai', label: t('nav.ai'), Icon: Sparkles, perm: '' },
        { to: '/app/settings', label: t('adm.users'), Icon: ShieldCheck, perm: '' },
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => nav('/')}><Logo size={36} /></button>
        <button onClick={() => setOpen(false)} className="btn-ghost !px-2 lg:hidden"><X size={18} /></button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-ink-400">{g.label}</p>
              <div className="space-y-0.5">
                {items.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-brand-500 text-white shadow-[0_8px_18px_-10px_rgba(242,103,34,.9)]'
                          : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/5'}`}>
                    <Icon size={17} className="shrink-0" />
                    <span className="truncate">{label}</span>
                    {to === '/app/ai' && unread > 0 && (
                      <span className="num ms-auto rounded-full bg-ai-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-ink-100 p-3 dark:border-white/10">
        <button onClick={() => setMenu(true)}
          className="flex w-full items-center gap-2.5 rounded-xl p-2 text-start transition hover:bg-ink-100 dark:hover:bg-white/5">
          <Avatar name={user?.full_name ?? '?'} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.full_name}</p>
            <p className="truncate text-[11px] text-ink-500">{user?.role}</p>
          </div>
          <ChevronDown size={15} className="text-ink-400" />
        </button>
      </div>
    </div>
  );

  const titles: Record<string, string> = {
    '/app/dashboard': t('dash.title'),
    '/app/inventory': t('adm.inventory'),
    '/app/partners': t('adm.partners'),
    '/app/purchases': t('adm.purchases'),
    '/app/repairs': t('adm.repairs'),
    '/app/employees': t('adm.employees'),
    '/app/accounting': t('acc.dashboard'),
    '/app/accounting/invoices': t('acc.sales'),
    '/app/accounting/payments': t('acc.payments'),
    '/app/accounting/ledger': t('acc.ledger'),
    '/app/accounting/statements': t('acc.statements'),
    '/app/accounting/vat': t('acc.vat'),
    '/app/ai': t('nav.ai'),
    '/app/settings': t('adm.users'),
  };

  return (
    <div className="flex min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* ------------------------------------------------------ sidebar */}
      <aside className="fixed inset-y-0 hidden w-[260px] border-e border-ink-100 bg-white dark:border-white/10 dark:bg-ink-900 lg:block">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <aside className={`absolute inset-y-0 w-[270px] bg-white dark:bg-ink-900 ${isRTL ? 'right-0 border-l' : 'left-0 border-r'} border-ink-100 dark:border-white/10`}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ---------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col lg:ms-[260px]">
        <header className="glass-bar sticky top-0 z-40 flex h-16 items-center gap-2 px-4 sm:px-6">
          <button onClick={() => setOpen(true)} className="btn-ghost !px-2 lg:hidden"><Menu size={20} /></button>

          <h1 className="truncate text-base font-extrabold tracking-tight sm:text-lg">{titles[loc.pathname] ?? t('app.name')}</h1>

          <div className="ms-auto flex items-center gap-1">
            <button onClick={() => { try { refreshInsights(); } catch {} ; nav('/app/ai'); }}
              className="btn-ghost !px-2" title={t('ai.refresh')}><Sparkles size={18} className="text-ai-500" /></button>
            <button onClick={toggle} className="btn-ghost !px-2">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={toggleLang} className="btn-ghost gap-1 !px-2.5">
              <Globe size={17} /><span className="text-xs font-extrabold">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <button onClick={() => cart.setOpen(true)} className="btn-ghost relative !px-2.5 lg:hidden">
              <Store size={18} />
              {cart.count > 0 && <span className="num absolute -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">{cart.count}</span>}
            </button>
            <Link to="/" className="btn-ghost !px-2" title={t('nav.store')}><Store size={18} /></Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <RequireAuth><Outlet /></RequireAuth>
        </main>
      </div>

      {/* --------------------------------------------------- user modal */}
      <Modal open={menu} onClose={() => setMenu(false)} title={lang === 'ar' ? 'الحساب' : 'Account'} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setMenu(false)}>{t('c.close')}</Button>
          <Button variant="dark" icon={<LogOut size={15} />} onClick={() => { logout(); nav('/'); }}>{t('nav.logout')}</Button>
        </>}>
        <div className="flex items-center gap-3">
          <Avatar name={user?.full_name ?? '?'} size={52} />
          <div>
            <p className="font-bold">{user?.full_name}</p>
            <p className="text-xs text-ink-500">{user?.email}</p>
            <Badge tone="brand" className="mt-1.5">{user?.role}</Badge>
          </div>
        </div>
        <div className="divider" />
        <p className="label">{lang === 'ar' ? 'الصلاحيات الممنوحة' : 'Granted permissions'}</p>
        <div className="flex flex-wrap gap-1.5">
          {(user?.permissions ?? []).slice(0, 24).map((pp) => (
            <span key={pp} className="chip border-ink-200 text-[10px] text-ink-500 dark:border-white/12 dark:text-ink-400">{pp}</span>
          ))}
        </div>
      </Modal>
    </div>
  );
}
