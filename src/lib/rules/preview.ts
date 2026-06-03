import type { AlertRule, Indicator, RuleCondition, RuleOperator } from "./types";

const indicatorLabels: Record<Indicator, string> = {
  price: "price",
  volume: "volume",
  vwap: "VWAP",
  ema_9: "EMA 9",
  ema_20: "EMA 20",
  previous_day_high: "previous day high",
  previous_day_low: "previous day low",
  opening_range_high: "opening range high",
  opening_range_low: "opening range low",
  premarket_high: "premarket high",
  premarket_low: "premarket low",
  high_of_day: "high of day",
  low_of_day: "low of day",
  average_volume: "average volume",
};

const operatorLabels: Record<RuleOperator, string> = {
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  ">": "is greater than",
  "<": "is less than",
  ">=": "is at least",
  "<=": "is at most",
  touches: "touches",
  within_percent: "is within",
  breaks_above: "breaks above",
  breaks_below: "breaks below",
};

function summarizeCondition(condition: RuleCondition) {
  const multiplier =
    condition.params?.multiplier && condition.params.multiplier !== 1
      ? `${condition.params.multiplier}x `
      : "";
  const lookback = condition.params?.lookback ?? 20;
  const percent =
    condition.operator === "within_percent"
      ? ` ${condition.params?.percent ?? 1}% of`
      : "";

  if (condition.right === "average_volume") {
    return `${indicatorLabels[condition.left]} ${operatorLabels[condition.operator]} ${multiplier}the ${lookback}-candle average`;
  }

  return `${indicatorLabels[condition.left]} ${operatorLabels[condition.operator]}${percent} ${indicatorLabels[condition.right]}`;
}

export function previewRule(rule: AlertRule) {
  const clauses = rule.conditions.map(summarizeCondition).join(" AND ");
  return `Alert when ${rule.symbol} ${clauses} on the 1-minute candle.`;
}
