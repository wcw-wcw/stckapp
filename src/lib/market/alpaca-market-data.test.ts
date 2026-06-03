import { afterEach, describe, expect, it, vi } from "vitest";
import { AlpacaMarketDataService } from "./alpaca-market-data";

function bar(index: number) {
  return {
    t: new Date(Date.UTC(2026, 5, 2, 14, index)).toISOString(),
    o: 100 + index,
    h: 101 + index,
    l: 99 + index,
    c: 100.5 + index,
    v: 1000 + index,
  };
}

describe("AlpacaMarketDataService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pages historical candle requests above Alpaca's 10000 bar limit", async () => {
    const requestedLimits: string[] = [];
    const fetchSpy = vi.fn(async (url: URL | string) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith("/stocks/bars/latest")) {
        return Response.json({ bars: { SPY: bar(30) } });
      }

      requestedLimits.push(parsed.searchParams.get("limit") ?? "");
      const pageToken = parsed.searchParams.get("page_token");
      return Response.json({
        bars: {
          SPY: pageToken ? [bar(10_001), bar(10_002)] : Array.from({ length: 10_000 }, (_, index) => bar(index)),
        },
        next_page_token: pageToken ? undefined : "next-page",
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const service = new AlpacaMarketDataService({ keyId: "key", secretKey: "secret" });
    const candles = await service.getHistoricalCandles("SPY", 10_002);

    expect(candles).toHaveLength(10_002);
    expect(requestedLimits).toEqual(["10000", "2"]);
  });
});
