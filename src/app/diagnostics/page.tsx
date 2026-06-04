import { requireUser } from "@/lib/auth/require-user";
import {
  getWorkerStatus,
  listNotificationLogs,
} from "@/lib/db/repositories";
import { getProviderDiagnostics } from "@/lib/market/diagnostics";
import { getAppVersion } from "@/lib/version";
import { isRecentWorkerHeartbeat } from "@/lib/worker/status";
import { MaintenanceCleanupCard } from "./maintenance-cleanup-card";

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
  const worker = await getWorkerStatus();
  const version = getAppVersion();
  const workerHeartbeatFresh = isRecentWorkerHeartbeat(worker);
  const notificationLogs = await listNotificationLogs(user.id, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Local diagnostics</p>
          <h1>Provider health.</h1>
          <p className="subhead">
            Inspect active provider status, local worker state, recent provider errors, delivery outcomes, and manual maintenance before deployment pressure enters the room.
          </p>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="Diagnostics summary">
        <div className="card">
          <div className="stat-label">Provider</div>
          <div className="stat-value">{diagnostics.activeProvider}</div>
          <div className="small">
            Configured {diagnostics.configuredProvider}
            {diagnostics.feed ? ` · feed ${diagnostics.feed}` : ""}
          </div>
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
          <div className="small">
            {worker.runtime_mode} · {workerHeartbeatFresh ? "fresh heartbeat" : `heartbeat ${timeLabel(worker.heartbeat_at)}`}
          </div>
        </div>
      </section>

      {diagnostics.config.warnings.length > 0 && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <div className="card-header">
            <h2>Deployment guardrails</h2>
            <span className="pill pill-warning">{diagnostics.config.warnings.length} warning{diagnostics.config.warnings.length === 1 ? "" : "s"}</span>
          </div>
          <div className="results">
            {diagnostics.config.warnings.map((warning) => (
              <div className="result" key={warning}>
                <span className="small">Warning</span>
                <strong>{warning}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Worker runtime</h2>
          <span className={`pill ${worker.is_running ? "" : "pill-muted"}`}>
            {worker.is_running ? "running" : worker.status}
          </span>
        </div>
        <p className="small">
          Next.js API routes can still start and stop the in-process local worker. The standalone worker is a separate
          Node process for deployment-style testing and reports through the same database heartbeat.
        </p>
        <div className="results" style={{ marginTop: "0.8rem" }}>
          <div className="result"><span className="small">Runtime</span><strong>{worker.runtime_mode}</strong></div>
          <div className="result"><span className="small">Worker</span><strong>{worker.worker_name ?? "Never reported"}</strong></div>
          <div className="result"><span className="small">Worker ID</span><strong>{worker.worker_id ?? "n/a"}</strong></div>
          <div className="result"><span className="small">Heartbeat</span><strong>{timeLabel(worker.heartbeat_at)}</strong></div>
          <div className="result"><span className="small">Heartbeat fresh</span><strong>{workerHeartbeatFresh ? "Yes" : "No"}</strong></div>
          <div className="result"><span className="small">Last tick</span><strong>{timeLabel(worker.last_tick_at)}</strong></div>
          <div className="result"><span className="small">Mode</span><strong>{worker.mode}</strong></div>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Provider mode</h2>
          <span className={diagnostics.fallbackReason ? "pill pill-warning" : "pill"}>
            {diagnostics.fallbackReason ? "fallback" : "configured"}
          </span>
        </div>
        <p className="small">
          Active provider: {diagnostics.activeProvider}. Requested provider: {diagnostics.configuredProvider}.
        </p>
        <p className="notice" style={{ marginTop: "0.8rem" }}>
          {diagnostics.fallbackReason ?? diagnostics.providerNote}
        </p>
        {diagnostics.fallbackReason && (
          <p className="small" style={{ marginTop: "0.8rem" }}>{diagnostics.providerNote}</p>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Database and config</h2>
          <span className={diagnostics.database.configValid ? "pill" : "pill pill-warning"}>
            {diagnostics.database.configValid ? "valid" : "invalid"}
          </span>
        </div>
        <div className="results">
          <div className="result">
            <span className="small">Configured DB</span>
            <strong>{diagnostics.database.configuredProvider}</strong>
          </div>
          <div className="result">
            <span className="small">Active DB</span>
            <strong>{diagnostics.database.activeProvider}</strong>
          </div>
          <div className="result">
            <span className="small">Local SQLite</span>
            <strong>{diagnostics.database.usingLocalSqlite ? "Yes" : "No"}</strong>
          </div>
          <div className="result">
            <span className="small">Postgres config</span>
            <strong>{diagnostics.database.postgresConfigComplete ? "Complete" : "Incomplete"}</strong>
          </div>
          <div className="result">
            <span className="small">DATABASE_URL</span>
            <strong>{diagnostics.database.databaseUrlPresent ? "Present" : "Not set"}</strong>
          </div>
          <div className="result">
            <span className="small">Real Discord</span>
            <strong>{diagnostics.config.discordRealNotificationSafety === "real-enabled" ? "Enabled" : "Mocked"}</strong>
          </div>
          <div className="result">
            <span className="small">Notification cap</span>
            <strong>{diagnostics.config.globalDailyNotificationLimit ?? "Invalid"}</strong>
          </div>
          <div className="result">
            <span className="small">Version</span>
            <strong>{version.packageVersion}</strong>
          </div>
          <div className="result">
            <span className="small">Commit</span>
            <strong>{version.commitSha ? version.commitSha.slice(0, 12) : "n/a"}</strong>
          </div>
        </div>
        <p className="notice" style={{ marginTop: "0.8rem" }}>{diagnostics.database.note}</p>
        {diagnostics.database.configErrors.length > 0 && (
          <p className="small" style={{ marginTop: "0.8rem" }}>
            {diagnostics.database.configErrors.join(" ")}
          </p>
        )}
      </section>

      <section className="grid split-grid" style={{ marginTop: "1rem" }}>
        <div className="card">
          <div className="card-header">
            <h2>Per-symbol provider status</h2>
            <span className="small">{diagnostics.activeProvider}</span>
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
                  <td>
                    {item.lagMinutes === undefined ? item.message ?? "n/a" : `${item.lagMinutes}m`}
                    {item.recentError && (
                      <div className="small">
                        Recent {item.recentError.context}: {item.recentError.message}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="card">
          <div className="card-header"><h2>Worker counters</h2></div>
          <div className="results">
            <div className="result"><span className="small">Last evaluated candle</span><strong>{timeLabel(worker.last_candle_at)}</strong></div>
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

      <MaintenanceCleanupCard />
    </div>
  );
}
