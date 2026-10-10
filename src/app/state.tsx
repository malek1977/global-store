/* =====================================================================
 *  GLOBAL STORE — application state: theme, auth (RBAC), cart, live data
 * ===================================================================== */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { initDB, getDB, subscribe, q, one, update, type Row } from '../db/db';
import {
  verifyPassword, throttle, noteFailure, clearFailures, can, randomToken, ROLE_PERMISSIONS,
  type Role,
} from '../lib/security';
import { round2 } from '../lib/format';

/* ============================================================== THEME */
const ThemeCtx = createContext<{ theme: 'light' | 'dark'; toggle: () => void }>(null as any);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gs.theme') as 'light' | 'dark' | null;
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gs.theme', theme);
  }, [theme]);
  const v = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme]);
  return <ThemeCtx.Provider value={v}>{children}</ThemeCtx.Provider>;
}

/* =============================================================== DATA */
const ReadyCtx = createContext<{ ready: boolean; version: number }>(null as any);
export const useReady = () => useContext(ReadyCtx);

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    initDB()
      .catch((e) => console.error('DB init failed', e))
      .finally(() => {
        if (alive) { setReady(true); setVersion((v) => v + 1); }
      });
    const unsub = subscribe(() => setVersion((v) => v + 1));
    return () => { alive = false; unsub(); };
  }, []);
  return <ReadyCtx.Provider value={{ ready, version }}>{children}</ReadyCtx.Provider>;
}

/** Live query — re-runs whenever the database mutates. */
export function useQuery<T = Row>(fn: () => T, deps: any[] = []): T {
  const { version } = useContext(ReadyCtx);
  return useMemo(() => {
    try { return fn(); } catch { return [] as unknown as T; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);
}

export function useScalar<T extends number = number>(sql: string, params: any[] = []): T {
  return useQuery<T>(() => {
    const r = one<any>(sql, params);
    return r ? (Object.values(r)[0] as T) : (0 as unknown as T);
  }, [sql, JSON.stringify(params)]);
}

/* =============================================================== AUTH */
export interface User {
  id: number; username: string; full_name: string; email: string;
  role: Role; branch_id: number | null; status: string; last_login_at: string | null;
  permissions: string[];
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (u: string, p: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  can: (perm: string) => boolean;
}

const AuthCtx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(AuthCtx);

const SESSION_KEY = 'gs.session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready: dbReady } = useContext(ReadyCtx);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const hydrate = useCallback((id: number) => {
    const u = one<Row>('SELECT * FROM users WHERE id=?', [id]);
    if (!u || u.status !== 'active') { setUser(null); return; }
    const perms = q<{ permission_code: string }>('SELECT permission_code FROM role_permissions WHERE role=?', [u.role]).map((r) => r.permission_code);
    setUser({ ...(u as User), permissions: ROLE_PERMISSIONS[(u.role as Role)] ?? perms });
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      const s = one<Row>('SELECT * FROM sessions WHERE id=? AND revoked=0 AND expires_at > datetime("now")', [token]);
      if (s) hydrate(s.user_id);
    }
    setReady(true);
  }, [dbReady, hydrate]);

  const login = useCallback(async (username: string, password: string) => {
    const key = `login:${username}`;
    const t = throttle(key);
    if (t.blocked) return { ok: false, error: `locked:${t.secsLeft}` };

    const u = one<Row>('SELECT * FROM users WHERE username=? COLLATE NOCASE', [username.trim()]);
    if (!u) { noteFailure(key); return { ok: false, error: 'invalid' }; }
    if (u.status !== 'active') return { ok: false, error: 'disabled' };

    const okPw = await verifyPassword(password, u.pass_salt, u.pass_hash);
    if (!okPw) {
      const left = noteFailure(key);
      update('users', u.id, { failed_logins: (u.failed_logins ?? 0) + 1 });
      return { ok: false, error: left <= 0 ? 'locked:60' : `invalid:${left}` };
    }
    clearFailures(key);
    const token = randomToken(32);
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    update('users', u.id, { last_login_at: new Date().toISOString().slice(0, 19).replace('T', ' '), failed_logins: 0 });
    getDB().run(
      `INSERT INTO sessions (id,user_id,ip,user_agent,expires_at) VALUES (?,?,?,?,?)`,
      [token, u.id, '127.0.0.1', navigator.userAgent.slice(0, 120), expires]);
    localStorage.setItem(SESSION_KEY, token);
    hydrate(u.id);
    return { ok: true };
  }, [hydrate]);

  const logout = useCallback(() => {
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      try {
        getDB().run(`UPDATE sessions SET revoked=1 WHERE id=?`, [token]);
      } catch { /* noop */ }
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const check = useCallback((perm: string) => {
    if (!user) return false;
    return can(user.role, perm);
  }, [user]);

  const v = useMemo(() => ({ user, ready, login, logout, can: check }), [user, ready, login, logout, check]);
  return <AuthCtx.Provider value={v}>{children}</AuthCtx.Provider>;
}

/* =============================================================== CART */
export interface CartItem { product_id: number; qty: number; price: number; name: string; nameEn: string; image?: string; max: number }

interface CartCtx {
  items: CartItem[];
  add: (p: { id: number; qty: number; price: number; name: string; nameEn: string; max: number }, mode?: 'add' | 'set') => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  vat: number;
  total: number;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CartCtx = createContext<CartCtx>(null as any);
export const useCart = () => useContext(CartCtx);

const CART_KEY = 'gs.cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(items)); }, [items]);

  const add = useCallback((p: { id: number; qty: number; price: number; name: string; nameEn: string; max: number }, mode: 'add' | 'set' = 'add') => {
    setItems((cur) => {
      const i = cur.findIndex((x) => x.product_id === p.id);
      if (i === -1) return [...cur, { product_id: p.id, qty: Math.min(p.qty, p.max || p.qty), price: p.price, name: p.name, nameEn: p.nameEn, max: p.max }];
      const next = [...cur];
      const want = mode === 'set' ? p.qty : next[i].qty + p.qty;
      next[i] = { ...next[i], qty: p.max ? Math.min(p.max, want) : want, price: p.price };
      return next;
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    setItems((cur) => cur.map((x) => (x.product_id === id ? { ...x, qty: x.max ? Math.max(0, Math.min(x.max, qty)) : Math.max(0, qty) } : x)));
  }, []);
  const remove = useCallback((id: number) => setItems((cur) => cur.filter((x) => x.product_id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const subtotal = round2(items.reduce((t, i) => t + i.qty * i.price, 0));
  const vat = round2(subtotal * 0.15);
  const total = round2(subtotal + vat);
  const count = items.reduce((t, i) => t + i.qty, 0);

  const v = useMemo(
    () => ({ items, add, setQty, remove, clear, count, subtotal, vat, total, open, setOpen }),
    [items, add, setQty, remove, clear, subtotal, vat, total, open],
  );
  return <CartCtx.Provider value={v}>{children}</CartCtx.Provider>;
}

/* =========================================================== COMPANY */
export function useCompany() {
  return useQuery<Row>(() => one<Row>('SELECT * FROM company WHERE id=1') ?? ({} as Row), []);
}
