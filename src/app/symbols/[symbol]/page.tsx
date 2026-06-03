import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { marketData } from "@/lib/market/provider";
import { buildIndicatorStates } from "@/lib/market/indicators";
import { listRules, listWatchlist } from "@/lib/db/repositories";
import { previewRule } from "@/lib/rules/preview";
import { SUPPORTED_SYMBOLS, type Candle, type SupportedSymbol } from "@/lib/rules/types";
import { PriceChart } from "./price-chart";

const barTimeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

export default async function SymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const user = await requireUser();
  const symbol = (await params).symbol.toUpperCase() as SupportedSymbol;
  if (!SUPPORTED_SYMBOLS.includes(symbol)) notFound();
  const watchlist = await listWatchlist(user.id);
  if (!watchlist.includes(symbol)) notFound();

  let candles: Candle[];
  try {
    candles = await marketData.getHistoricalCandles(symbol, 120);
  } catch (error) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Monitored symbol</p>
            <h1>{symbol}</h1>
            <p className="subhead">The active market-data provider did not return a usable chart window.</p>
          </div>
        </div>
        <section className="card">
          <p className="notice">
            {error instanceof Error ? error.message : "Unknown market-data provider error."}
          </p>
        </section>
      </div>
    );
  }
  if (!candles.length) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Monitored symbol</p>
            <h1>{symbol}</h1>
            <p className="subhead">No chart candles are available from the active market-data provider yet.</p>
          </div>
        </div>
        <section className="card">
          <p className="empty-state">Try again after the provider returns one-minute bars, or switch back to mock mode for local UI testing.</p>
        </section>
      </div>
    );
  }
  const states = buildIndicatorStates(candles);
  const latest = candles.at(-1) as Candle;
  const earliest = candles.at(0) as Candle;
  const latestState = states.at(-1);
  const change = ((latest.close - earliest.open) / earliest.open) * 100;
  const rules = await listRules(user.id);
  const activeRules = rules.filter((rule) => rule.symbol === symbol);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Monitored symbol</p>
          <h1>{symbol}</h1>
          <p className="subhead">Chart-ready detail view with provider-backed 1-minute candles. Mock mode stays the default until live credentials are configured.</p>
        </div>
        <div className="symbol-quote">
          <strong>${latest.close.toFixed(2)}</strong>
          <span className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span>
        </div>
      </div>
      <section className="card chart-card">
        <div className="card-header">
          <h2>Price chart</h2>
          <span className="small">Latest bar: {barTimeLabel(latest.timestamp)}</span>
        </div>
        <PriceChart candles={candles} symbol={symbol} />
        {candles.some((candle) => candle.volume === 0) && (
          <p className="notice" style={{ marginTop: "1rem" }}>
            Alpaca returned a latest IEX bar but no historical bars for this window, so the chart is anchored to the latest real bar with a synthetic local lead-in.
          </p>
        )}
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><h2>Rules monitoring {symbol}</h2><span className="small">{activeRules.length} total</span></div>
        <div className="rules-list">
          {activeRules.length === 0 && <p className="empty-state">No rules monitor this symbol yet.</p>}
          {activeRules.map((rule) => (
            <div className="rule-line" key={rule.id}>
              <div><strong>{rule.name}</strong><p className="rule-copy">{previewRule(rule)}</p></div>
              <span className={`pill ${rule.isActive ? "" : "pill-muted"}`}>{rule.isActive ? "active" : "paused"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="grid stats-grid compact-stats">
        <div className="card"><div className="stat-label">VWAP</div><div className="stat-value">${latestState?.vwap.toFixed(2) ?? "n/a"}</div></div>
        <div className="card"><div className="stat-label">EMA 9</div><div className="stat-value">${latestState?.ema_9.toFixed(2) ?? "n/a"}</div></div>
        <div className="card"><div className="stat-label">EMA 20</div><div className="stat-value">${latestState?.ema_20.toFixed(2) ?? "n/a"}</div></div>
        <div className="card"><div className="stat-label">Volume</div><div className="stat-value">{latest.volume.toLocaleString()}</div></div>
      </section>
    </div>
  );
}
