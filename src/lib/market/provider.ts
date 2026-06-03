import { AlpacaMarketDataService } from "./alpaca-market-data";
import { MockMarketDataService } from "./mock-market-data";
import { loadServerEnv, type RawServerEnv } from "@/lib/config/env";
import type { MarketDataProviderName, MarketDataService } from "./types";

export type MarketDataProviderMode = {
  configuredProvider: MarketDataProviderName;
  activeProvider: MarketDataProviderName;
  feed: string;
  alpacaCredentialsPresent: boolean;
  fallbackReason: string | null;
};

export function resolveMarketDataProviderMode(
  env: RawServerEnv = process.env,
): MarketDataProviderMode {
  const config = loadServerEnv(env);
  const configuredProvider = config.MARKET_DATA_PROVIDER as MarketDataProviderName;
  const alpacaCredentialsPresent = Boolean(config.ALPACA_API_KEY_ID && config.ALPACA_API_SECRET_KEY);
  const feed = config.ALPACA_DATA_FEED;

  if (configuredProvider === "alpaca" && !alpacaCredentialsPresent) {
    return {
      configuredProvider,
      activeProvider: "mock",
      feed,
      alpacaCredentialsPresent,
      fallbackReason: "MARKET_DATA_PROVIDER=alpaca is set, but Alpaca credentials are missing.",
    };
  }

  return {
    configuredProvider,
    activeProvider: configuredProvider,
    feed,
    alpacaCredentialsPresent,
    fallbackReason: null,
  };
}

function createMarketDataService(mode: MarketDataProviderMode): MarketDataService {
  if (mode.activeProvider === "alpaca") {
    const config = loadServerEnv();
    const keyId = config.ALPACA_API_KEY_ID;
    const secretKey = config.ALPACA_API_SECRET_KEY;
    if (keyId && secretKey) {
      return new AlpacaMarketDataService({
        keyId,
        secretKey,
        feed: mode.feed,
      });
    }
  }

  return new MockMarketDataService();
}

export const marketDataProviderMode = resolveMarketDataProviderMode();
export const configuredMarketDataProvider = marketDataProviderMode.configuredProvider;
export const activeMarketDataProvider = marketDataProviderMode.activeProvider;
export const marketData = createMarketDataService(marketDataProviderMode);
