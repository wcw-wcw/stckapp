import { afterEach, describe, expect, it, vi } from "vitest";

const getChartBars = vi.fn();

vi.mock("@/lib/market/provider", () => ({
  activeMarketDataProvider: "mock",
  marketDataProviderMode: {
    configuredProvider: "mock",
    activeProvider: "mock",
    feed: "iex",
    fallbackReason: null,
  },
  marketData: {
    getChartBars,
  },
}));

describe("market bars route", () => {
  afterEach(() => {
    getChartBars.mockReset();
  });

  it("rejects unsupported symbols", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/market/bars/BAD"), {
      params: Promise.resolve({ symbol: "BAD" }),
    });

    expect(response.status).toBe(404);
    expect(getChartBars).not.toHaveBeenCalled();
  });

  it("rejects unsupported ranges and intervals", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/market/bars/SPY?range=2D&interval=2m"), {
      params: Promise.resolve({ symbol: "SPY" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unsupported chart range or interval.",
      supportedRanges: ["1D", "5D", "1M"],
      supportedIntervals: ["1m", "5m", "15m", "1h"],
    });
    expect(getChartBars).not.toHaveBeenCalled();
  });

  it("returns normalized mock bars with sanitized metadata", async () => {
    getChartBars.mockResolvedValueOnce({
      bars: [
        {
          time: "2026-06-04T14:30:00.000Z",
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 1000,
        },
      ],
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/market/bars/SPY?range=5D&interval=15m"), {
      params: Promise.resolve({ symbol: "spy" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getChartBars).toHaveBeenCalledWith("SPY", { range: "5D", interval: "15m" });
    expect(body).toMatchObject({
      bars: [
        {
          time: "2026-06-04T14:30:00.000Z",
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 1000,
        },
      ],
      meta: {
        provider: "mock",
        activeProvider: "mock",
        requestedRange: "5D",
        requestedInterval: "15m",
        firstBarTime: "2026-06-04T14:30:00.000Z",
        lastBarTime: "2026-06-04T14:30:00.000Z",
        barCount: 1,
      },
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("APCA");
  });
});
