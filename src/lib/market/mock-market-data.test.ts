import { describe, expect, it, vi } from "vitest";
import { MockMarketDataService } from "./mock-market-data";

describe("MockMarketDataService", () => {
  it("generates normalized chart bars for the requested range and interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T20:00:00.000Z"));

    const service = new MockMarketDataService();
    const result = await service.getChartBars("SPY", { range: "1D", interval: "1h" });

    expect(result.bars).toHaveLength(24);
    expect(result.bars[0]).toEqual(
      expect.objectContaining({
        time: expect.any(String),
        open: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        close: expect.any(Number),
        volume: expect.any(Number),
      }),
    );
    expect(result.bars.at(-1)?.time).toBe("2026-06-04T20:00:00.000Z");

    vi.useRealTimers();
  });
});
