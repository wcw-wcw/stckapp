import { afterEach, describe, expect, it, vi } from "vitest";
import {
  globalDailyNotificationLimit,
  maskNotificationDestination,
  NotificationRouterService,
} from "./notification-service";
import type { NotificationChannel } from "@/lib/db/repositories";

const channel: NotificationChannel = {
  id: "channel-1",
  type: "discord_webhook",
  destination: "https://discord.com/api/webhooks/1234567890/token-value",
  label: "Discord",
  isVerified: true,
  isEnabled: true,
  dailyLimit: 25,
  sentToday: 0,
  countDate: "2026-06-02",
  createdAt: "2026-06-02T14:00:00.000Z",
};

describe("notification service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("masks Discord webhook tokens", () => {
    expect(maskNotificationDestination(channel.type, channel.destination)).toBe(
      "https://discord.com/api/webhooks/1234567890/...",
    );
  });

  it("reads the global notification cap from env with a safe default", () => {
    vi.stubEnv("GLOBAL_DAILY_NOTIFICATION_LIMIT", "12");
    expect(globalDailyNotificationLimit()).toBe(12);
    vi.stubEnv("GLOBAL_DAILY_NOTIFICATION_LIMIT", "not-a-number");
    expect(globalDailyNotificationLimit()).toBe(100);
  });

  it("keeps Discord mocked when real notifications are disabled", async () => {
    vi.stubEnv("ENABLE_REAL_NOTIFICATIONS", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await new NotificationRouterService().send({
      channel,
      subject: "Test",
      body: "Body",
    });

    expect(result.provider).toBe("mock-discord-webhook");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends Discord webhooks when real notifications are enabled", async () => {
    vi.stubEnv("ENABLE_REAL_NOTIFICATIONS", "true");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await new NotificationRouterService().send({
      channel,
      subject: "Test",
      body: "Body",
    });

    expect(result.provider).toBe("discord-webhook");
    expect(result.status).toBe("sent");
    expect(fetchSpy).toHaveBeenCalledWith(
      channel.destination,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
  });
});
