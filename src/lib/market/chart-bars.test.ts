import { describe, expect, it, vi } from "vitest";
import {
  alpacaTimeframeByInterval,
  buildChartBarsWarning,
  candleToChartBar,
  getChartRangeStart,
} from "./chart-bars";

describe("chart bar helpers", () => {
  it("maps supported chart intervals to Alpaca timeframes", () => {
    expect(alpacaTimeframeByInterval).toEqual({
      "1m": "1Min",
      "5m": "5Min",
      "15m": "15Min",
      "1h": "1Hour",
    });
  });

  it("computes range starts from the requested end time", () => {
    const end = new Date("2026-06-04T20:00:00.000Z");

    expect(getChartRangeStart("1D", end).toISOString()).toBe("2026-06-03T20:00:00.000Z");
    expect(getChartRangeStart("5D", end).toISOString()).toBe("2026-05-28T20:00:00.000Z");
    expect(getChartRangeStart("1M", end).toISOString()).toBe("2026-05-03T20:00:00.000Z");
  });

  it("normalizes candles to chart bars", () => {
    expect(
      candleToChartBar({
        timestamp: "2026-06-04T14:30:00.000Z",
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1234,
      }),
    ).toEqual({
      time: "2026-06-04T14:30:00.000Z",
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1234,
    });
  });

  it("warns for empty and stale provider results", () => {
    expect(
      buildChartBarsWarning({
        provider: "mock",
        symbol: "SPY",
        bars: [],
        range: "1D",
        interval: "1m",
        now: new Date("2026-06-04T15:00:00.000Z"),
      }),
    ).toContain("No 1m bars");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T15:00:00.000Z"));
    expect(
      buildChartBarsWarning({
        provider: "mock",
        symbol: "SPY",
        bars: [
          {
            time: "2026-06-04T14:00:00.000Z",
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 1,
          },
        ],
        range: "1D",
        interval: "1m",
        now: new Date("2026-06-04T15:00:00.000Z"),
      }),
    ).toContain("during regular market hours");
    vi.useRealTimers();
  });
});
