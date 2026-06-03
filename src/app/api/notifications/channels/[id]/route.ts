import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  deleteNotificationChannel,
  updateNotificationChannel,
} from "@/lib/db/repositories";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  dailyLimit: z.number().int().min(0).max(100).optional(),
  label: z.string().trim().max(80).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Enter valid channel settings." }, { status: 400 });
  }
  const channel = updateNotificationChannel(user.id, (await params).id, result.data);
  if (!channel) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  return NextResponse.json({ channel });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const deleted = deleteNotificationChannel(user.id, (await params).id);
  if (!deleted) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
