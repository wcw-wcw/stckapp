import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { validateSavedLevelTargets } from "@/lib/rules/level-context";
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
  const savedLevelIssues = user ? await validateSavedLevelTargets(user.id, result.data) : [];
  if (savedLevelIssues.length) {
    return NextResponse.json({ error: savedLevelIssues.join(" ") }, { status: 400 });
  }
  return NextResponse.json({ valid: true });
}
