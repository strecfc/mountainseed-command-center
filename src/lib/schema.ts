export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  password_hash TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx ON login_attempts (email, ip, attempted_at);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS targets (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value_numeric DOUBLE PRECISION,
  unit TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL,
  category TEXT NOT NULL,
  direction TEXT NOT NULL,
  cadence TEXT NOT NULL,
  source TEXT NOT NULL,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL REFERENCES metric_definitions(key) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL,
  value_raw TEXT,
  value_numeric DOUBLE PRECISION,
  total_qtd_raw TEXT,
  total_qtd_numeric DOUBLE PRECISION,
  avg_qtd_raw TEXT,
  avg_qtd_numeric DOUBLE PRECISION,
  qtd_goal_raw TEXT,
  qtd_goal_numeric DOUBLE PRECISION,
  qtd_goal_pct_raw TEXT,
  wk_goal_raw TEXT,
  wk_goal_numeric DOUBLE PRECISION,
  source TEXT NOT NULL,
  source_detail TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_key, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS observations_metric_idx ON observations (metric_key, period_start);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  filename TEXT,
  uploaded_by TEXT,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parser_mappings (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_financials (
  id TEXT PRIMARY KEY,
  period DATE NOT NULL UNIQUE,
  revenue_actual DOUBLE PRECISION,
  revenue_budget DOUBLE PRECISION,
  gross_profit_actual DOUBLE PRECISION,
  gross_profit_budget DOUBLE PRECISION,
  gross_margin_actual DOUBLE PRECISION,
  gross_margin_budget DOUBLE PRECISION,
  gross_margin_appraisal DOUBLE PRECISION,
  gross_margin_non_appraisal DOUBLE PRECISION,
  ebitda_actual DOUBLE PRECISION,
  ebitda_budget DOUBLE PRECISION,
  ebitda_margin_actual DOUBLE PRECISION,
  ebitda_margin_budget DOUBLE PRECISION,
  expenses_actual DOUBLE PRECISION,
  expenses_budget DOUBLE PRECISION,
  source TEXT NOT NULL,
  filename TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salesforce_snapshots (
  id TEXT PRIMARY KEY,
  pulled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  week_ending DATE NOT NULL UNIQUE,
  what_changed TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_by TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_files (
  id TEXT PRIMARY KEY,
  filename TEXT,
  uploaded_by TEXT,
  row_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_rows (
  id TEXT PRIMARY KEY,
  file_id TEXT REFERENCES order_files(id) ON DELETE CASCADE,
  client_name TEXT,
  order_date DATE,
  completed_date DATE,
  appraiser_type TEXT,
  fee DOUBLE PRECISION,
  cost DOUBLE PRECISION,
  turn_time_bd DOUBLE PRECISION,
  revised BOOLEAN,
  late BOOLEAN,
  product TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS augur_deals (
  id TEXT PRIMARY KEY,
  opportunity_name TEXT NOT NULL,
  amount DOUBLE PRECISION,
  age DOUBLE PRECISION,
  close_date TEXT,
  expected_monthly_appraisals DOUBLE PRECISION,
  weekly_goal DOUBLE PRECISION,
  actual_uploads DOUBLE PRECISION,
  diff DOUBLE PRECISION,
  source TEXT NOT NULL,
  as_of TEXT,
  workbook_meta TEXT
);

CREATE TABLE IF NOT EXISTS at_risk_accounts (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  tier TEXT,
  reason TEXT,
  annual_value DOUBLE PRECISION,
  as_of DATE,
  source TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
