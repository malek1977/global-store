# 🔐 Global Store API — Security & Deployment Guide

Secure REST backend for the Global Store platform (storefront + accounting + administration).

## Security layers

| Layer | Implementation |
|-------|----------------|
| **Passwords** | PBKDF2-SHA256, **210,000** iterations, 16-byte random salt per user, `timingSafeEqual` comparison |
| **Account lockout** | 5 failed attempts → 10-minute lock; counters reset on success |
| **User enumeration** | Unknown usernames still burn a PBKDF2 cycle so timing is identical |
| **Sessions** | Short-lived access JWT (15m) + rotating refresh token (7d) stored in `httpOnly`, `secure`, `sameSite=strict` cookies |
| **CSRF** | Double-submit token (`gs_csrf` cookie ⇄ `X-CSRF-Token` header) on every cookie-authenticated mutation; bearer tokens are immune |
| **RBAC** | 6 roles × 19 granular permissions, enforced per-route via `requirePermission` |
| **Rate limiting** | 600 req / 15 min global · 5 login attempts / 15 min on the auth route (`skipSuccessfulRequests`) |
| **Headers** | Helmet: strict CSP, HSTS (1y + preload), `frame-ancestors: none`, `noSniff`, `referrerPolicy: strict-origin-when-cross-origin` |
| **CORS** | Explicit origin allow-list with credentials; `X-Powered-By` disabled |
| **Input validation** | Zod schemas on every mutation; control-character stripping, length caps, HTML stripping |
| **SQL** | Prepared statements everywhere; `foreign_keys=ON`; no string interpolation |
| **Audit** | Immutable `audit_log` for every write with actor, IP, before/after diff |
| **Body limits** | 1 MB JSON cap · compression enabled · `trust proxy` for correct client IPs |

## Environment

```bash
cp .env.example .env
# MUST change JWT_SECRET to a 64+ char random string before production
```

## Run locally

```bash
npm install
npm run dev          # http://localhost:8080
```

## Deploy

The included configs target the major Node-friendly clouds:

- **Render** — `render.yaml` (web service + managed Postgres), just connect the repo and set `CORS_ORIGINS`.
- **Docker** — build `server/Dockerfile`, expose `8080`, mount a volume at `/app/data`.
- **Fly.io / Railway / any VPS** — `npm ci --omit=dev && node src/index.js`; set `JWT_SECRET` + `CORS_ORIGINS`.

Health check endpoint: `GET /api/health` (safe for load balancers — no auth, no PII).

## API surface

```
POST   /api/auth/login | refresh | logout     GET /api/auth/me
GET    /api/catalog/products | products/:id | categories | brands | company
GET    /api/catalog/orders/track?order_no=&phone=      (public, needs both)
GET    /api/catalog/repairs/track?ticket_no=&phone=    (public, needs both)
POST   /api/repairs/tickets | /api/repairs/triage      (public booking / AI estimate)
GET    /api/accounting/trial-balance | ledger/:code | income-statement | balance-sheet | vat
POST   /api/accounting/journals | journals/:id/reverse
GET    /api/admin/dashboard | inventory | inventory/movements | partners | users | audit
POST   /api/admin/inventory/adjust | partners | payments
PATCH  /api/admin/users/:id/password | /api/admin/company
```

Every mutating endpoint writes to the `audit_log` and, where it affects money, posts a
**balanced double-entry journal** server-side (`lib/accounting.js` rejects unbalanced entries).

## Relationship to the front office

The React app ships with a fully functional embedded SQLite engine so it runs standalone
(the demo you can open right now). This API is the production backend: it enforces the
same schema, the same RBAC matrix, and the same accounting rules on a real server-side
database. Point the front office at `VITE_API_URL` and swap the local data layer for the
REST client to move from demo → production without changing any business logic.
