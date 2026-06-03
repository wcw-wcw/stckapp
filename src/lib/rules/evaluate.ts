import type { AlertRule, IndicatorState, RuleCondition } from "./types";

function values(condition: RuleCondition, state: IndicatorState) {
  const rightValue = state[condition.right] * (condition.params?.multiplier ?? 1);
  return [state[condition.left], rightValue] as const;
}

export function evaluateCondition(
  condition: RuleCondition,
  current: IndicatorState,
  previous?: IndicatorState,
) {
  const [left, right] = values(condition, current);
  const [previousLeft, previousRight] = previous
    ? values(condition, previous)
    : [left, right];

  switch (condition.operator) {
    case "crosses_above":
    case "breaks_above":
      return previousLeft <= previousRight && left > right;
    case "crosses_below":
    case "breaks_below":
      return previousLeft >= previousRight && left < right;
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "touches":
      return Math.abs(left - right) / Math.max(Math.abs(right), 0.0001) <= 0.0005;
    case "within_percent":
      return (
        Math.abs(left - right) / Math.max(Math.abs(right), 0.0001) <=
        (condition.params?.percent ?? 1) / 100
      );
  }
}

export function evaluateRule(
  rule: AlertRule,
  current: IndicatorState,
  previous?: IndicatorState,
) {
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, current, previous),
  );
}
