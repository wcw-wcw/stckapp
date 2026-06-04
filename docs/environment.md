# SignalDesk Environment

SignalDesk defaults are local-first and safe:

```sh
DATABASE_PROVIDER=sqlite
MARKET_DATA_PROVIDER=mock
ENABLE_REAL_NOTIFICATIONS=false
GLOBAL_DAILY_NOTIFICATION_LIMIT=100
```

## Production Web App

Set these in Vercel or an equivalent web host:

```sh
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
MARKET_DATA_PROVIDER=alpaca
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
ALPACA_DATA_FEED=iex
ENABLE_REAL_NOTIFICATIONS=false
GLOBAL_DAILY_NOTIFICATION_LIMIT=100
```

`DATABASE_URL`, Alpaca credentials, and Discord webhook destinations belong in host environment variables or app settings, not Git.

SQLite is only for local development. It is not suitable for Vercel persistence because deployment filesystems are ephemeral.

## Worker Host

The always-on worker should use the same database and provider environment:

```sh
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
MARKET_DATA_PROVIDER=alpaca
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
ALPACA_DATA_FEED=iex
ENABLE_REAL_NOTIFICATIONS=false
GLOBAL_DAILY_NOTIFICATION_LIMIT=100
STANDALONE_WORKER_INTERVAL_MS=60000
```

Run the worker command on Railway, Render, Fly.io, or another always-on host:

```sh
npm run worker
```

Vercel Hobby cron is not appropriate for one-minute monitoring.

Hosted worker deployment can still be deferred during web-app testing. To exercise the deployed Vercel app against Neon first, run the standalone worker locally with the same Neon/Postgres environment:

```sh
npm run worker
```

## Market Charts

Symbol detail charts use normalized bars from:

```sh
GET /api/market/bars/:symbol?range=1D&interval=1m
```

Supported ranges are `1D`, `5D`, and `1M`. Supported intervals are `1m`, `5m`, `15m`, and `1h`. Supported symbols remain fixed to the app's allowlist; arbitrary ticker lookup is not enabled.

When `MARKET_DATA_PROVIDER=mock`, charts use generated local bars. When `MARKET_DATA_PROVIDER=alpaca`, charts request Alpaca historical bars with the configured `ALPACA_DATA_FEED` value. The default `iex` feed is Alpaca Basic/IEX data, not consolidated SIP data, so chart bars can differ from broker, Google, or full-market charts.

Intraday bars can look stale outside regular market hours because the latest provider bar may be from the prior session close. The chart API returns sanitized metadata and a warning when bars are empty, stale, degraded, or IEX/basic-limited.

Charts show hover/crosshair OHLCV details, a subtle volume histogram, latest-bar metadata, and provider/range/interval/bar-count metadata.

Saved symbol levels are persisted user-owned planning aids for supported symbols. They draw as chart price lines and can be selected as optional alert targets for the same user and symbol. Quick price alerts create normal saved rules, and the local or standalone worker evaluates custom-price and saved-level rules through the shared rule evaluator. Expired saved levels cannot be selected for new rules; existing rules with missing, deleted, expired, or symbol-mismatched levels skip that condition and show warnings in rule detail.

SignalDesk does not store raw historical chart candles in the database. Charts are fetched or generated on demand. SignalDesk also does not execute trades, does not create dynamic lookback levels yet, and has no brokerage execution integration.

## Notifications

SMS and email are mocked. Real Discord delivery remains disabled unless:

```sh
ENABLE_REAL_NOTIFICATIONS=true
```

When testing real Discord delivery, first lower `GLOBAL_DAILY_NOTIFICATION_LIMIT`, verify the destination in the app settings, and keep account-level notification pause available.

SignalDesk does not execute trades and has no brokerage execution integration.
