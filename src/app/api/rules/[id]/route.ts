import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteRule, setRuleActive } from "@/lib/db/repositories";

const updateSchema = z.object({ isActive: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Choose whether the rule is active." }, { status: 400 });
  }
  const updated = setRuleActive(user.id, (await params).id, result.data.isActive);
  if (!updated) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const deleted = deleteRule(user.id, (await params).id);
  if (!deleted) return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
