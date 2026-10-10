-- =====================================================================
--  GLOBAL STORE  —  Unified Data Model
--  Modules: Storefront (المتجر) · Accounting (المحاسبة) · Admin (الإدارة)
--  Engine : SQLite (sql.js / libsql compatible DDL)
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- org
CREATE TABLE IF NOT EXISTS company (
  id            INTEGER PRIMARY KEY,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  tagline_ar    TEXT,
  tagline_en    TEXT,
  vat_number    TEXT,
  cr_number     TEXT,
  address_ar    TEXT,
  address_en    TEXT,
  phone         TEXT,
  email         TEXT,
  currency      TEXT NOT NULL DEFAULT 'SAR',
  vat_rate      REAL NOT NULL DEFAULT 0.15,
  fiscal_start  TEXT NOT NULL DEFAULT '01-01',
  logo          TEXT
);

CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'retail',      -- retail | wholesale | repair
  city        TEXT,
  phone       TEXT,
  address     TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1
);

-- ------------------------------------------------- identity & access
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'viewer',    -- admin|accountant|manager|technician|sales|viewer
  branch_id     INTEGER REFERENCES branches(id),
  pass_hash     TEXT NOT NULL,                     -- PBKDF2-SHA256 · webcrypto
  pass_salt     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',    -- active|locked|disabled
  mfa_enabled   INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  code       TEXT PRIMARY KEY,
  module     TEXT NOT NULL,                         -- store|accounting|admin
  label_ar   TEXT NOT NULL,
  label_en   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role            TEXT NOT NULL,
  permission_code TEXT NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role, permission_code)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------ parties
CREATE TABLE IF NOT EXISTS partners (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT UNIQUE NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'customer',   -- customer|supplier|both
  name             TEXT NOT NULL,
  company          TEXT,
  email            TEXT,
  phone            TEXT,
  city             TEXT,
  address          TEXT,
  tax_number       TEXT,
  credit_limit     REAL NOT NULL DEFAULT 0,
  payment_terms    INTEGER NOT NULL DEFAULT 0,          -- days
  opening_balance  REAL NOT NULL DEFAULT 0,
  balance          REAL NOT NULL DEFAULT 0,             -- + receivable / - payable
  loyalty_points   INTEGER NOT NULL DEFAULT 0,
  segment          TEXT DEFAULT 'retail',               -- retail|wholesale|vip|dead
  is_active        INTEGER NOT NULL DEFAULT 1,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------ catalog
CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  slug      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  icon      TEXT,
  parent_id INTEGER REFERENCES categories(id),
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS brands (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  slug     TEXT UNIQUE NOT NULL,
  name_ar  TEXT NOT NULL,
  name_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT UNIQUE NOT NULL,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'main',        -- main|branch|repair|virtual
  location  TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT UNIQUE NOT NULL,
  barcode         TEXT,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  desc_ar         TEXT,
  desc_en         TEXT,
  category_id     INTEGER REFERENCES categories(id),
  brand_id        INTEGER REFERENCES brands(id),
  unit            TEXT NOT NULL DEFAULT 'piece',
  cost_price      REAL NOT NULL DEFAULT 0,
  retail_price    REAL NOT NULL DEFAULT 0,
  wholesale_price REAL NOT NULL DEFAULT 0,
  vat_rate        REAL NOT NULL DEFAULT 0.15,
  qty             REAL NOT NULL DEFAULT 0,
  reorder_level   REAL NOT NULL DEFAULT 5,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  condition       TEXT NOT NULL DEFAULT 'new',    -- new|refurbished|used|part
  is_service      INTEGER NOT NULL DEFAULT 0,     -- 1 => repair service, no stock
  image           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_products_cat   ON products(category_id);
CREATE INDEX IF NOT EXISTS ix_products_brand ON products(brand_id);

CREATE TABLE IF NOT EXISTS price_lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier       TEXT NOT NULL DEFAULT 'retail',    -- retail|wholesale|vip
  min_qty    REAL NOT NULL DEFAULT 1,
  price      REAL NOT NULL,
  UNIQUE (product_id, tier, min_qty)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER REFERENCES warehouses(id),
  kind         TEXT NOT NULL,                    -- in|out|adjust|transfer|return|damage|warranty
  qty          REAL NOT NULL,
  unit_cost    REAL NOT NULL DEFAULT 0,
  ref_type     TEXT,
  ref_id       INTEGER,
  note         TEXT,
  user_id      INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_stock_prod ON stock_movements(product_id, created_at);

-- -------------------------------------------------------------- sales
CREATE TABLE IF NOT EXISTS sales_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no     TEXT UNIQUE NOT NULL,
  partner_id   INTEGER REFERENCES partners(id),
  branch_id    INTEGER REFERENCES branches(id),
  user_id      INTEGER REFERENCES users(id),
  channel      TEXT NOT NULL DEFAULT 'retail',   -- retail|wholesale|online
  status       TEXT NOT NULL DEFAULT 'confirmed',-- draft|confirmed|delivered|cancelled|returned
  subtotal     REAL NOT NULL DEFAULT 0,
  discount     REAL NOT NULL DEFAULT 0,
  vat_amount   REAL NOT NULL DEFAULT 0,
  total        REAL NOT NULL DEFAULT 0,
  cost_total   REAL NOT NULL DEFAULT 0,
  paid         REAL NOT NULL DEFAULT 0,
  ship_name    TEXT, ship_phone TEXT, ship_city TEXT, ship_address TEXT,
  note         TEXT,
  placed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS sales_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         REAL NOT NULL,
  unit_price  REAL NOT NULL,
  cost_price  REAL NOT NULL DEFAULT 0,
  discount    REAL NOT NULL DEFAULT 0,
  vat_rate    REAL NOT NULL DEFAULT 0.15,
  line_total  REAL NOT NULL
);

-- ----------------------------------------------------------- purchase
CREATE TABLE IF NOT EXISTS purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no     TEXT UNIQUE NOT NULL,
  partner_id   INTEGER NOT NULL REFERENCES partners(id),
  branch_id    INTEGER REFERENCES branches(id),
  user_id      INTEGER REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'confirmed',-- draft|confirmed|received|cancelled
  subtotal     REAL NOT NULL DEFAULT 0,
  discount     REAL NOT NULL DEFAULT 0,
  vat_amount   REAL NOT NULL DEFAULT 0,
  total        REAL NOT NULL DEFAULT 0,
  paid         REAL NOT NULL DEFAULT 0,
  supplier_ref TEXT,
  due_date     TEXT,
  note         TEXT,
  ordered_at   TEXT NOT NULL DEFAULT (datetime('now')),
  received_at  TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  qty         REAL NOT NULL,
  unit_cost   REAL NOT NULL,
  vat_rate    REAL NOT NULL DEFAULT 0.15,
  line_total  REAL NOT NULL
);

-- ---------------------------------------------------------- payments
CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id  INTEGER REFERENCES partners(id),
  direction   TEXT NOT NULL DEFAULT 'in',   -- in (received) | out (paid)
  method      TEXT NOT NULL DEFAULT 'cash', -- cash|bank|card|transfer|cheque
  amount      REAL NOT NULL,
  reference   TEXT,
  order_id    INTEGER,
  journal_id  INTEGER,
  paid_at     TEXT NOT NULL DEFAULT (datetime('now')),
  user_id     INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_pay_partner ON payments(partner_id, paid_at);

-- --------------------------------------------------------- accounting
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT UNIQUE NOT NULL,
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  type        TEXT NOT NULL,                 -- asset|liability|equity|revenue|expense
  subtype     TEXT,
  parent_code TEXT,
  is_postable INTEGER NOT NULL DEFAULT 1,
  opening     REAL NOT NULL DEFAULT 0,
  is_system   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fiscal_years (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT UNIQUE NOT NULL,
  start     TEXT NOT NULL,
  end       TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'open',   -- open|closed
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS journals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_no  TEXT UNIQUE NOT NULL,
  entry_date  TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'general', -- opening|sale|purchase|payment|expense|repair|adjust|closing
  reference   TEXT,
  memo        TEXT,
  status      TEXT NOT NULL DEFAULT 'posted',  -- draft|posted
  source_table TEXT,
  source_id   INTEGER,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_journal_date ON journals(entry_date);

CREATE TABLE IF NOT EXISTS journal_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id  INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  partner_id  INTEGER REFERENCES partners(id),
  debit       REAL NOT NULL DEFAULT 0,
  credit      REAL NOT NULL DEFAULT 0,
  description TEXT
);
CREATE INDEX IF NOT EXISTS ix_jl_acc ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS ix_jl_jrn ON journal_lines(journal_id);

-- ----------------------------------------------------------- repairs
CREATE TABLE IF NOT EXISTS technicians (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  name        TEXT NOT NULL,
  specialty   TEXT,
  skills      TEXT,
  max_active  INTEGER NOT NULL DEFAULT 5,
  rating      REAL NOT NULL DEFAULT 4.5,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS repair_tickets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no     TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  device_brand  TEXT,
  device_model  TEXT NOT NULL,
  imei          TEXT,
  issue_ar      TEXT,
  issue_en      TEXT,
  diagnosis     TEXT,
  advice        TEXT,
  status        TEXT NOT NULL DEFAULT 'received',
    -- received|diagnosing|awaiting_parts|in_progress|testing|completed|delivered|cancelled
  priority      TEXT NOT NULL DEFAULT 'normal',   -- low|normal|high|urgent
  technician_id INTEGER REFERENCES technicians(id),
  branch_id     INTEGER REFERENCES branches(id),
  passcode_ok   INTEGER NOT NULL DEFAULT 0,
  est_cost      REAL NOT NULL DEFAULT 0,
  parts_cost    REAL NOT NULL DEFAULT 0,
  labor_cost    REAL NOT NULL DEFAULT 0,
  discount      REAL NOT NULL DEFAULT 0,
  final_cost    REAL NOT NULL DEFAULT 0,
  vat_rate      REAL NOT NULL DEFAULT 0.15,
  warranty_days INTEGER NOT NULL DEFAULT 30,
  ai_confidence REAL,
  ai_eta_hours  REAL,
  ai_risk       TEXT,
  intake_at     TEXT NOT NULL DEFAULT (datetime('now')),
  promised_at   TEXT,
  completed_at  TEXT,
  delivered_at  TEXT,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS ix_ticket_status ON repair_tickets(status);

CREATE TABLE IF NOT EXISTS repair_parts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  label      TEXT NOT NULL,
  qty        REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'stock'   -- stock|supplier|customer
);

CREATE TABLE IF NOT EXISTS repair_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  note        TEXT,
  user_id     INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------- employees
CREATE TABLE IF NOT EXISTS employees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  code        TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  department  TEXT,
  job_title   TEXT,
  branch_id   INTEGER REFERENCES branches(id),
  salary      REAL NOT NULL DEFAULT 0,
  hire_date   TEXT,
  phone       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL,
  vat_amount  REAL NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT 'cash',
  vendor      TEXT,
  note        TEXT,
  entry_date  TEXT NOT NULL DEFAULT (date('now')),
  user_id     INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------ AI
CREATE TABLE IF NOT EXISTS ai_insights (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind      TEXT NOT NULL,                  -- forecast|risk|opportunity|anomaly|summary
  severity  TEXT NOT NULL DEFAULT 'info',   -- info|warn|critical
  module    TEXT NOT NULL DEFAULT 'accounting',
  title_ar  TEXT NOT NULL,
  title_en  TEXT NOT NULL,
  body_ar   TEXT,
  body_en   TEXT,
  metric    REAL,
  data_json TEXT,
  is_read   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL,                 -- user|assistant
  content    TEXT NOT NULL,
  intent     TEXT,
  data_json  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -------------------------------------------------------------- audit
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  username   TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  before_json TEXT,
  after_json  TEXT,
  ip         TEXT,
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_audit_at ON audit_log(at DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
