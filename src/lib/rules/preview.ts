import type {
  AlertRule,
  Indicator,
  ResolvedRuleTarget,
  RuleCondition,
  RuleEvaluationContext,
  RuleOperator,
} from "./types";

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
  within_dollars: "is within",
  breaks_above: "breaks above",
  breaks_below: "breaks below",
};

const money = (value: number) => `$${value.toFixed(2)}`;

function targetLabel(condition: RuleCondition, context?: RuleEvaluationContext) {
  if (typeof condition.right === "string") return indicatorLabels[condition.right];
  if (condition.right.type === "indicator") return indicatorLabels[condition.right.indicator];
  if (condition.right.type === "custom_price") return money(condition.right.price);

  const resolved = context?.savedLevels?.[condition.right.levelId] as ResolvedRuleTarget | null | undefined;
  const name = condition.right.levelName ?? resolved?.label ?? "saved level";
  const price = resolved?.value ?? condition.right.price;
  return price ? `saved level "${name}" at ${money(price)}` : `saved level "${name}"`;
}

export function ruleWarnings(rule: AlertRule, context?: RuleEvaluationContext) {
  return rule.conditions.flatMap((condition) => {
    if (typeof condition.right !== "object" || condition.right.type !== "saved_level") return [];
    const resolved = context?.savedLevels?.[condition.right.levelId];
    if (resolved?.warning) return [resolved.warning];
    if (!resolved) {
      const name = condition.right.levelName ? ` "${condition.right.levelName}"` : "";
      return [`Saved level${name} cannot be resolved; this condition will not trigger.`];
    }
    return [];
  });
}

function summarizeCondition(condition: RuleCondition, context?: RuleEvaluationContext) {
  const multiplier =
    condition.params?.multiplier && condition.params.multiplier !== 1
      ? `${condition.params.multiplier}x `
      : "";
  const lookback = condition.params?.lookback ?? 20;
  const percent =
    condition.operator === "within_percent"
      ? ` ${condition.params?.percent ?? 1}% of`
      : "";
  const dollars =
    condition.operator === "within_dollars"
      ? ` ${money(condition.params?.dollars ?? 1)} of`
      : "";
  const right = typeof condition.right === "string"
    ? condition.right
    : condition.right.type === "indicator"
      ? condition.right.indicator
      : null;

  if (right === "average_volume") {
    return `${indicatorLabels[condition.left]} ${operatorLabels[condition.operator]} ${multiplier}the ${lookback}-candle average`;
  }

  return `${indicatorLabels[condition.left]} ${operatorLabels[condition.operator]}${percent}${dollars} ${targetLabel(condition, context)}`;
}

export function previewRule(rule: AlertRule, context?: RuleEvaluationContext) {
  const clauses = rule.conditions.map((condition) => summarizeCondition(condition, context)).join(" AND ");
  return `Alert when ${rule.symbol} ${clauses} on the 1-minute candle.`;
}
