import { describe, expect, it } from "vitest";
import { isMarketHours } from "@/lib/market/indicators";
import {
  alreadyTriggeredCandle,
  groupActiveRules,
  isProviderCandleStale,
  loadClosedCandleStateWithRetry,
  nextProviderBackoffMs,
  outsideCooldown,
  selectClosedCandleState,
} from "./live-monitor";
import { calculateAvailablePerformance } from "./local-mock-worker";
import type { AlertRule, IndicatorState } from "@/lib/rules/types";

const rule = (symbol: AlertRule["symbol"], isActive = true): AlertRule => ({
  name: `${symbol} test`,
  symbol,
  timeframe: "1m",
  logic: "AND",
  conditions: [{ left: "price", operator: ">", right: "ema_20" }],
  cooldownMinutes: 30,
  smsEnabled: false,
  isActive,
  marketHoursOnly: true,
});

describe("worker grouping", () => {
  it("groups active rules by symbol and timeframe", () => {
    const groups = groupActiveRules([rule("SPY"), rule("SPY"), rule("QQQ")]);
    expect(Object.keys(groups)).toEqual(["SPY:1m", "QQQ:1m"]);
    expect(groups["SPY:1m"]).toHaveLength(2);
  });

  it("omits paused rules", () => {
    expect(groupActiveRules([rule("SPY", false)])).toEqual({});
  });

  it("calculates only available forward-return horizons", () => {
    const start = new Date("2026-06-02T14:00:00.000Z").getTime();
    const candles = Array.from({ length: 16 }, (_, index) => ({
      timestamp: new Date(start + (index + 1) * 60_000).toISOString(),
      open: 100,
      high: 100 + index,
      low: 99,
      close: 100 + index,
      volume: 100,
    }));
    expect(
      calculateAvailablePerformance(candles, {
        triggeredAt: new Date(start).toISOString(),
        triggerPrice: 100,
      }),
    ).toEqual({ "5": 4, "15": 14 });
  });

  it("does not invent replay outcomes when no future candles are available", () => {
    expect(
      calculateAvailablePerformance(
        [
          {
            timestamp: "2026-06-02T14:00:00.000Z",
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 100,
          },
        ],
        {
          triggeredAt: "2026-06-02T14:00:00.000Z",
          triggerPrice: 100,
        },
      ),
    ).toEqual({});
  });

  it("enforces cooldowns against the candle timestamp", () => {
    const state = { timestamp: "2026-06-02T14:35:00.000Z" } as IndicatorState;
    expect(outsideCooldown({ cooldownMinutes: 30, lastTriggeredAt: null }, state)).toBe(true);
    expect(
      outsideCooldown({ cooldownMinutes: 30, lastTriggeredAt: "2026-06-02T14:10:00.000Z" }, state),
    ).toBe(false);
    expect(
      outsideCooldown({ cooldownMinutes: 30, lastTriggeredAt: "2026-06-02T14:05:00.000Z" }, state),
    ).toBe(true);
  });

  it("detects duplicate triggers for the same rule candle", () => {
    const state = { timestamp: "2026-06-02T14:35:00.000Z" } as IndicatorState;
    expect(alreadyTriggeredCandle({ lastTriggeredAt: "2026-06-02T14:35:00.000Z" }, state)).toBe(true);
    expect(alreadyTriggeredCandle({ lastTriggeredAt: "2026-06-02T14:34:00.000Z" }, state)).toBe(false);
  });

  it("keeps market-hours filtering bounded to regular session minutes", () => {
    expect(isMarketHours("2026-06-02T13:29:00.000Z")).toBe(false);
    expect(isMarketHours("2026-06-02T13:30:00.000Z")).toBe(true);
    expect(isMarketHours("2026-06-02T20:00:00.000Z")).toBe(false);
  });

  it("selects the latest closed one-minute candle and ignores an open candle", () => {
    const states = [
      { timestamp: "2026-06-02T14:30:00.000Z" },
      { timestamp: "2026-06-02T14:31:00.000Z" },
      { timestamp: "2026-06-02T14:32:00.000Z" },
    ] as IndicatorState[];
    const closed = selectClosedCandleState(states, new Date("2026-06-02T14:32:30.000Z"));
    expect(closed?.current.timestamp).toBe("2026-06-02T14:31:00.000Z");
    expect(closed?.previous.timestamp).toBe("2026-06-02T14:30:00.000Z");
  });

  it("marks stale provider data during market hours", () => {
    expect(
      isProviderCandleStale(
        "2026-06-02T14:35:00.000Z",
        new Date("2026-06-02T14:40:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isProviderCandleStale(
        "2026-06-02T21:00:00.000Z",
        new Date("2026-06-02T22:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("backs provider retries off exponentially with a cap", () => {
    expect(nextProviderBackoffMs(1)).toBe(250);
    expect(nextProviderBackoffMs(2)).toBe(500);
    expect(nextProviderBackoffMs(20)).toBe(60_000);
  });

  it("retries empty provider windows before succeeding", async () => {
    let calls = 0;
    const state = await loadClosedCandleStateWithRetry(
      {
        async getHistoricalCandles() {
          calls += 1;
          if (calls === 1) return [];
          return [
            {
              timestamp: "2026-06-02T14:30:00.000Z",
              open: 100,
              high: 101,
              low: 99,
              close: 100,
              volume: 100,
            },
            {
              timestamp: "2026-06-02T14:31:00.000Z",
              open: 100,
              high: 101,
              low: 99,
              close: 101,
              volume: 100,
            },
          ];
        },
        async getLatestCandle() {
          throw new Error("unused");
        },
        async getChartBars() {
          throw new Error("unused");
        },
        async getMarketStatus() {
          throw new Error("unused");
        },
      },
      "SPY",
      new Date("2026-06-02T14:32:30.000Z"),
      async () => undefined,
    );
    expect(calls).toBe(2);
    expect(state.current.timestamp).toBe("2026-06-02T14:31:00.000Z");
  });
});
