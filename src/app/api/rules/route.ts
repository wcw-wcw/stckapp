import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createRule, hasVerifiedNotificationChannel, listRules } from "@/lib/db/repositories";
import { validateAlertRule } from "@/lib/rules/schema";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ rules: await listRules(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = validateAlertRule(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }
  if (result.data.smsEnabled && !(await hasVerifiedNotificationChannel(user.id))) {
    return NextResponse.json(
      { error: "Add a verified notification channel before enabling rule notifications." },
      { status: 400 },
    );
  }
  return NextResponse.json({ rule: await createRule(user.id, result.data) }, { status: 201 });
}
