import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildRuleEvaluationContext } from "@/lib/rules/level-context";
import { previewRule } from "@/lib/rules/preview";
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
  const context = user ? await buildRuleEvaluationContext(user.id, result.data) : undefined;
  return NextResponse.json({ preview: previewRule(result.data, context) });
}
