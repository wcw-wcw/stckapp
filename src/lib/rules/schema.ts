import { z } from "zod";
import { INDICATORS, OPERATORS, SUPPORTED_SYMBOLS, type Indicator, type RuleCondition } from "./types";

const indicatorSchema = z.enum(INDICATORS);
const operatorSchema = z.enum(OPERATORS);
const indicatorTargetSchema = z.object({
  type: z.literal("indicator"),
  indicator: indicatorSchema,
});
const customPriceTargetSchema = z.object({
  type: z.literal("custom_price"),
  price: z.number().positive("Custom price must be greater than 0."),
});
const savedLevelTargetSchema = z.object({
  type: z.literal("saved_level"),
  levelId: z.string().uuid("Choose a saved level."),
  levelName: z.string().trim().max(80).optional(),
  price: z.number().positive().optional(),
});
const rightSchema = z.union([
  indicatorSchema,
  indicatorTargetSchema,
  customPriceTargetSchema,
  savedLevelTargetSchema,
]);

const priceLikeIndicators = new Set<Indicator>([
  "price",
  "vwap",
  "ema_9",
  "ema_20",
  "previous_day_high",
  "previous_day_low",
  "opening_range_high",
  "opening_range_low",
  "premarket_high",
  "premarket_low",
  "high_of_day",
  "low_of_day",
]);

const rightIndicator = (condition: RuleCondition) =>
  typeof condition.right === "string"
    ? condition.right
    : condition.right.type === "indicator"
      ? condition.right.indicator
      : null;

export const isPriceLikeIndicator = (indicator: Indicator) => priceLikeIndicators.has(indicator);

export function isPriceTargetCondition(condition: RuleCondition) {
  const right = rightIndicator(condition);
  return (
    isPriceLikeIndicator(condition.left) &&
    (right ? isPriceLikeIndicator(right) : typeof condition.right !== "string")
  );
}

const conditionSchema = z
  .object({
    left: indicatorSchema,
    operator: operatorSchema,
    right: rightSchema,
    params: z
      .object({
        multiplier: z.number().positive().max(20).optional(),
        percent: z.number().positive().max(100).optional(),
        dollars: z.number().positive().max(10_000).optional(),
        lookback: z.number().int().min(2).max(500).optional(),
      })
      .optional(),
  })
  .superRefine((condition, ctx) => {
    const right = rightIndicator(condition);

    if (right && condition.left === right) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose two different values for each condition.",
      });
    }

    const comparesVolume = condition.left === "volume" || right === "volume";
    const comparesAverageVolume =
      condition.left === "average_volume" || right === "average_volume";
    if (comparesVolume && !comparesAverageVolume) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Volume can only be compared with average volume in the MVP.",
      });
    }

    if ((condition.right as { type?: string }).type === "custom_price" && !isPriceLikeIndicator(condition.left)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom prices can only be compared with price-like values.",
      });
    }

    if ((condition.right as { type?: string }).type === "saved_level" && !isPriceLikeIndicator(condition.left)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Saved levels can only be compared with price-like values.",
      });
    }

    if (right && !isPriceLikeIndicator(condition.left) !== !isPriceLikeIndicator(right)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Price-like values can only be compared with other price-like values.",
      });
    }

    if (condition.operator === "within_percent" && !condition.params?.percent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Within-percent conditions need a percent value.",
      });
    }

    if (condition.operator === "within_dollars" && !condition.params?.dollars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Within-dollar conditions need a dollar amount.",
      });
    }

    if (condition.operator === "within_dollars" && !isPriceTargetCondition(condition)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Within-dollar conditions need price-like values.",
      });
    }
  });

export const alertRuleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  symbol: z.enum(SUPPORTED_SYMBOLS),
  timeframe: z.literal("1m"),
  logic: z.literal("AND"),
  conditions: z.array(conditionSchema).min(1).max(4),
  timeFilter: z
    .object({
      enabled: z.boolean(),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.literal("America/New_York"),
    })
    .optional(),
  cooldownMinutes: z.number().int().min(1).max(1440),
  smsEnabled: z.boolean(),
  isActive: z.boolean(),
  marketHoursOnly: z.boolean(),
});

export function validateAlertRule(input: unknown) {
  return alertRuleSchema.safeParse(input);
}
