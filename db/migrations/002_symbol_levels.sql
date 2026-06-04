CREATE TABLE IF NOT EXISTS symbol_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
  name TEXT NOT NULL,
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  level_type TEXT NOT NULL CHECK (level_type IN ('support', 'resistance', 'watch', 'other')),
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS symbol_levels_user_symbol_idx
  ON symbol_levels (user_id, symbol, created_at DESC);
