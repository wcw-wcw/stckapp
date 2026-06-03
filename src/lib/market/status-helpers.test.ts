import { describe, expect, it } from "vitest";
import { buildMarketStatus } from "./status-helpers";

describe("market status helpers", () => {
  it("marks missing latest bars as degraded", () => {
    const status = buildMarketStatus({
      mode: "live",
      provider: "alpaca",
      feed: "iex",
    });
    expect(status.health).toBe("degraded");
    expect(status.warning).toContain("No latest reference bar");
  });

  it("captures reference bar metadata when present", () => {
    const status = buildMarketStatus({
      mode: "mock",
      provider: "mock",
      latestCandle: {
        timestamp: new Date().toISOString(),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1000,
      },
      referenceSymbol: "SPY",
    });
    expect(status.referenceSymbol).toBe("SPY");
    expect(status.latestBarAt).toBeTruthy();
    expect(status.health).toBe("ok");
  });
});
