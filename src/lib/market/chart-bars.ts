import type { Candle, SupportedSymbol } from "@/lib/rules/types";
import type { ChartBar, ChartInterval, ChartRange, MarketDataProviderName } from "./types";
import { isUsMarketHours } from "./status-helpers";

export const CHART_RANGES = ["1D", "5D", "1M"] as const satisfies readonly ChartRange[];
export const CHART_INTERVALS = ["1m", "5m", "15m", "1h"] as const satisfies readonly ChartInterval[];

export const alpacaTimeframeByInterval: Record<ChartInterval, string> = {
  "1m": "1Min",
  "5m": "5Min",
  "15m": "15Min",
  "1h": "1Hour",
};

export const intervalMinutesByInterval: Record<ChartInterval, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
};

const rangeLookbackMs: Record<ChartRange, number> = {
  "1D": 24 * 60 * 60_000,
  "5D": 7 * 24 * 60 * 60_000,
  "1M": 32 * 24 * 60 * 60_000,
};

export function getChartRangeStart(range: ChartRange, end = new Date()) {
  return new Date(end.getTime() - rangeLookbackMs[range]);
}

export function candleToChartBar(candle: Candle): ChartBar {
  return {
    time: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

export function chartBarToCandle(bar: ChartBar): Candle {
  return {
    timestamp: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
}

export function buildChartBarsWarning(input: {
  provider: MarketDataProviderName;
  symbol: SupportedSymbol;
  bars: ChartBar[];
  range: ChartRange;
  interval: ChartInterval;
  now?: Date;
  providerWarning?: string;
}) {
  const providerWarning =
    input.providerWarning ??
    (input.provider === "alpaca"
      ? "Alpaca Basic/IEX data is not consolidated SIP data and may differ from full-market charts."
      : undefined);
  const withProviderWarning = (warning: string) =>
    providerWarning ? `${warning} ${providerWarning}` : warning;

  if (input.bars.length === 0) {
    return withProviderWarning(
      `No ${input.interval} bars are available for ${input.symbol} in the requested ${input.range} range.`,
    );
  }

  const now = input.now ?? new Date();
  const latest = input.bars.at(-1);
  if (!latest) return undefined;

  const lagMinutes = Math.max(0, Math.round((now.getTime() - new Date(latest.time).getTime()) / 60_000));
  const marketOpen = isUsMarketHours(now.toISOString());
  const expectedLag = Math.max(20, intervalMinutesByInterval[input.interval] * 3);

  if (marketOpen && lagMinutes > expectedLag) {
    return withProviderWarning(`Latest ${input.symbol} bar is ${lagMinutes} minutes old during regular market hours.`);
  }
  if (!marketOpen && lagMinutes > expectedLag) {
    return withProviderWarning("Market is outside regular hours; intraday bars may be from the prior regular session close.");
  }
  return providerWarning;
}
