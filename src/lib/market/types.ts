import type { Candle, SupportedSymbol } from "@/lib/rules/types";

export type MarketDataMode = "mock" | "live" | "offline";
export type MarketDataProviderName = "mock" | "alpaca";
export type ChartRange = "1D" | "5D" | "1M";
export type ChartInterval = "1m" | "5m" | "15m" | "1h";

export type ChartBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartBarsRequest = {
  range: ChartRange;
  interval: ChartInterval;
};

export type ChartBarsResult = {
  bars: ChartBar[];
  warning?: string;
};

export type MarketStatus = {
  mode: MarketDataMode;
  provider: MarketDataProviderName;
  feed?: string;
  lastUpdateAt: string;
  latestBarAt?: string;
  lagMinutes?: number;
  referenceSymbol?: SupportedSymbol;
  health: "ok" | "stale" | "degraded";
  warning?: string;
};

export interface MarketDataService {
  getHistoricalCandles(symbol: SupportedSymbol, count: number): Promise<Candle[]>;
  getChartBars(symbol: SupportedSymbol, request: ChartBarsRequest): Promise<ChartBarsResult>;
  getLatestCandle(symbol: SupportedSymbol): Promise<Candle>;
  getMarketStatus(): Promise<MarketStatus>;
}
