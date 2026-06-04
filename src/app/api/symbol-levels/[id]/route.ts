import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteSymbolLevel, updateSymbolLevel } from "@/lib/db/repositories";
import { symbolLevelUpdateSchema } from "@/lib/symbol-levels";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = symbolLevelUpdateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map((issue) => issue.message).join(" ") },
      { status: 400 },
    );
  }

  try {
    const level = await updateSymbolLevel(user.id, (await params).id, result.data);
    if (!level) return NextResponse.json({ error: "Level not found." }, { status: 404 });
    return NextResponse.json({ level });
  } catch {
    return NextResponse.json({ error: "Saved level could not be updated." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const deleted = await deleteSymbolLevel(user.id, (await params).id);
    if (!deleted) return NextResponse.json({ error: "Level not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Saved level could not be deleted." }, { status: 500 });
  }
}
