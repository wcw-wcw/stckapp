import { describe, expect, it } from "vitest";
import { resolveMarketDataProviderMode } from "./provider";

describe("market data provider resolution", () => {
  it("falls back to mock when Alpaca is configured without credentials", () => {
    expect(resolveMarketDataProviderMode({ MARKET_DATA_PROVIDER: "alpaca" })).toMatchObject({
      configuredProvider: "alpaca",
      activeProvider: "mock",
      alpacaCredentialsPresent: false,
      fallbackReason: "MARKET_DATA_PROVIDER=alpaca is set, but Alpaca credentials are missing.",
    });
  });

  it("uses Alpaca when credentials are present", () => {
    expect(
      resolveMarketDataProviderMode({
        MARKET_DATA_PROVIDER: "alpaca",
        ALPACA_API_KEY_ID: "key",
        ALPACA_API_SECRET_KEY: "secret",
      }),
    ).toMatchObject({
      configuredProvider: "alpaca",
      activeProvider: "alpaca",
      alpacaCredentialsPresent: true,
      fallbackReason: null,
    });
  });
});
