import {
  countProviderErrorsSince,
  createProviderErrorLog,
  listProviderErrorLogs,
} from "@/lib/db/repositories";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";
import { marketData, configuredMarketDataProvider } from "./provider";
import { isUsMarketHours } from "./status-helpers";

export type SymbolProviderDiagnostic = {
  symbol: SupportedSymbol;
  health: "ok" | "stale" | "degraded";
  latestBarAt?: string;
  lagMinutes?: number;
  marketOpen: boolean;
  message?: string;
};

export type ProviderDiagnostics = {
  provider: string;
  checkedAt: string;
  marketOpen: boolean;
  symbols: SymbolProviderDiagnostic[];
  recentErrorCount: number;
  recentErrors: ReturnType<typeof listProviderErrorLogs>;
};

function classifySymbol(symbol: SupportedSymbol, timestamp: string, now: Date): SymbolProviderDiagnostic {
  const marketOpen = isUsMarketHours(now.toISOString());
  const lagMinutes = Math.max(0, Math.round((now.getTime() - new Date(timestamp).getTime()) / 60_000));
  if (marketOpen && lagMinutes > 20) {
    return {
      symbol,
      health: "stale",
      latestBarAt: timestamp,
      lagMinutes,
      marketOpen,
      message: `Latest bar is ${lagMinutes} minutes old during regular market hours.`,
    };
  }
  return {
    symbol,
    health: "ok",
    latestBarAt: timestamp,
    lagMinutes,
    marketOpen,
    message: marketOpen ? undefined : "Market is outside regular hours; stale intraday bars can be expected.",
  };
}

export async function getProviderDiagnostics(): Promise<ProviderDiagnostics> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const symbols = await Promise.all(
    SUPPORTED_SYMBOLS.map(async (symbol) => {
      try {
        const candle = await marketData.getLatestCandle(symbol);
        return classifySymbol(symbol, candle.timestamp, now);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider error.";
        createProviderErrorLog({
          provider: configuredMarketDataProvider,
          symbol,
          context: "provider-diagnostics",
          message,
        });
        return {
          symbol,
          health: "degraded" as const,
          marketOpen: isUsMarketHours(now.toISOString()),
          message,
        };
      }
    }),
  );

  return {
    provider: configuredMarketDataProvider,
    checkedAt: now.toISOString(),
    marketOpen: isUsMarketHours(now.toISOString()),
    symbols,
    recentErrorCount: countProviderErrorsSince(since),
    recentErrors: listProviderErrorLogs(25),
  };
}
