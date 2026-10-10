/* =====================================================================
 *  Auth — password hashing, sessions, CSRF, lockout
 * ===================================================================== */
import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db, issueTokens, signAccess, clearSession, verifyToken } from '../lib/core.js';
import { audit } from '../lib/audit.js';
import { clean } from '../lib/http.js';

export const router = Router();

/**
 * Credential format is shared with the front office so a user created in
 * either tier can sign in to the other:
 *   salt  = base64(16 random bytes)
 *   hash  = base64(PBKDF2-SHA256(password, raw(salt), 150_000, 32))
 */
const ITER = 150_000;
const KEYLEN = 32;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('base64')) {
  const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), ITER, KEYLEN, 'sha256').toString('base64');
  return { hash, salt };
}

export function verifyPassword(password, salt, expected) {
  let actual, want;
  try {
    actual = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), ITER, KEYLEN, 'sha256');
    want = Buffer.from(expected, 'base64');
  } catch { return false; }
  return actual.length === want.length && crypto.timingSafeEqual(actual, want);
}

const credentials = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(256),
});

const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

function lockState(user) {
  if (!user?.locked_until) return { locked: false };
  const until = new Date(user.locked_until.replace(' ', 'T') + 'Z').getTime();
  if (Date.now() > until) {
    db.prepare('UPDATE users SET locked_until=NULL, failed_logins=0 WHERE id=?').run(user.id);
    return { locked: false };
  }
  return { locked: true, until: user.locked_until };
}

/** POST /api/auth/login */
router.post('/login', (req, res, next) => {
  try {
    const { username, password } = credentials.parse(req.body);

    // constant-ish work even when the user does not exist
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
    ).get(clean(username, 64));

    if (!user) {
      hashPassword(password);                       // burn CPU to blunt user-enumeration timing
      audit(db, { action: 'LOGIN_FAIL', entity: 'users', after: { username: clean(username, 64) }, req });
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const lock = lockState(user);
    if (lock.locked) return res.status(423).json({ error: 'account_locked', until: lock.until });

    if (user.status !== 'active') return res.status(403).json({ error: 'account_disabled' });

    if (!verifyPassword(password, user.pass_salt, user.pass_hash)) {
      const failed = (user.failed_logins ?? 0) + 1;
      db.prepare(
        `UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?`,
      ).run(failed, failed >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS).toISOString().slice(0, 19).replace('T', ' ') : null, user.id);
      audit(db, { user, action: 'LOGIN_FAIL', entity: 'users', entityId: user.id, req });
      return res.status(401).json({ error: 'invalid_credentials', attempts_left: Math.max(0, MAX_ATTEMPTS - failed) });
    }

    db.prepare(
      `UPDATE users SET failed_logins=0, locked_until=NULL, last_login_at=datetime('now') WHERE id=?`,
    ).run(user.id);

    const { access, refresh } = issueTokens(user);
    const csrf = crypto.randomBytes(24).toString('hex');

    res.cookie('gs_access', access, { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/api', maxAge: 15 * 60 * 1000 });
    res.cookie('gs_refresh', refresh, { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/api/auth', maxAge: 7 * 24 * 3600 * 1000 });
    res.cookie('gs_csrf', csrf, { httpOnly: false, secure: req.secure, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 3600 * 1000 });

    audit(db, { user, action: 'LOGIN', entity: 'users', entityId: user.id, req });

    res.json({
      csrf,
      access,
      expires_in: 900,
      user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role, branch_id: user.branch_id },
    });
  } catch (e) { next(e); }
});

/** POST /api/auth/refresh */
router.post('/refresh', (req, res, next) => {
  try {
    const token = req.cookies?.gs_refresh;
    const payload = verifyToken(token, 'refresh');
    if (!payload) return res.status(401).json({ error: 'invalid_refresh_token' });

    const session = db.prepare('SELECT * FROM sessions WHERE id=? AND revoked=0 AND expires_at > datetime("now")').get(token);
    if (!session) return res.status(401).json({ error: 'session_expired' });

    const user = db.prepare('SELECT * FROM users WHERE id=? AND status=\'active\'').get(payload.sub);
    if (!user) return res.status(403).json({ error: 'account_disabled' });

    const access = signAccess(user);
    res.cookie('gs_access', access, { httpOnly: true, secure: req.secure, sameSite: 'strict', path: '/api', maxAge: 15 * 60 * 1000 });
    res.json({ access, expires_in: 900 });
  } catch (e) { next(e); }
});

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  const token = req.cookies?.gs_refresh;
  if (token) clearSession(token);
  audit(db, { action: 'LOGOUT', req });
  res.clearCookie('gs_access', { path: '/api' });
  res.clearCookie('gs_refresh', { path: '/api/auth' });
  res.clearCookie('gs_csrf', { path: '/' });
  res.json({ ok: true });
});

/** GET /api/auth/me */
router.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});
