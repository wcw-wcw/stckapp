import type { Candle, SupportedSymbol } from "@/lib/rules/types";
import { candleToChartBar, getChartRangeStart, intervalMinutesByInterval } from "./chart-bars";
import { buildMarketStatus } from "./status-helpers";
import type { ChartBarsRequest, MarketDataService } from "./types";

const BASE_PRICES: Record<SupportedSymbol, number> = {
  SPY: 532,
  QQQ: 461,
  IWM: 205,
  AAPL: 208,
  NVDA: 119,
  TSLA: 341,
  AMD: 111,
  MSFT: 468,
};

function hash(input: string) {
  return [...input].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export class MockMarketDataService implements MarketDataService {
  private generateCandles(symbol: SupportedSymbol, count: number, intervalMinutes: number, end = new Date()) {
    const seededRandom = random(hash(symbol));
    const now = end.getTime();
    let previousClose = BASE_PRICES[symbol];

    return Array.from({ length: count }, (_, index) => {
      const timestamp = new Date(now - (count - index - 1) * intervalMinutes * 60_000).toISOString();
      const wave = Math.sin(index / 17) * 0.0008;
      const change = (seededRandom() - 0.49) * 0.0035 + wave;
      const open = previousClose;
      const close = open * (1 + change);
      const spread = open * (0.0004 + seededRandom() * 0.0014);
      const volume = Math.round(75_000 + seededRandom() * 230_000 + Math.abs(change) * 24_000_000);
      previousClose = close;

      return {
        timestamp,
        open,
        close,
        high: Math.max(open, close) + spread,
        low: Math.min(open, close) - spread,
        volume,
      };
    });
  }

  async getHistoricalCandles(symbol: SupportedSymbol, count: number) {
    return this.generateCandles(symbol, count, 1);
  }

  async getChartBars(symbol: SupportedSymbol, request: ChartBarsRequest) {
    const end = new Date();
    const start = getChartRangeStart(request.range, end);
    const intervalMinutes = intervalMinutesByInterval[request.interval];
    const count = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (intervalMinutes * 60_000)));

    return {
      bars: this.generateCandles(symbol, count, intervalMinutes, end).map(candleToChartBar),
    };
  }

  async getLatestCandle(symbol: SupportedSymbol) {
    return (await this.getHistoricalCandles(symbol, 1))[0];
  }

  async getMarketStatus() {
    return buildMarketStatus({
      mode: "mock" as const,
      provider: "mock" as const,
      latestCandle: await this.getLatestCandle("SPY"),
      referenceSymbol: "SPY",
    });
  }
}
