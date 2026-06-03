import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateRule } from "./evaluate";
import { previewRule } from "./preview";
import { validateAlertRule } from "./schema";
import type { AlertRule, IndicatorState } from "./types";

const state = (price: number, vwap: number): IndicatorState => ({
  timestamp: new Date().toISOString(),
  price,
  volume: 200,
  vwap,
  ema_9: 100,
  ema_20: 99,
  previous_day_high: 103,
  previous_day_low: 96,
  opening_range_high: 102,
  opening_range_low: 97,
  premarket_high: 101,
  premarket_low: 98,
  high_of_day: 103,
  low_of_day: 96,
  average_volume: 100,
});

const baseRule: AlertRule = {
  name: "SPY VWAP reclaim",
  symbol: "SPY",
  timeframe: "1m",
  logic: "AND",
  conditions: [{ left: "price", operator: "crosses_above", right: "vwap" }],
  cooldownMinutes: 30,
  smsEnabled: false,
  isActive: true,
  marketHoursOnly: true,
};

describe("rule evaluation", () => {
  it("confirms a cross above on the current closed candle", () => {
    expect(
      evaluateCondition(baseRule.conditions[0], state(101, 100), state(99, 100)),
    ).toBe(true);
  });

  it("requires every AND condition", () => {
    expect(
      evaluateRule(
        {
          ...baseRule,
          conditions: [
            baseRule.conditions[0],
            {
              left: "volume",
              operator: ">=",
              right: "average_volume",
              params: { multiplier: 1.5 },
            },
          ],
        },
        state(101, 100),
        state(99, 100),
      ),
    ).toBe(true);
  });

  it("rejects a no-op condition", () => {
    const result = validateAlertRule({
      ...baseRule,
      conditions: [{ left: "price", operator: ">", right: "price" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects volume-to-price comparisons", () => {
    const result = validateAlertRule({
      ...baseRule,
      conditions: [{ left: "volume", operator: "crosses_above", right: "vwap" }],
    });
    expect(result.success).toBe(false);
  });

  it("previews a compound rule with a volume multiplier", () => {
    expect(
      previewRule({
        ...baseRule,
        conditions: [
          baseRule.conditions[0],
          {
            left: "volume",
            operator: ">=",
            right: "average_volume",
            params: { multiplier: 1.5, lookback: 20 },
          },
        ],
      }),
    ).toBe(
      "Alert when SPY price crosses above VWAP AND volume is at least 1.5x the 20-candle average on the 1-minute candle.",
    );
  });

  it("rejects more than four conditions", () => {
    const result = validateAlertRule({
      ...baseRule,
      conditions: Array.from({ length: 5 }, (_, index) => ({
        left: "price",
        operator: index % 2 ? ">" : "<",
        right: index % 2 ? "ema_9" : "ema_20",
      })),
    });
    expect(result.success).toBe(false);
  });
});
