import type { Candle, SupportedSymbol } from "@/lib/rules/types";

export type MarketDataMode = "mock" | "live" | "offline";
export type MarketDataProviderName = "mock" | "alpaca";

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
  getLatestCandle(symbol: SupportedSymbol): Promise<Candle>;
  getMarketStatus(): Promise<MarketStatus>;
}
