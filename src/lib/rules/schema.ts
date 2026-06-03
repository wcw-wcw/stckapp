import { z } from "zod";
import { INDICATORS, OPERATORS, SUPPORTED_SYMBOLS } from "./types";

const indicatorSchema = z.enum(INDICATORS);
const operatorSchema = z.enum(OPERATORS);

const conditionSchema = z
  .object({
    left: indicatorSchema,
    operator: operatorSchema,
    right: indicatorSchema,
    params: z
      .object({
        multiplier: z.number().positive().max(20).optional(),
        percent: z.number().positive().max(100).optional(),
        lookback: z.number().int().min(2).max(500).optional(),
      })
      .optional(),
  })
  .superRefine((condition, ctx) => {
    if (condition.left === condition.right) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose two different values for each condition.",
      });
    }

    const comparesVolume = condition.left === "volume" || condition.right === "volume";
    const comparesAverageVolume =
      condition.left === "average_volume" || condition.right === "average_volume";
    if (comparesVolume && !comparesAverageVolume) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Volume can only be compared with average volume in the MVP.",
      });
    }

    if (condition.operator === "within_percent" && !condition.params?.percent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Within-percent conditions need a percent value.",
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
