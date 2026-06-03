import {
  countProviderErrorsSince,
  createProviderErrorLog,
  listProviderErrorLogs,
} from "@/lib/db/repositories";
import { getSafeConfigDiagnostics, type SafeConfigDiagnostics } from "@/lib/config/env";
import { getDatabaseProviderDiagnostics } from "@/lib/db/provider";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";
import { activeMarketDataProvider, marketData, marketDataProviderMode } from "./provider";
import { isUsMarketHours } from "./status-helpers";

export type SymbolProviderDiagnostic = {
  symbol: SupportedSymbol;
  health: "ok" | "stale" | "degraded";
  latestBarAt?: string;
  lagMinutes?: number;
  marketOpen: boolean;
  message?: string;
  recentError?: {
    context: string;
    message: string;
    createdAt: string;
  };
};

export type ProviderDiagnostics = {
  provider: string;
  configuredProvider: string;
  activeProvider: string;
  feed: string;
  fallbackReason: string | null;
  providerNote: string;
  checkedAt: string;
  marketOpen: boolean;
  symbols: SymbolProviderDiagnostic[];
  recentErrorCount: number;
  recentErrors: Awaited<ReturnType<typeof listProviderErrorLogs>>;
  config: SafeConfigDiagnostics;
  database: ReturnType<typeof getDatabaseProviderDiagnostics>;
};

const alpacaIexNote =
  "Alpaca Basic uses IEX data, not consolidated SIP data. Bars can differ from broker, Google, or full-market charts, and stale intraday bars are expected outside regular market hours.";

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
  const recentErrors = await listProviderErrorLogs(25);
  const symbols = await Promise.all(
    SUPPORTED_SYMBOLS.map(async (symbol) => {
      try {
        const candle = await marketData.getLatestCandle(symbol);
        const diagnostic = classifySymbol(symbol, candle.timestamp, now);
        const recentError = recentErrors.find((error) => error.symbol === symbol);
        return recentError
          ? {
              ...diagnostic,
              recentError: {
                context: recentError.context,
                message: recentError.message,
                createdAt: recentError.createdAt,
              },
            }
          : diagnostic;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider error.";
        await createProviderErrorLog({
          provider: activeMarketDataProvider,
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
    provider: marketDataProviderMode.activeProvider,
    configuredProvider: marketDataProviderMode.configuredProvider,
    activeProvider: marketDataProviderMode.activeProvider,
    feed: marketDataProviderMode.feed,
    fallbackReason: marketDataProviderMode.fallbackReason,
    providerNote:
      marketDataProviderMode.configuredProvider === "alpaca" ? alpacaIexNote : "Mock mode uses local synthetic candles for development.",
    checkedAt: now.toISOString(),
    marketOpen: isUsMarketHours(now.toISOString()),
    symbols,
    recentErrorCount: await countProviderErrorsSince(since),
    recentErrors,
    config: getSafeConfigDiagnostics(),
    database: getDatabaseProviderDiagnostics(),
  };
}
