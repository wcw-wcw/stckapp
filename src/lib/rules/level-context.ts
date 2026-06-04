import { getSymbolLevel } from "@/lib/db/repositories";
import { isLevelExpired } from "@/lib/symbol-levels";
import type { AlertRule, ResolvedRuleTarget, RuleCondition, RuleEvaluationContext } from "./types";

function savedLevelConditions(rule: AlertRule) {
  return rule.conditions.filter(
    (condition): condition is RuleCondition & {
      right: { type: "saved_level"; levelId: string; levelName?: string; price?: number };
    } => typeof condition.right === "object" && condition.right.type === "saved_level",
  );
}

export async function buildRuleEvaluationContext(
  userId: string,
  rule: AlertRule,
  now = new Date(),
): Promise<RuleEvaluationContext> {
  const savedLevels: Record<string, ResolvedRuleTarget | null> = {};
  for (const condition of savedLevelConditions(rule)) {
    const levelId = condition.right.levelId;
    if (levelId in savedLevels) continue;
    const level = await getSymbolLevel(userId, levelId);
    const name = condition.right.levelName ? ` "${condition.right.levelName}"` : "";
    if (!level) {
      savedLevels[levelId] = {
        value: Number.NaN,
        label: condition.right.levelName,
        warning: `Saved level${name} is missing or deleted; this condition will not trigger.`,
      };
      continue;
    }
    if (level.symbol !== rule.symbol) {
      savedLevels[levelId] = {
        value: Number.NaN,
        label: level.name,
        warning: `Saved level "${level.name}" belongs to ${level.symbol}, not ${rule.symbol}; this condition will not trigger.`,
      };
      continue;
    }
    if (isLevelExpired(level.expiresAt, now)) {
      savedLevels[levelId] = {
        value: Number.NaN,
        label: level.name,
        warning: `Saved level "${level.name}" is expired; this condition will not trigger.`,
      };
      continue;
    }
    savedLevels[levelId] = { value: level.price, label: level.name };
  }
  return { savedLevels };
}

export async function validateSavedLevelTargets(userId: string, rule: AlertRule) {
  const issues: string[] = [];
  for (const condition of savedLevelConditions(rule)) {
    const level = await getSymbolLevel(userId, condition.right.levelId);
    if (!level) {
      issues.push("Choose a saved level you own.");
      continue;
    }
    if (level.symbol !== rule.symbol) {
      issues.push(`Saved level "${level.name}" belongs to ${level.symbol}, not ${rule.symbol}.`);
    }
    if (level.isExpired) {
      issues.push(`Saved level "${level.name}" is expired. Choose an active saved level.`);
    }
  }
  return issues;
}
