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
    vi.useRealTimers();
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

  it("fetches normalized chart bars with the requested timeframe and feed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T20:00:00.000Z"));
    const requestedUrls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL | string) => {
        requestedUrls.push(new URL(String(url)));
        return Response.json({
          bars: {
            SPY: [bar(30), bar(45)],
          },
        });
      }),
    );

    const service = new AlpacaMarketDataService({ keyId: "key", secretKey: "secret", feed: "iex" });
    const result = await service.getChartBars("SPY", { range: "5D", interval: "15m" });

    expect(result.bars).toEqual([
      {
        time: "2026-06-02T14:30:00.000Z",
        open: 130,
        high: 131,
        low: 129,
        close: 130.5,
        volume: 1030,
      },
      {
        time: "2026-06-02T14:45:00.000Z",
        open: 145,
        high: 146,
        low: 144,
        close: 145.5,
        volume: 1045,
      },
    ]);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0].pathname).toBe("/v2/stocks/bars");
    expect(requestedUrls[0].searchParams.get("symbols")).toBe("SPY");
    expect(requestedUrls[0].searchParams.get("timeframe")).toBe("15Min");
    expect(requestedUrls[0].searchParams.get("feed")).toBe("iex");
    expect(requestedUrls[0].searchParams.get("start")).toBe("2026-05-28T20:00:00.000Z");
    expect(requestedUrls[0].searchParams.get("end")).toBe("2026-06-04T20:00:00.000Z");
    expect(result.warning).toContain("not consolidated SIP");
  });
});
