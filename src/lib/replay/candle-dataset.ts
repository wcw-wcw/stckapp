import { z } from "zod";
import { SUPPORTED_SYMBOLS, type Candle, type SupportedSymbol } from "@/lib/rules/types";

export const replayCandleSchema = z.object({
  timestamp: z.string().datetime(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
});

export const replayDatasetSchema = z.object({
  name: z.string().trim().min(3).max(100),
  symbol: z.enum(SUPPORTED_SYMBOLS),
  source: z.string().trim().min(3).max(40).optional(),
  candles: z.array(replayCandleSchema).min(80).max(5_000),
});

export type ReplayDatasetInput = z.infer<typeof replayDatasetSchema>;

export function normalizeReplayCandles(candles: Candle[]) {
  return [...candles]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((candle) => ({
      ...candle,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
    }));
}

export function validateReplayDataset(input: unknown) {
  const result = replayDatasetSchema.safeParse(input);
  if (!result.success) return result;

  const candles = normalizeReplayCandles(result.data.candles);
  for (const candle of candles) {
    if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) {
      return {
        success: false as const,
        error: new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: "Each candle high must be at least open/close and low must be at most open/close.",
            path: ["candles"],
          },
        ]),
      };
    }
  }

  return {
    success: true as const,
    data: {
      ...result.data,
      source: result.data.source ?? "manual_json",
      symbol: result.data.symbol as SupportedSymbol,
      candles,
    },
  };
}
