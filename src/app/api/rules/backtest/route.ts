import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { marketData } from "@/lib/market/provider";
import { backtestRule } from "@/lib/rules/backtest";
import { buildRuleEvaluationContext, validateSavedLevelTargets } from "@/lib/rules/level-context";
import { validateAlertRule } from "@/lib/rules/schema";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const result = validateAlertRule(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }
  if (user) {
    const savedLevelIssues = await validateSavedLevelTargets(user.id, result.data);
    if (savedLevelIssues.length) {
      return NextResponse.json({ error: savedLevelIssues.join(" ") }, { status: 400 });
    }
  }

  const candles = await marketData.getHistoricalCandles(result.data.symbol, 2_000);
  const context = user ? await buildRuleEvaluationContext(user.id, result.data) : undefined;
  return NextResponse.json(backtestRule(result.data, candles, context));
}
