import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  countNotificationAttemptsToday,
  createNotificationLog,
  getNotificationChannelById,
  incrementNotificationChannelCount,
} from "@/lib/db/repositories";
import {
  globalDailyNotificationLimit,
  maskNotificationDestination,
  notifications,
  realNotificationsEnabled,
} from "@/lib/notifications/notification-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const channel = await getNotificationChannelById(user.id, (await params).id);
  if (!channel) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  if (!channel.isEnabled || !channel.isVerified) {
    return NextResponse.json({ error: "Enable and verify this channel before testing it." }, { status: 400 });
  }
  if (channel.sentToday >= channel.dailyLimit) {
    return NextResponse.json({ error: "This channel has reached its daily limit." }, { status: 429 });
  }
  if ((await countNotificationAttemptsToday()) >= globalDailyNotificationLimit()) {
    return NextResponse.json({ error: "The global daily notification limit has been reached." }, { status: 429 });
  }

  const message = {
    channel,
    subject: "SignalDesk test alert",
    body: "Discord delivery is connected for local alert testing. Not financial advice.",
  };
  const result = await notifications.send(message);
  await createNotificationLog({
    userId: user.id,
    channelId: channel.id,
    provider: result.provider,
    channelType: channel.type,
    destination: maskNotificationDestination(channel.type, channel.destination),
    status: result.status,
    message: message.body,
    error: result.error,
  });
  if (result.status === "sent") await incrementNotificationChannelCount(channel.id);

  return NextResponse.json({
    result,
    realNotificationsEnabled: realNotificationsEnabled() && channel.type === "discord_webhook",
  });
}
