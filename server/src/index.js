/* =====================================================================
 *  GLOBAL STORE — API bootstrap
 *  Security-first Express service: helmet CSP, rate limits, httpOnly
 *  cookie JWTs, RBAC, input validation and an immutable audit trail.
 * ===================================================================== */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';

import { db, authenticate, isProd, JWT_SECRET } from './lib/core.js';
import { router as authRouter } from './routes/auth.js';
import { router as catalogRouter } from './routes/catalog.js';
import { router as salesRouter } from './routes/sales.js';
import { router as repairsRouter } from './routes/repairs.js';
import { router as accountingRouter } from './routes/accounting.js';
import { router as adminRouter } from './routes/admin.js';

if (isProd && JWT_SECRET.startsWith('dev-only')) {
  console.error('FATAL: JWT_SECRET must be set to a long random value in production.');
  process.exit(1);
}

/* --------------------------------------------------------------- app */
export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => (!origin || origins.length === 0 || origins.includes(origin) ? cb(null, true) : cb(new Error('CORS rejected'))),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

/* -------------------------------------------------------- rate limits */
app.use('/api', rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
}));

app.use('/api/auth/login', rateLimit({
  windowMs: Number(process.env.LOGIN_WINDOW_MS ?? 900_000),
  max: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  skipSuccessfulRequests: true,
  message: { error: 'too_many_login_attempts' },
}));

/* -------------------------------------------------------------- CSRF
 * Must run BEFORE the routers so every state-changing request is checked.
 * Bearer-authenticated calls are immune (no ambient cookie authority).
 * The auth entry points are exempt: they are the calls that *issue* the
 * CSRF token, and they cannot be driven by an ambient cookie alone.
 */
const CSRF_EXEMPT = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']);

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers.authorization) return next();
  if (CSRF_EXEMPT.has(req.path)) return next();
  const cookie = req.cookies?.gs_csrf;
  const header = req.headers['x-csrf-token'];
  if (!cookie || cookie !== header) return res.status(403).json({ error: 'csrf_token_mismatch' });
  next();
});

/* ------------------------------------------------------------ routes */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'global-store-api',
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    uptime_s: Math.round(process.uptime()),
    ts: Date.now(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/sales', authenticate, salesRouter);
app.use('/api/repairs', authenticate, repairsRouter);
app.use('/api/accounting', authenticate, accountingRouter);
app.use('/api/admin', authenticate, adminRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

/* ---------------------------------------------------------- fallbacks */
app.use((err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'validation_failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err?.code === 'unbalanced_journal') return res.status(422).json({ error: 'unbalanced_journal', message: err.message });
  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'duplicate_record' });
  if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(422).json({ error: 'referenced_record_missing' });
  if (err?.message === 'CORS rejected') return res.status(403).json({ error: 'origin_not_allowed' });
  console.error('[api]', req.method, req.originalUrl, err);
  res.status(err?.status ?? 500).json({ error: 'internal_error' });
});

const PORT = Number(process.env.PORT ?? 8080);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`🌐 Global Store API on :${PORT} (${isProd ? 'production' : 'development'})`));
}

export { db };
export default app;
