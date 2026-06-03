import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createNotificationChannel,
  listNotificationChannels,
  type NotificationChannelType,
} from "@/lib/db/repositories";

const channelSchema = z.object({
  type: z.enum(["email", "discord_webhook"]),
  destination: z.string().trim().min(3).max(500),
  label: z.string().trim().max(80).optional(),
  dailyLimit: z.number().int().min(0).max(100).optional(),
});

function validateDestination(type: NotificationChannelType, destination: string) {
  if (type === "email") {
    return z.string().email().safeParse(destination).success;
  }
  if (type === "discord_webhook") {
    try {
      const url = new URL(destination);
      return url.protocol === "https:" && url.hostname === "discord.com";
    } catch {
      return false;
    }
  }
  return false;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ channels: await listNotificationChannels(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = channelSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ error: "Enter a valid notification channel." }, { status: 400 });
  }
  if (!validateDestination(result.data.type, result.data.destination)) {
    return NextResponse.json({ error: "That destination does not match the selected channel type." }, { status: 400 });
  }

  const channel = await createNotificationChannel(user.id, {
    type: result.data.type,
    destination: result.data.destination,
    label: result.data.label,
    dailyLimit: result.data.dailyLimit,
    isVerified: true,
    isEnabled: true,
  });
  return NextResponse.json({ channel }, { status: 201 });
}
