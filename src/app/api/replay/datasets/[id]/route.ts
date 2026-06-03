import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteReplayDataset } from "@/lib/db/repositories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const deleted = deleteReplayDataset(user.id, (await params).id);
  if (!deleted) return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
