# SignalDesk Deployment Checklist

## Before Deploying

- Create a Neon Postgres database.
- Set `DATABASE_PROVIDER=postgres` and `DATABASE_URL` locally for migration testing.
- Run `npm run db:status -- --test-connection`.
- Run the guarded migration:

```sh
DATABASE_PROVIDER=postgres DATABASE_URL=postgresql://... npm run db:migrate:postgres -- --dry-run
DATABASE_PROVIDER=postgres DATABASE_URL=postgresql://... npm run db:migrate:postgres
```

- Run `npm run db:schema:check`.
- Run `npm run smoke:local`.

## Web App

- Deploy the Next.js app to Vercel or equivalent.
- Configure host environment variables from `docs/environment.md`.
- Keep `ENABLE_REAL_NOTIFICATIONS=false` for the first deploy.
- Verify `GET /api/health` from the deployed base URL:

```sh
SIGNALDESK_BASE_URL=https://your-app.example npm run health:check
```

- Sign in and verify `/diagnostics`.

## Worker

- Deploy the same repo to an always-on worker host.
- Configure the same Postgres, market data, and notification env vars.
- Set the worker start command:

```sh
npm run worker
```

- Verify the worker heartbeat with `npm run worker:status` on the worker host or `/diagnostics` in the app.
- Confirm the worker reports `runtimeMode=standalone`.

## Notifications

- Run a mock notification test first.
- Optionally enable real Discord delivery with a low `GLOBAL_DAILY_NOTIFICATION_LIMIT`.
- Keep SMS and email mocked.
- Confirm account notification pause still suppresses worker delivery.

## Monitoring

- Watch `/diagnostics` for DB provider status, active market provider, worker heartbeat freshness, provider errors, notification logs, and guardrail warnings.
- Alpaca Basic/IEX data can differ from SIP or broker charts and may look stale outside regular market hours.

## Rollback

- Disable the worker process first to stop new alert evaluation.
- Set `ENABLE_REAL_NOTIFICATIONS=false` if real Discord testing was enabled.
- Roll the web app back to the previous deployment.
- Keep Neon data intact unless you intentionally created disposable test data.
- Re-enable the previous known-good worker only after `/api/health` and `/diagnostics` look sane.
