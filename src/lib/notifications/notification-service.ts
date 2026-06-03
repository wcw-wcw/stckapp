import type {
  NotificationChannel,
  NotificationChannelType,
} from "@/lib/db/repositories";
import type { SupportedSymbol } from "@/lib/rules/types";

export type NotificationMessage = {
  channel: NotificationChannel;
  subject: string;
  body: string;
};

export type NotificationResult = {
  provider: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

export interface NotificationService {
  send(message: NotificationMessage): Promise<NotificationResult>;
}

const providerLabels: Record<NotificationChannelType, string> = {
  sms: "mock-sms",
  email: "mock-email",
  discord_webhook: "mock-discord-webhook",
};

export function realNotificationsEnabled() {
  return process.env.ENABLE_REAL_NOTIFICATIONS === "true";
}

export function globalDailyNotificationLimit() {
  const value = Number(process.env.GLOBAL_DAILY_NOTIFICATION_LIMIT ?? 100);
  return Number.isFinite(value) && value >= 0 ? value : 100;
}

export function maskNotificationDestination(type: NotificationChannelType, destination: string) {
  if (type !== "discord_webhook") return destination;
  try {
    const url = new URL(destination);
    const parts = url.pathname.split("/").filter(Boolean);
    const webhookId = parts[2];
    return webhookId ? `https://${url.hostname}/api/webhooks/${webhookId}/...` : "Discord webhook";
  } catch {
    return "Discord webhook";
  }
}

export class MockNotificationService implements NotificationService {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    const provider = providerLabels[message.channel.type];
    console.info(
      `[${provider}]`,
      maskNotificationDestination(message.channel.type, message.channel.destination),
      message.subject,
      message.body,
    );
    return { provider, status: "sent", providerMessageId: "mock-only" };
  }
}

export class DiscordWebhookNotificationService implements NotificationService {
  async send(message: NotificationMessage): Promise<NotificationResult> {
    if (message.channel.type !== "discord_webhook") {
      return new MockNotificationService().send(message);
    }

    const response = await fetch(message.channel.destination, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "SignalDesk",
        content: `**${message.subject}**\n${message.body}`,
        allowed_mentions: { parse: [] },
      }),
    });

    if (response.ok) {
      return {
        provider: "discord-webhook",
        status: "sent",
        providerMessageId: response.headers.get("x-ratelimit-bucket") ?? undefined,
      };
    }

    const text = await response.text();
    return {
      provider: "discord-webhook",
      status: "failed",
      error: `Discord webhook ${response.status}: ${text.slice(0, 240)}`,
    };
  }
}

export class NotificationRouterService implements NotificationService {
  private readonly mock = new MockNotificationService();
  private readonly discord = new DiscordWebhookNotificationService();

  async send(message: NotificationMessage): Promise<NotificationResult> {
    if (realNotificationsEnabled() && message.channel.type === "discord_webhook") {
      return this.discord.send(message);
    }
    return this.mock.send(message);
  }
}

export function buildAlertNotification(input: {
  symbol: SupportedSymbol;
  ruleName: string;
  triggerPrice: number;
  conditionSummary: string;
}) {
  return {
    subject: `${input.symbol} alert: ${input.ruleName}`,
    body: `${input.symbol} triggered "${input.ruleName}" at $${input.triggerPrice.toFixed(2)}. ${input.conditionSummary}. Not financial advice.`,
  };
}

export const notifications = new NotificationRouterService();
