import { AlpacaMarketDataService } from "./alpaca-market-data";
import { MockMarketDataService } from "./mock-market-data";
import type { MarketDataProviderName, MarketDataService } from "./types";

function providerName() {
  const configured = process.env.MARKET_DATA_PROVIDER?.toLowerCase();
  return configured === "alpaca" ? "alpaca" : "mock";
}

function createMarketDataService(): MarketDataService {
  const provider = providerName();
  if (provider === "alpaca") {
    const keyId = process.env.ALPACA_API_KEY_ID;
    const secretKey = process.env.ALPACA_API_SECRET_KEY;
    if (keyId && secretKey) {
      return new AlpacaMarketDataService({
        keyId,
        secretKey,
        feed: process.env.ALPACA_DATA_FEED ?? "iex",
      });
    }
  }

  return new MockMarketDataService();
}

export const configuredMarketDataProvider = providerName() as MarketDataProviderName;
export const marketData = createMarketDataService();
