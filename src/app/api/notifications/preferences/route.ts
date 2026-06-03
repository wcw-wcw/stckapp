import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/db/repositories";

const updateSchema = z.object({
  notificationsPaused: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ preferences: await getUserNotificationPreferences(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = updateSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Enter valid notification preferences." }, { status: 400 });
  }

  const preferences = await updateUserNotificationPreferences(user.id, result.data);
  return NextResponse.json({ preferences });
}
