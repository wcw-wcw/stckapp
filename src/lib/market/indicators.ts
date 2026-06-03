import type { Candle, IndicatorState } from "@/lib/rules/types";

const easternTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function easternParts(timestamp: string) {
  const parts = Object.fromEntries(
    easternTime.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isMarketHours(timestamp: string) {
  const { minutes } = easternParts(timestamp);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function calculateEMA(values: number[], period: number) {
  if (values.length === 0) return 0;
  const multiplier = 2 / (period + 1);
  return values.slice(1).reduce(
    (ema, value) => value * multiplier + ema * (1 - multiplier),
    values[0],
  );
}

export function calculateVWAP(candles: Candle[]) {
  const totals = candles.reduce(
    (result, candle) => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      return {
        value: result.value + typicalPrice * candle.volume,
        volume: result.volume + candle.volume,
      };
    },
    { value: 0, volume: 0 },
  );
  return totals.volume ? totals.value / totals.volume : 0;
}

export function calculateAverageVolume(candles: Candle[], lookback = 20) {
  const window = candles.slice(-lookback);
  return window.length
    ? window.reduce((sum, candle) => sum + candle.volume, 0) / window.length
    : 0;
}

export function buildIndicatorStates(candles: Candle[]): IndicatorState[] {
  let currentDate = "";
  let marketCandles: Candle[] = [];
  let previousSession: Candle[] = [];
  let premarketCandles: Candle[] = [];
  let previousCandles: Candle[] = [];

  return candles.map((candle) => {
    const { date, minutes } = easternParts(candle.timestamp);
    if (date !== currentDate) {
      if (marketCandles.length) previousSession = marketCandles;
      currentDate = date;
      marketCandles = [];
      premarketCandles = [];
    }

    const duringMarketHours = minutes >= 9 * 60 + 30 && minutes < 16 * 60;
    if (duringMarketHours) marketCandles.push(candle);
    if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) premarketCandles.push(candle);

    const recent = (marketCandles.length ? marketCandles : [...previousCandles, candle]).slice(-80);
    const openingRange = marketCandles.slice(0, 15);
    const previousClose = previousCandles.at(-1)?.close ?? candle.open;
    const previousDayHigh = previousSession.length
      ? Math.max(...previousSession.map((item) => item.high))
      : previousClose * 1.012;
    const previousDayLow = previousSession.length
      ? Math.min(...previousSession.map((item) => item.low))
      : previousClose * 0.988;
    const openingRangeHigh = openingRange.length
      ? Math.max(...openingRange.map((item) => item.high))
      : candle.high;
    const openingRangeLow = openingRange.length
      ? Math.min(...openingRange.map((item) => item.low))
      : candle.low;
    const premarketHigh = premarketCandles.length
      ? Math.max(...premarketCandles.map((item) => item.high))
      : previousClose * 1.006;
    const premarketLow = premarketCandles.length
      ? Math.min(...premarketCandles.map((item) => item.low))
      : previousClose * 0.994;
    const highOfDay = Math.max(...marketCandles.map((item) => item.high), candle.high);
    const lowOfDay = Math.min(...marketCandles.map((item) => item.low), candle.low);

    const state = {
      timestamp: candle.timestamp,
      price: candle.close,
      volume: candle.volume,
      vwap: calculateVWAP(recent),
      ema_9: calculateEMA(recent.map((item) => item.close), 9),
      ema_20: calculateEMA(recent.map((item) => item.close), 20),
      previous_day_high: previousDayHigh,
      previous_day_low: previousDayLow,
      opening_range_high: openingRangeHigh,
      opening_range_low: openingRangeLow,
      premarket_high: premarketHigh,
      premarket_low: premarketLow,
      high_of_day: highOfDay,
      low_of_day: lowOfDay,
      average_volume: calculateAverageVolume(previousCandles, 20) || candle.volume,
    };
    previousCandles = [...previousCandles.slice(-79), candle];
    return state;
  });
}
