# SignalDesk Deployment Prep

SignalDesk remains local-first. SQLite is the default persistence layer for local development, and mock market data plus mock notifications are still the safe defaults.

## Local Defaults

Use the normal local flow:

```sh
cp .env.example .env.local
npm install
npm test
npm run dev
```

With `DATABASE_PROVIDER=sqlite`, SignalDesk stores local data in `data/signaldesk.sqlite`. That file is useful for local development, but it is not suitable for Vercel persistence because deployment filesystems are ephemeral.

The dashboard worker controls still use the Next.js in-process worker. That is the simplest local SQLite path and keeps `POST /api/worker/start`, `POST /api/worker/stop`, `POST /api/worker/tick`, `GET /api/worker/status`, and replay routes available.

## Standalone Worker

For deployment-style local testing, run the app and worker as separate processes:

```sh
npm run dev
npm run worker
```

The standalone worker loads the same validated server environment, uses the selected repository adapter, uses the active market data provider, evaluates closed one-minute candles, and writes alert events plus notification logs through the shared repository layer. It reports a DB-backed heartbeat in `market_worker_status`, which the dashboard, `/diagnostics`, and this command can read:

```sh
npm run worker:status
```

For a single safe mock tick:

```sh
npm run worker:once
```

Local SQLite can be used by the Next.js app and standalone worker together for development, but it is still a local file database. Keep expectations modest if both processes are writing at the same time. For production, use Postgres/Neon as the shared database and run the worker on a small always-on host.

Vercel Hobby cron is not appropriate for one-minute monitoring. The production shape should be a Next.js app on Vercel or similar, a shared Postgres/Neon database, and a separate always-on worker process.

Hosted worker setup can remain deferred while validating the deployed web app. For that stage, point your local environment at the same Neon/Postgres database as Vercel and run:

```sh
npm run worker
```

## Postgres / Neon Configuration

Postgres deployment prep is gated by:

```sh
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
```

`DATABASE_URL` must be stored in the deployment provider's secret manager, not in Git. The app validates that Postgres has a URL, reports only whether it is present, and avoids printing the raw connection string.

When `DATABASE_PROVIDER=postgres` is configured, runtime repositories use the async Postgres pool adapter. When it is omitted or set to `sqlite`, the app keeps using the local SQLite database.

Apply the initial Postgres schema only after the Neon/Postgres database is created and the environment is intentionally configured:

```sh
DATABASE_PROVIDER=postgres DATABASE_URL=postgresql://... npm run db:migrate:postgres -- --dry-run
DATABASE_PROVIDER=postgres DATABASE_URL=postgresql://... npm run db:migrate:postgres
```

The migration command refuses to run unless `DATABASE_PROVIDER=postgres` and `DATABASE_URL` are present. It applies `db/migrations/001_initial.sql` and does not print the connection string.

Local SQLite data does not automatically transfer to Neon. `data/signaldesk.sqlite` is a separate local file, so production starts with the Postgres schema and whatever data you explicitly seed or import later.

## Notifications

Real Discord webhook delivery remains behind:

```sh
ENABLE_REAL_NOTIFICATIONS=true
```

Leave it `false` for local development unless you are intentionally testing a real Discord webhook. SMS and email delivery remain mocked.

## Market Data And Charts

Mock market data remains the default. Symbol detail pages fetch chart bars from `GET /api/market/bars/:symbol` with `range=1D|5D|1M` and `interval=1m|5m|15m|1h`. The endpoint validates symbols against the fixed supported-symbol list and returns normalized `time`, `open`, `high`, `low`, `close`, and `volume` bars plus sanitized provider metadata.

With `MARKET_DATA_PROVIDER=alpaca`, the chart endpoint requests Alpaca historical bars for the selected range and interval. With the default `ALPACA_DATA_FEED=iex`, Alpaca Basic/IEX data is not consolidated SIP data, so bars can differ from broker or full-market charts. Outside regular market hours, the latest intraday bar may be from the prior session close; the response metadata includes stale or degraded warnings instead of hiding that state.

The chart includes hover/crosshair OHLCV details, a subtle volume histogram, latest-bar/provider/range/interval metadata, and sanitized stale/IEX caveats when applicable.

Saved symbol levels are stored in SQLite or Postgres as user-owned planning aids. They can be created, edited, deleted, and drawn as horizontal price lines on supported-symbol charts. Saved levels are not trading advice, are not quick alerts, are not connected to the rule evaluator or worker yet, and do not execute trades.

Raw historical chart candles are not stored in SQLite or Postgres in this pass. The app still has no trade execution, arbitrary ticker support, quick alerts, or saved-level rule integration.

## Safe Checks

These commands print sanitized state only:

```sh
npm run config:check
npm run db:status
npm run db:status -- --test-connection
npm run db:schema:check
npm run smoke:local
npm run health:check -- https://your-app.example
```

`npm run db:status` reports provider/config state without opening a Postgres connection. Add `-- --test-connection` only when you intentionally want to test the configured database. These commands do not print API keys, Discord webhook URLs, or database connection strings.

Production secrets belong in Vercel or the worker host's environment variables. Do not commit `.env.local`, SQLite database files, API keys, or Discord webhook URLs.

SignalDesk does not execute trades. Real Discord delivery remains guarded by `ENABLE_REAL_NOTIFICATIONS=true`; SMS and email remain mocked.

See also:

- `docs/environment.md` for host environment variables.
- `docs/deployment-checklist.md` for a step-by-step Vercel + Neon + worker-host rollout.
