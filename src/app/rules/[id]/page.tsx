import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  getRule,
  listRuleAlertEvents,
  upsertBacktestResult,
  type CachedBacktestResult,
} from "@/lib/db/repositories";
import { activeMarketDataProvider, marketData } from "@/lib/market/provider";
import { backtestRule } from "@/lib/rules/backtest";
import { previewRule } from "@/lib/rules/preview";
import type { AlertRule } from "@/lib/rules/types";

const ranges = [
  { label: "1D", candles: 450 },
  { label: "1W", candles: 1_950 },
  { label: "1M", candles: 7_800 },
  { label: "3M", candles: 23_400 },
  { label: "1Y", candles: 98_280 },
] as const;

type RangeBacktestFailure = {
  rangeLabel: (typeof ranges)[number]["label"];
  error: string;
};

const moveLabel = (move?: number) =>
  move === undefined ? "pending" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`;

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

async function runRangeBacktest(
  userId: string,
  ruleId: string,
  rule: AlertRule,
  range: (typeof ranges)[number],
) {
  const candles = await marketData.getHistoricalCandles(rule.symbol, range.candles);
  const result = backtestRule(rule, candles);
  return upsertBacktestResult({
    userId,
    ruleId,
    symbol: rule.symbol,
    rangeLabel: range.label,
    rangeStart: candles[0]?.timestamp ?? new Date().toISOString(),
    rangeEnd: candles.at(-1)?.timestamp ?? new Date().toISOString(),
    result,
  });
}

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const rule = await getRule(user.id, id);
  if (!rule) notFound();

  const rangeResults = await Promise.all(
    ranges.map(async (range) => {
      try {
        return await runRangeBacktest(user.id, id, rule, range);
      } catch (error) {
        return {
          rangeLabel: range.label,
          error: error instanceof Error ? error.message : "Unknown market-data provider error.",
        } satisfies RangeBacktestFailure;
      }
    }),
  );
  const summaries = rangeResults.filter(
    (result): result is CachedBacktestResult => Boolean(result && !("error" in result)),
  );
  const failures = rangeResults.filter(
    (result): result is RangeBacktestFailure => Boolean(result && "error" in result),
  );
  const primary = summaries.find((summary) => summary.rangeLabel === "1M") ?? summaries[0];
  const alerts = await listRuleAlertEvents(user.id, id, 20);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rule detail</p>
          <h1>{rule.name}</h1>
          <p className="subhead">{previewRule(rule)}</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/rules">Manage rules</Link>
          <Link className="button" href={`/symbols/${rule.symbol}`}>View {rule.symbol} chart</Link>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="Rule summary">
        <div className="card">
          <div className="stat-label">Symbol</div>
          <div className="stat-value">{rule.symbol}</div>
          <div className="small">{rule.timeframe} closed candles</div>
        </div>
        <div className="card">
          <div className="stat-label">Status</div>
          <div className="stat-value">{rule.isActive ? "Active" : "Paused"}</div>
          <div className="small">Cooldown: {rule.cooldownMinutes} minutes</div>
        </div>
        <div className="card">
          <div className="stat-label">Notifications</div>
          <div className="stat-value">{rule.smsEnabled ? "On" : "Off"}</div>
          <div className="small">{rule.marketHoursOnly ? "Market hours only" : "All sessions"}</div>
        </div>
        <div className="card">
          <div className="stat-label">Mock sample</div>
          <div className="stat-value">{primary?.result.triggerCount ?? 0}</div>
          <div className="small">{primary?.rangeLabel ?? "1M"} triggers</div>
        </div>
      </section>

      <section className="grid split-grid">
        <div className="card">
          <div className="card-header">
            <h2>Backtest ranges</h2>
            <span className="small">Cached locally</span>
          </div>
          {failures.length > 0 && (
            <p className="notice" style={{ marginBottom: "0.9rem" }}>
              {failures.length} range{failures.length === 1 ? "" : "s"} could not refresh from the active provider.
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Range</th>
                <th>Triggers</th>
                <th>Avg +15m</th>
                <th>Positive +15m</th>
                <th>Best +60m</th>
                <th>Worst +60m</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.rangeLabel}>
                  <td>{summary.rangeLabel}</td>
                  <td>{summary.result.triggerCount}</td>
                  <td className={summary.result.forward["15"].averageMove >= 0 ? "positive" : "negative"}>
                    {moveLabel(summary.result.forward["15"].averageMove)}
                  </td>
                  <td className="positive">{summary.result.forward["15"].percentPositive.toFixed(2)}%</td>
                  <td className={summary.result.bestResult >= 0 ? "positive" : "negative"}>{moveLabel(summary.result.bestResult)}</td>
                  <td className={summary.result.worstResult >= 0 ? "positive" : "negative"}>{moveLabel(summary.result.worstResult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {primary?.result.warning && <p className="notice" style={{ marginTop: "0.8rem" }}>{primary.result.warning}</p>}
        </div>

        <aside className="card">
          <div className="card-header"><h2>Evidence snapshot</h2></div>
          {primary ? (
            <div className="results">
              <div className="result"><span className="small">Average +5m</span><strong>{moveLabel(primary.result.forward["5"].averageMove)}</strong></div>
              <div className="result"><span className="small">Average +30m</span><strong>{moveLabel(primary.result.forward["30"].averageMove)}</strong></div>
              <div className="result"><span className="small">Avg favorable</span><strong className="positive">{moveLabel(primary.result.averageMaxFavorableMove)}</strong></div>
              <div className="result"><span className="small">Avg adverse</span><strong className="negative">{moveLabel(primary.result.averageMaxAdverseMove)}</strong></div>
              <div className="result"><span className="small">Best hour</span><strong>{primary.result.bestTimeOfDay ?? "n/a"}</strong></div>
              <div className="result"><span className="small">Worst hour</span><strong>{primary.result.worstTimeOfDay ?? "n/a"}</strong></div>
            </div>
          ) : (
            <p className="empty-state">No backtest summary available.</p>
          )}
          <div className="notice" style={{ marginTop: "1rem" }}>
            {activeMarketDataProvider === "alpaca"
              ? "These summaries use Alpaca IEX historical bars when available. IEX data can differ from consolidated market feeds."
              : "These are deterministic mock candles. This page is the evidence shape we will reuse once real historical data is connected."}
          </div>
        </aside>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header">
          <h2>Recent triggers</h2>
          <span className="small">{alerts.length} recorded</span>
        </div>
        <table>
          <thead>
            <tr><th>Time</th><th>Price</th><th>+5m</th><th>+15m</th><th>Notify</th></tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr><td className="empty-state" colSpan={5}>No triggers recorded for this rule yet. Run a local worker tick from the dashboard.</td></tr>
            )}
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{timeLabel(alert.triggeredAt)}</td>
                <td>${alert.triggerPrice.toFixed(2)}</td>
                <td className={alert.performance?.["5"] === undefined ? "" : alert.performance["5"] >= 0 ? "positive" : "negative"}>
                  {moveLabel(alert.performance?.["5"])}
                </td>
                <td className={alert.performance?.["15"] === undefined ? "" : alert.performance["15"] >= 0 ? "positive" : "negative"}>
                  {moveLabel(alert.performance?.["15"])}
                </td>
                <td>{alert.smsStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
