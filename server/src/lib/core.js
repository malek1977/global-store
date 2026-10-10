/* =====================================================================
 *  Core — database handle, JWT sessions and request authentication.
 *  Kept separate from the HTTP bootstrap so route modules can import it
 *  without creating a circular dependency.
 * ===================================================================== */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

export const JWT_SECRET = process.env.JWT_SECRET
  ?? 'dev-only-secret-change-me-please-0123456789abcdefghijklmnop';

const rawUrl = process.env.DATABASE_URL ?? path.join(__dirname, '../../data/global-store.db');
// better-sqlite3 wants a plain path (a `file:` URI works only for libsql/Turso remotes)
export const DB_FILE = rawUrl.replace(/^file:/, '');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
if (fs.existsSync(schemaPath)) db.exec(fs.readFileSync(schemaPath, 'utf8'));

export const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '7d';

export function signAccess(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, typ: 'access' }, JWT_SECRET,
    { expiresIn: ACCESS_TTL, issuer: 'global-store' });
}

export function issueTokens(user) {
  const access = signAccess(user);
  const refresh = jwt.sign({ sub: String(user.id), typ: 'refresh' }, JWT_SECRET,
    { expiresIn: REFRESH_TTL, issuer: 'global-store' });
  db.prepare(
    `INSERT INTO sessions (id, user_id, ip, user_agent, expires_at) VALUES (?,?,?,?, datetime('now', ?))`,
  ).run(refresh, user.id, null, null, `+${REFRESH_TTL.replace(/[a-z]/gi, '')} seconds`);
  return { access, refresh };
}

export function clearSession(refreshToken) {
  db.prepare('UPDATE sessions SET revoked=1 WHERE id=?').run(refreshToken);
}

export function verifyToken(token, expected = 'access') {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'global-store' });
    return payload.typ === expected ? payload : null;
  } catch { return null; }
}

export function authenticate(req, res, next) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const token = bearer ?? req.cookies?.gs_access;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  const payload = verifyToken(token, 'access');
  if (!payload) return res.status(401).json({ error: 'invalid_token' });
  const user = db.prepare(
    'SELECT id, username, full_name, email, role, branch_id, status FROM users WHERE id=?',
  ).get(payload.sub);
  if (!user || user.status !== 'active') return res.status(403).json({ error: 'account_disabled' });
  req.user = user;
  next();
}

export { isProd };
