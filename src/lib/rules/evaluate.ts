import type { AlertRule, IndicatorState, ResolvedRuleTarget, RuleCondition, RuleEvaluationContext } from "./types";

export function rightTargetId(condition: RuleCondition) {
  return typeof condition.right === "object" && condition.right.type === "saved_level"
    ? condition.right.levelId
    : null;
}

export function resolveRightTarget(
  condition: RuleCondition,
  state: IndicatorState,
  context?: RuleEvaluationContext,
): ResolvedRuleTarget | null {
  if (typeof condition.right === "string") {
    return { value: state[condition.right] * (condition.params?.multiplier ?? 1) };
  }
  if (condition.right.type === "indicator") {
    return { value: state[condition.right.indicator] * (condition.params?.multiplier ?? 1) };
  }
  if (condition.right.type === "custom_price") {
    return { value: condition.right.price };
  }
  return context?.savedLevels?.[condition.right.levelId] ?? null;
}

function values(
  condition: RuleCondition,
  state: IndicatorState,
  context?: RuleEvaluationContext,
) {
  const right = resolveRightTarget(condition, state, context);
  if (!right || !Number.isFinite(right.value)) return null;
  return [state[condition.left], right.value] as const;
}

export function evaluateCondition(
  condition: RuleCondition,
  current: IndicatorState,
  previous?: IndicatorState,
  context?: RuleEvaluationContext,
) {
  const currentValues = values(condition, current, context);
  if (!currentValues) return false;
  const [left, right] = currentValues;
  const previousValues = previous ? values(condition, previous, context) : currentValues;
  if (!previousValues) return false;
  const [previousLeft, previousRight] = previousValues;

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
    case "within_dollars":
      return Math.abs(left - right) <= (condition.params?.dollars ?? 1);
  }
}

export function evaluateRule(
  rule: AlertRule,
  current: IndicatorState,
  previous?: IndicatorState,
  context?: RuleEvaluationContext,
) {
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, current, previous, context),
  );
}
