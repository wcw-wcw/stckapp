import { describe, expect, it } from "vitest";
import { validateReplayDataset } from "./candle-dataset";

const candle = (index: number) => ({
  timestamp: new Date(Date.UTC(2026, 5, 2, 13, 30 + index)).toISOString(),
  open: 100 + index * 0.01,
  high: 101 + index * 0.01,
  low: 99 + index * 0.01,
  close: 100.2 + index * 0.01,
  volume: 100000 + index,
});

describe("replay dataset validation", () => {
  it("normalizes a valid replay dataset", () => {
    const result = validateReplayDataset({
      name: "SPY generated day",
      symbol: "SPY",
      candles: Array.from({ length: 80 }, (_, index) => candle(79 - index)),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual_json");
      expect(result.data.candles[0].timestamp).toBe(candle(0).timestamp);
    }
  });

  it("rejects impossible candle ranges", () => {
    const candles = Array.from({ length: 80 }, (_, index) => candle(index));
    candles[0] = { ...candles[0], high: 99 };
    const result = validateReplayDataset({
      name: "Bad candles",
      symbol: "SPY",
      candles,
    });
    expect(result.success).toBe(false);
  });
});
