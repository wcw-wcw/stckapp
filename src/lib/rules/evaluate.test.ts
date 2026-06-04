import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateRule } from "./evaluate";
import { backtestRule } from "./backtest";
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

describe("price-target backtests", () => {
  it("supports custom price and saved-level rule payloads in backtests", () => {
    const start = new Date("2026-06-02T14:00:00.000Z").getTime();
    const candles = Array.from({ length: 140 }, (_, index) => ({
      timestamp: new Date(start + index * 60_000).toISOString(),
      open: 99 + index * 0.05,
      high: 99.2 + index * 0.05,
      low: 98.8 + index * 0.05,
      close: 99 + index * 0.05,
      volume: 1_000,
    }));
    const customRule: AlertRule = {
      ...baseRule,
      marketHoursOnly: false,
      cooldownMinutes: 1,
      conditions: [{ left: "price", operator: "crosses_above", right: { type: "custom_price", price: 100.5 } }],
    };
    const savedLevelRule: AlertRule = {
      ...baseRule,
      marketHoursOnly: false,
      cooldownMinutes: 1,
      conditions: [
        {
          left: "price",
          operator: "within_dollars",
          right: { type: "saved_level", levelId: "00000000-0000-0000-0000-000000000002", levelName: "support" },
          params: { dollars: 0.1 },
        },
      ],
    };

    expect(backtestRule(customRule, candles).triggerCount).toBeGreaterThan(0);
    expect(
      backtestRule(savedLevelRule, candles, {
        savedLevels: { "00000000-0000-0000-0000-000000000002": { value: 100.5, label: "support" } },
      }).triggerCount,
    ).toBeGreaterThan(0);
  });
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

  it("validates and evaluates custom price targets", () => {
    const rule: AlertRule = {
      ...baseRule,
      conditions: [{ left: "price", operator: "crosses_above", right: { type: "custom_price", price: 542.5 } }],
    };
    expect(validateAlertRule(rule).success).toBe(true);
    expect(evaluateRule(rule, state(543, 100), state(542, 100))).toBe(true);
    expect(previewRule(rule)).toBe(
      "Alert when SPY price crosses above $542.50 on the 1-minute candle.",
    );
  });

  it("rejects invalid custom price targets", () => {
    const result = validateAlertRule({
      ...baseRule,
      conditions: [{ left: "price", operator: "touches", right: { type: "custom_price", price: 0 } }],
    });
    expect(result.success).toBe(false);
  });

  it("evaluates saved-level and within-dollar targets when a level is resolved", () => {
    const rule: AlertRule = {
      ...baseRule,
      conditions: [
        {
          left: "price",
          operator: "within_dollars",
          right: { type: "saved_level", levelId: "00000000-0000-0000-0000-000000000001", levelName: "support" },
          params: { dollars: 0.25 },
        },
      ],
    };

    expect(validateAlertRule(rule).success).toBe(true);
    expect(
      evaluateRule(rule, state(536.2, 100), undefined, {
        savedLevels: { "00000000-0000-0000-0000-000000000001": { value: 536.4, label: "support" } },
      }),
    ).toBe(true);
    expect(
      previewRule(rule, {
        savedLevels: { "00000000-0000-0000-0000-000000000001": { value: 536.4, label: "support" } },
      }),
    ).toBe(
      "Alert when SPY price is within $0.25 of saved level \"support\" at $536.40 on the 1-minute candle.",
    );
  });

  it("does not trigger unresolved saved-level targets", () => {
    const rule: AlertRule = {
      ...baseRule,
      conditions: [
        {
          left: "price",
          operator: "touches",
          right: { type: "saved_level", levelId: "00000000-0000-0000-0000-000000000001", levelName: "missing" },
        },
      ],
    };
    expect(evaluateRule(rule, state(536.4, 100), undefined, { savedLevels: {} })).toBe(false);
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
