import { buildIndicatorStates, isMarketHours } from "@/lib/market/indicators";
import type { AlertRule, BacktestResult, Candle, RuleEvaluationContext } from "./types";
import { evaluateRule } from "./evaluate";

const horizons = [5, 15, 30, 60] as const;

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const percent = (value: number) => Number((value * 100).toFixed(2));

export function backtestRule(
  rule: AlertRule,
  candles: Candle[],
  context?: RuleEvaluationContext,
): BacktestResult {
  const states = buildIndicatorStates(candles);
  const signals: number[] = [];
  let lastSignalIndex = -Infinity;

  for (let index = 20; index < states.length - 60; index += 1) {
    const outsideCooldown = index - lastSignalIndex >= rule.cooldownMinutes;
    const withinMarketHours = !rule.marketHoursOnly || isMarketHours(states[index].timestamp);
    if (
      outsideCooldown &&
      withinMarketHours &&
      evaluateRule(rule, states[index], states[index - 1], context)
    ) {
      signals.push(index);
      lastSignalIndex = index;
    }
  }

  const moves = (horizon: (typeof horizons)[number]) =>
    signals.map((index) => {
      const entry = candles[index + 1].open;
      return (candles[index + horizon].close - entry) / entry;
    });

  const sixtyMinuteMoves = moves(60);
  const favorableMoves = signals.map((index) => {
    const entry = candles[index + 1].open;
    const high = Math.max(...candles.slice(index + 1, index + 61).map((candle) => candle.high));
    return (high - entry) / entry;
  });
  const adverseMoves = signals.map((index) => {
    const entry = candles[index + 1].open;
    const low = Math.min(...candles.slice(index + 1, index + 61).map((candle) => candle.low));
    return (low - entry) / entry;
  });

  const byHour = new Map<string, number[]>();
  signals.forEach((index, signalIndex) => {
    const hour = new Date(candles[index].timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      timeZone: "America/New_York",
    });
    byHour.set(hour, [...(byHour.get(hour) ?? []), sixtyMinuteMoves[signalIndex]]);
  });
  const rankedHours = [...byHour.entries()].sort((a, b) => mean(b[1]) - mean(a[1]));

  return {
    triggerCount: signals.length,
    warning:
      signals.length < 20
        ? `This rule only triggered ${signals.length} times in this period. Statistics may not be reliable.`
        : undefined,
    forward: Object.fromEntries(
      horizons.map((horizon) => {
        const horizonMoves = moves(horizon);
        return [
          String(horizon),
          {
            averageMove: percent(mean(horizonMoves)),
            percentPositive: percent(
              horizonMoves.length
                ? horizonMoves.filter((move) => move > 0).length / horizonMoves.length
                : 0,
            ),
          },
        ];
      }),
    ) as BacktestResult["forward"],
    averageMaxFavorableMove: percent(mean(favorableMoves)),
    averageMaxAdverseMove: percent(mean(adverseMoves)),
    bestResult: percent(sixtyMinuteMoves.length ? Math.max(...sixtyMinuteMoves) : 0),
    worstResult: percent(sixtyMinuteMoves.length ? Math.min(...sixtyMinuteMoves) : 0),
    bestTimeOfDay: rankedHours.at(0)?.[0] ?? null,
    worstTimeOfDay: rankedHours.at(-1)?.[0] ?? null,
  };
}
