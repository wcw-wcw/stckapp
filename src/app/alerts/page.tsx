import { requireUser } from "@/lib/auth/require-user";
import { listAlertEvents } from "@/lib/db/repositories";

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

const moveLabel = (move?: number) =>
  move === undefined ? "pending" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`;

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await listAlertEvents(user.id);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Alert history</p>
          <h1>Closed-candle signals.</h1>
          <p className="subhead">Every trigger is recorded, including events that do not send a notification.</p>
        </div>
      </div>
      <section className="card">
        <table>
          <thead>
            <tr><th>Time</th><th>Symbol</th><th>Rule</th><th>Trigger</th><th>+5m</th><th>+15m</th><th>Notify</th></tr>
          </thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan={7} className="empty-state">No alerts recorded. Run a local worker tick from the dashboard.</td></tr>}
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{timeLabel(alert.triggeredAt)}</td>
                <td className="symbol">{alert.symbol}</td>
                <td>{alert.ruleName}</td>
                <td>${alert.triggerPrice.toFixed(2)}</td>
                <td className={alert.performance?.["5"] === undefined ? "" : alert.performance["5"] >= 0 ? "positive" : "negative"}>{moveLabel(alert.performance?.["5"])}</td>
                <td className={alert.performance?.["15"] === undefined ? "" : alert.performance["15"] >= 0 ? "positive" : "negative"}>{moveLabel(alert.performance?.["15"])}</td>
                <td>{alert.smsStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
