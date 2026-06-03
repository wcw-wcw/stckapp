import { requireUser } from "@/lib/auth/require-user";
import {
  getWorkerStatus,
  listNotificationLogs,
} from "@/lib/db/repositories";
import { getProviderDiagnostics } from "@/lib/market/diagnostics";

const timeLabel = (timestamp?: string | null) =>
  timestamp
    ? new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
    : "n/a";

export default async function DiagnosticsPage() {
  const user = await requireUser();
  const diagnostics = await getProviderDiagnostics();
  const worker = getWorkerStatus();
  const notificationLogs = listNotificationLogs(user.id, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Local diagnostics</p>
          <h1>Provider health.</h1>
          <p className="subhead">
            Inspect Alpaca/mock provider status, local worker state, recent provider errors, and delivery outcomes before deployment pressure enters the room.
          </p>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="Diagnostics summary">
        <div className="card">
          <div className="stat-label">Provider</div>
          <div className="stat-value">{diagnostics.provider}</div>
          <div className="small">{diagnostics.marketOpen ? "Market hours" : "Outside regular hours"}</div>
        </div>
        <div className="card">
          <div className="stat-label">Symbols checked</div>
          <div className="stat-value">{diagnostics.symbols.length}</div>
          <div className="small">Last checked {timeLabel(diagnostics.checkedAt)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Provider errors</div>
          <div className="stat-value">{diagnostics.recentErrorCount}</div>
          <div className="small">Past 24 hours</div>
        </div>
        <div className="card">
          <div className="stat-label">Worker</div>
          <div className="stat-value">{worker.is_running ? "Running" : worker.status}</div>
          <div className="small">Last tick {timeLabel(worker.last_tick_at)}</div>
        </div>
      </section>

      <section className="grid split-grid" style={{ marginTop: "1rem" }}>
        <div className="card">
          <div className="card-header">
            <h2>Per-symbol provider status</h2>
            <span className="small">{diagnostics.provider}</span>
          </div>
          <table>
            <thead>
              <tr><th>Symbol</th><th>Health</th><th>Latest bar</th><th>Lag</th></tr>
            </thead>
            <tbody>
              {diagnostics.symbols.map((item) => (
                <tr key={item.symbol}>
                  <td className="symbol">{item.symbol}</td>
                  <td><span className={`pill ${item.health === "ok" ? "" : "pill-warning"}`}>{item.health}</span></td>
                  <td>{timeLabel(item.latestBarAt)}</td>
                  <td>{item.lagMinutes === undefined ? item.message ?? "n/a" : `${item.lagMinutes}m`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card">
          <div className="card-header"><h2>Worker counters</h2></div>
          <div className="results">
            <div className="result"><span className="small">Last candle</span><strong>{timeLabel(worker.last_candle_at)}</strong></div>
            <div className="result"><span className="small">Symbols</span><strong>{worker.symbols_evaluated}</strong></div>
            <div className="result"><span className="small">Rules</span><strong>{worker.rules_evaluated}</strong></div>
            <div className="result"><span className="small">Triggers</span><strong>{worker.triggers_created}</strong></div>
            <div className="result"><span className="small">Provider errors</span><strong>{worker.provider_errors}</strong></div>
            <div className="result"><span className="small">Next retry</span><strong>{timeLabel(worker.next_retry_at)}</strong></div>
          </div>
          {worker.last_error && <p className="notice" style={{ marginTop: "1rem" }}>{worker.last_error}</p>}
        </aside>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Recent provider errors</h2>
          <span className="small">Most recent 25</span>
        </div>
        <table>
          <thead>
            <tr><th>Time</th><th>Provider</th><th>Symbol</th><th>Context</th><th>Error</th></tr>
          </thead>
          <tbody>
            {diagnostics.recentErrors.length === 0 && (
              <tr><td className="empty-state" colSpan={5}>No provider errors recorded.</td></tr>
            )}
            {diagnostics.recentErrors.map((error) => (
              <tr key={error.id}>
                <td>{timeLabel(error.createdAt)}</td>
                <td>{error.provider}</td>
                <td>{error.symbol ?? "n/a"}</td>
                <td>{error.context}{error.statusCode ? ` ${error.statusCode}` : ""}</td>
                <td>{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Recent notification outcomes</h2>
          <span className="small">Most recent 10</span>
        </div>
        <table>
          <thead>
            <tr><th>Time</th><th>Channel</th><th>Provider</th><th>Status</th><th>Error</th></tr>
          </thead>
          <tbody>
            {notificationLogs.length === 0 && (
              <tr><td className="empty-state" colSpan={5}>No notification attempts recorded.</td></tr>
            )}
            {notificationLogs.map((log) => (
              <tr key={log.id}>
                <td>{timeLabel(log.createdAt)}</td>
                <td>{log.channelType}</td>
                <td>{log.provider}</td>
                <td>{log.status}</td>
                <td>{log.error ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
