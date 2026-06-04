CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_paused INTEGER NOT NULL DEFAULT 0 CHECK (notifications_paused IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supported_symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'equity',
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO supported_symbols (symbol, name) VALUES
  ('SPY', 'SPDR S&P 500 ETF Trust'),
  ('QQQ', 'Invesco QQQ Trust'),
  ('IWM', 'iShares Russell 2000 ETF'),
  ('AAPL', 'Apple Inc.'),
  ('NVDA', 'NVIDIA Corporation'),
  ('TSLA', 'Tesla, Inc.'),
  ('AMD', 'Advanced Micro Devices, Inc.'),
  ('MSFT', 'Microsoft Corporation');

CREATE TABLE IF NOT EXISTS watchlist_symbols (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  timeframe TEXT NOT NULL DEFAULT '1m' CHECK (timeframe = '1m'),
  logic TEXT NOT NULL DEFAULT 'AND' CHECK (logic = 'AND'),
  conditions_json TEXT NOT NULL,
  time_filter_json TEXT,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  sms_enabled INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  market_hours_only INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_rules_active_symbol_idx
  ON alert_rules (symbol, timeframe, is_active);
CREATE INDEX IF NOT EXISTS alert_rules_user_idx
  ON alert_rules (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  triggered_at TEXT NOT NULL,
  trigger_price REAL NOT NULL,
  indicator_snapshot_json TEXT NOT NULL,
  condition_summary TEXT NOT NULL,
  sms_status TEXT NOT NULL DEFAULT 'not_sent',
  sms_error TEXT,
  performance_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_events_user_triggered_idx
  ON alert_events (user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS alert_events_rule_triggered_idx
  ON alert_events (rule_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS alert_events_rule_candle_idx
  ON alert_events (rule_id, triggered_at);

CREATE TABLE IF NOT EXISTS phone_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS phone_verifications_user_created_idx
  ON phone_verifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sms', 'email', 'discord_webhook')),
  destination TEXT NOT NULL,
  label TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 0 AND 100),
  sent_today INTEGER NOT NULL DEFAULT 0,
  count_date TEXT NOT NULL DEFAULT CURRENT_DATE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, type, destination)
);

CREATE INDEX IF NOT EXISTS notification_channels_user_idx
  ON notification_channels (user_id, type, is_enabled);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_event_id TEXT REFERENCES alert_events(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES notification_channels(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notification_logs_user_created_idx
  ON notification_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_error_logs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  symbol TEXT,
  context TEXT NOT NULL,
  status_code INTEGER,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS provider_error_logs_created_idx
  ON provider_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS provider_error_logs_symbol_created_idx
  ON provider_error_logs (symbol, created_at DESC);

CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES alert_rules(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  range_label TEXT NOT NULL,
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, rule_id, range_label)
);

CREATE INDEX IF NOT EXISTS backtest_results_user_created_idx
  ON backtest_results (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS replay_datasets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  source TEXT NOT NULL DEFAULT 'manual_json',
  candles_json TEXT NOT NULL,
  candle_count INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS replay_datasets_user_created_idx
  ON replay_datasets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_worker_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  worker_id TEXT,
  worker_name TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  mode TEXT NOT NULL DEFAULT 'mock',
  runtime_mode TEXT NOT NULL DEFAULT 'in-process',
  heartbeat_at TEXT,
  last_update_at TEXT,
  last_tick_at TEXT,
  last_candle_at TEXT,
  symbols_evaluated INTEGER NOT NULL DEFAULT 0,
  rules_evaluated INTEGER NOT NULL DEFAULT 0,
  triggers_created INTEGER NOT NULL DEFAULT 0,
  cooldown_skips INTEGER NOT NULL DEFAULT 0,
  provider_errors INTEGER NOT NULL DEFAULT 0,
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  is_running INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO market_worker_status (id, updated_at)
  VALUES (1, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS suggested_rule_candidates (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  rule_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  score REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'historical_scan',
  sample_size INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS suggested_rule_candidates_rank_idx
  ON suggested_rule_candidates (symbol, score DESC);
