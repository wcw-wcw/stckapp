CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE sms_delivery_status AS ENUM (
  'not_sent',
  'queued',
  'sent',
  'failed',
  'skipped_cooldown',
  'skipped_unverified_phone',
  'skipped_no_verified_channel',
  'skipped_user_limit',
  'skipped_global_limit',
  'skipped_account_paused',
  'skipped_paused'
);
CREATE TYPE notification_channel_type AS ENUM ('sms', 'email', 'discord_webhook');
CREATE TYPE worker_mode AS ENUM ('mock', 'live', 'offline');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_token_idx ON sessions (token_hash);

CREATE TABLE user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_paused BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supported_symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'equity',
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO supported_symbols (symbol, name) VALUES
  ('SPY', 'SPDR S&P 500 ETF Trust'),
  ('QQQ', 'Invesco QQQ Trust'),
  ('IWM', 'iShares Russell 2000 ETF'),
  ('AAPL', 'Apple Inc.'),
  ('NVDA', 'NVIDIA Corporation'),
  ('TSLA', 'Tesla, Inc.'),
  ('AMD', 'Advanced Micro Devices, Inc.'),
  ('MSFT', 'Microsoft Corporation')
ON CONFLICT (symbol) DO NOTHING;

CREATE TABLE watchlist_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  timeframe TEXT NOT NULL DEFAULT '1m' CHECK (timeframe = '1m'),
  logic TEXT NOT NULL DEFAULT 'AND' CHECK (logic = 'AND'),
  conditions_json JSONB NOT NULL,
  time_filter_json JSONB,
  cooldown_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (cooldown_minutes BETWEEN 1 AND 1440),
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  market_hours_only BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_rules_active_symbol_idx
  ON alert_rules (symbol, timeframe)
  WHERE is_active = true;
CREATE INDEX alert_rules_user_idx ON alert_rules (user_id, created_at DESC);

CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  triggered_at TIMESTAMPTZ NOT NULL,
  trigger_price NUMERIC(14, 4) NOT NULL,
  indicator_snapshot_json JSONB NOT NULL,
  condition_summary TEXT NOT NULL,
  sms_status sms_delivery_status NOT NULL DEFAULT 'not_sent',
  sms_error TEXT,
  performance_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_events_user_triggered_idx
  ON alert_events (user_id, triggered_at DESC);
CREATE INDEX alert_events_rule_triggered_idx
  ON alert_events (rule_id, triggered_at DESC);
CREATE INDEX alert_events_rule_candle_idx
  ON alert_events (rule_id, triggered_at);

CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX phone_verifications_user_created_idx
  ON phone_verifications (user_id, created_at DESC);

CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_channel_type NOT NULL,
  destination TEXT NOT NULL,
  label TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_limit SMALLINT NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 0 AND 100),
  sent_today SMALLINT NOT NULL DEFAULT 0,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, destination)
);

CREATE INDEX notification_channels_user_idx
  ON notification_channels (user_id, type)
  WHERE is_enabled = true;

CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_event_id UUID REFERENCES alert_events(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  channel_type notification_channel_type NOT NULL,
  destination TEXT NOT NULL,
  status sms_delivery_status NOT NULL,
  message TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notification_logs_user_created_idx
  ON notification_logs (user_id, created_at DESC);

CREATE TABLE provider_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  symbol TEXT REFERENCES supported_symbols(symbol),
  context TEXT NOT NULL,
  status_code INTEGER,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provider_error_logs_created_idx
  ON provider_error_logs (created_at DESC);
CREATE INDEX provider_error_logs_symbol_created_idx
  ON provider_error_logs (symbol, created_at DESC);

CREATE TABLE backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  range_label TEXT NOT NULL,
  range_start TIMESTAMPTZ NOT NULL,
  range_end TIMESTAMPTZ NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id, range_label)
);

CREATE INDEX backtest_results_user_created_idx
  ON backtest_results (user_id, created_at DESC);

CREATE TABLE replay_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  source TEXT NOT NULL DEFAULT 'manual_json',
  candles_json JSONB NOT NULL,
  candle_count INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX replay_datasets_user_created_idx
  ON replay_datasets (user_id, created_at DESC);

CREATE TABLE market_worker_status (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  worker_id TEXT,
  worker_name TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  mode worker_mode NOT NULL DEFAULT 'mock',
  runtime_mode TEXT NOT NULL DEFAULT 'in-process' CHECK (runtime_mode IN ('in-process', 'standalone')),
  heartbeat_at TIMESTAMPTZ,
  last_update_at TIMESTAMPTZ,
  last_tick_at TIMESTAMPTZ,
  last_candle_at TIMESTAMPTZ,
  symbols_evaluated INTEGER NOT NULL DEFAULT 0,
  rules_evaluated INTEGER NOT NULL DEFAULT 0,
  triggers_created INTEGER NOT NULL DEFAULT 0,
  cooldown_skips INTEGER NOT NULL DEFAULT 0,
  provider_errors INTEGER NOT NULL DEFAULT 0,
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  is_running BOOLEAN NOT NULL DEFAULT false,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO market_worker_status (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE suggested_rule_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  rule_json JSONB NOT NULL,
  stats_json JSONB NOT NULL,
  score NUMERIC(10, 4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'historical_scan',
  sample_size INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX suggested_rule_candidates_rank_idx
  ON suggested_rule_candidates (symbol, score DESC);
