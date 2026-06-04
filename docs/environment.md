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

## Notifications

SMS and email are mocked. Real Discord delivery remains disabled unless:

```sh
ENABLE_REAL_NOTIFICATIONS=true
```

When testing real Discord delivery, first lower `GLOBAL_DAILY_NOTIFICATION_LIMIT`, verify the destination in the app settings, and keep account-level notification pause available.

SignalDesk does not execute trades and has no brokerage execution integration.
