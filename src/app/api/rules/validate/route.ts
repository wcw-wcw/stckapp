import { NextResponse } from "next/server";
import { validateAlertRule } from "@/lib/rules/schema";

export async function POST(request: Request) {
  const result = validateAlertRule(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }
  return NextResponse.json({ valid: true });
}
