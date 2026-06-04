import Link from "next/link";
import { marketData } from "@/lib/market/provider";
import { requireUser } from "@/lib/auth/require-user";
import { countAlertsToday, getWorkerStatus, listAlertEvents, listRules, listWatchlist } from "@/lib/db/repositories";
import { previewRule } from "@/lib/rules/preview";
import { RunWorkerButton } from "./run-worker-button";

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

const dateTimeLabel = (timestamp?: string | null) =>
  timestamp
    ? new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
    : "Waiting";

export default async function Dashboard() {
  const user = await requireUser();
  const rules = await listRules(user.id);
  const watchlist = await listWatchlist(user.id);
  const alerts = await listAlertEvents(user.id, 5);
  const workerStatus = await getWorkerStatus();
  const marketStatus = await marketData.getMarketStatus();
  const quotes = await Promise.all(
    watchlist.map(async (symbol) => {
      try {
        const candle = await marketData.getLatestCandle(symbol);
        const change = ((candle.close - candle.open) / candle.open) * 100;
        return {
          symbol,
          quote: `$${candle.close.toFixed(2)}`,
          change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
          available: true as const,
        };
      } catch (error) {
        return {
          symbol,
          quote: "Unavailable",
          change: error instanceof Error ? error.message.slice(0, 80) : "Provider error",
          available: false as const,
        };
      }
    }),
  );
  const marketStatusNote =
    marketStatus.health === "ok"
      ? marketStatus.feed
        ? `${marketStatus.feed.toUpperCase()} feed`
        : "local generator"
      : marketStatus.warning ?? "Provider warning";
  const stats = [
    ["Active rules", String(rules.filter((rule) => rule.isActive).length), `${rules.length} saved locally`],
    ["Alerts today", String(await countAlertsToday(user.id)), `${alerts.length} recent events`],
    ["Notifications", "Mock", "SMS, email, Discord"],
    ["Market data", marketStatus.provider, marketStatusNote],
    [
      "Worker status",
      workerStatus.is_running ? "running" : workerStatus.status,
      workerStatus.last_tick_at
        ? `${workerStatus.runtime_mode} · last tick ${dateTimeLabel(workerStatus.last_tick_at)}`
        : `${workerStatus.runtime_mode} · waiting for first tick`,
    ],
  ];
  const workerDetails = [
    ["Last candle", dateTimeLabel(workerStatus.last_candle_at)],
    ["Symbols", String(workerStatus.symbols_evaluated)],
    ["Rules", String(workerStatus.rules_evaluated)],
    ["Triggers", String(workerStatus.triggers_created)],
    ["Cooldown skips", String(workerStatus.cooldown_skips)],
    ["Provider errors", String(workerStatus.provider_errors)],
    ["Notify attempts", String(workerStatus.notification_attempts)],
    ["Next retry", dateTimeLabel(workerStatus.next_retry_at)],
  ];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tuesday, June 2</p>
          <h1>Market signals,<br />without the noise.</h1>
          <p className="subhead">
            Watch a small set of liquid symbols, evaluate each rule once per
            closed candle, and keep the expensive work contained.
          </p>
        </div>
        <div className="header-actions">
          <RunWorkerButton />
          <Link className="button" href="/rules/new">Create rule</Link>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="Account summary">
        {stats.map(([label, value, note]) => (
          <div className="card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="small">{note}</div>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-header">
          <h2>Market monitor</h2>
          <span className={`pill ${workerStatus.is_running ? "" : "pill-muted"}`}>
            {workerStatus.is_running ? "running" : workerStatus.status}
          </span>
        </div>
        <p className="small" style={{ marginBottom: "0.9rem" }}>
          API controls run the Next.js in-process worker for local SQLite development. For deployment-style testing,
          run <code>npm run worker</code> in a separate terminal and watch this shared heartbeat.
        </p>
        <div className="symbols worker-status-grid">
          <div className="symbol-line">
            <span className="small">Runtime</span>
            <strong>{workerStatus.runtime_mode}</strong>
          </div>
          <div className="symbol-line">
            <span className="small">Worker</span>
            <strong>{workerStatus.worker_name ?? "Not reported"}</strong>
          </div>
          <div className="symbol-line">
            <span className="small">Heartbeat</span>
            <strong>{dateTimeLabel(workerStatus.heartbeat_at)}</strong>
          </div>
          {workerDetails.map(([label, value]) => (
            <div className="symbol-line" key={label}>
              <span className="small">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {workerStatus.last_error && <p className="notice" style={{ marginTop: "0.9rem" }}>{workerStatus.last_error}</p>}
      </section>

      <section className="grid split-grid">
        <div className="card">
          <div className="card-header">
            <h2>Latest alerts</h2>
            <Link className="text-button" href="/alerts">View history</Link>
          </div>
          <table>
            <thead>
              <tr><th>Time</th><th>Symbol</th><th>Rule</th><th>Price</th><th>Notify</th></tr>
            </thead>
            <tbody>
              {alerts.length === 0 && <tr><td colSpan={5} className="empty-state">No alert events yet. Run a local tick or replay a mock day to evaluate saved rules.</td></tr>}
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{timeLabel(alert.triggeredAt)}</td>
                  <td className="symbol">{alert.symbol}</td>
                  <td>{alert.ruleName}</td>
                  <td>${alert.triggerPrice.toFixed(2)}</td>
                  <td><span className="pill pill-muted">{alert.smsStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Watchlist</h2>
            <span className={`pill ${marketStatus.health === "ok" ? "" : "pill-warning"}`}>
              {marketStatus.health}
            </span>
          </div>
          {marketStatus.warning && <p className="notice" style={{ marginBottom: "0.9rem" }}>{marketStatus.warning}</p>}
          <div className="symbols">
            {quotes.map(({ symbol, quote, change, available }) => (
              <Link className="symbol-line symbol-link" href={`/symbols/${symbol}`} key={symbol}>
                <span className="symbol">{symbol}</span>
                <span>{quote}</span>
                <span className={!available ? "small" : change.startsWith("+") ? "positive" : "negative"}>{change}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Saved rules</h2>
          <Link className="text-button" href="/rules">Manage rules</Link>
        </div>
        <div className="rules-list">
          {rules.length === 0 && <p className="empty-state">No rules saved yet. Build your first signal.</p>}
          {rules.map((rule) => (
            <div className="rule-line" key={rule.id}>
              <div>
                <span className="symbol">{rule.symbol}</span>
                <strong style={{ marginLeft: "0.65rem", fontSize: "0.86rem" }}>{rule.name}</strong>
                <p className="rule-copy">{previewRule(rule)}</p>
              </div>
              <span className={`pill ${rule.isActive ? "" : "pill-muted"}`}>{rule.isActive ? "active" : "paused"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
