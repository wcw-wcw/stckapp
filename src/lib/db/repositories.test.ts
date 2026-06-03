import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAlertEvent,
  createNotificationChannel,
  createRule,
  getUserNotificationPreferences,
  listNotificationLogs,
  updateUserNotificationPreferences,
  type WorkerRule,
} from "./repositories";
import { sendRuleNotifications } from "@/lib/worker/local-mock-worker";
import type { AlertRule, IndicatorState } from "@/lib/rules/types";

declare global {
  var signalDeskDb: DatabaseSync | undefined;
}

const userId = "user-1";

const alertRule: AlertRule = {
  name: "SPY breakout",
  symbol: "SPY",
  timeframe: "1m",
  logic: "AND",
  conditions: [{ left: "price", operator: ">", right: "ema_20" }],
  cooldownMinutes: 30,
  smsEnabled: true,
  isActive: true,
  marketHoursOnly: true,
};

const state: IndicatorState = {
  timestamp: "2026-06-02T14:35:00.000Z",
  price: 101,
  volume: 1000,
  vwap: 100,
  ema_9: 100,
  ema_20: 99,
  previous_day_high: 102,
  previous_day_low: 95,
  opening_range_high: 100,
  opening_range_low: 98,
  premarket_high: 100,
  premarket_low: 97,
  high_of_day: 101,
  low_of_day: 98,
  average_volume: 900,
};

function setupDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(new URL("../../../db/local-schema.sql", import.meta.url), "utf8"));
  global.signalDeskDb = database;
  database
    .prepare(
      "INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(userId, "test@example.com", "hash", "user", "2026-06-02T14:00:00.000Z", "2026-06-02T14:00:00.000Z");
  return database;
}

async function createWorkerRule() {
  const saved = await createRule(userId, alertRule);
  return { ...saved, userId, lastTriggeredAt: null } satisfies WorkerRule;
}

function alertStatus(eventId: string) {
  return global.signalDeskDb
    ?.prepare("SELECT sms_status, sms_error FROM alert_events WHERE id = ?")
    .get(eventId) as { sms_status: string; sms_error: string | null };
}

describe("notification preferences", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = setupDatabase();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    global.signalDeskDb = undefined;
    database.close();
  });

  it("defaults account notifications to unpaused", async () => {
    expect(await getUserNotificationPreferences(userId)).toMatchObject({
      userId,
      notificationsPaused: false,
    });
  });

  it("updates account-level notification pause", async () => {
    expect(await updateUserNotificationPreferences(userId, { notificationsPaused: true })).toMatchObject({
      userId,
      notificationsPaused: true,
    });
    expect((await getUserNotificationPreferences(userId)).notificationsPaused).toBe(true);
  });

  it("skips automatic worker notifications when account notifications are paused", async () => {
    await updateUserNotificationPreferences(userId, { notificationsPaused: true });
    await createNotificationChannel(userId, {
      type: "email",
      destination: "test@example.com",
      label: "Email",
      isVerified: true,
      isEnabled: true,
    });
    const rule = await createWorkerRule();
    const eventId = await createAlertEvent(rule, state, "condition met");
    expect(eventId).toBeTruthy();

    const attempts = await sendRuleNotifications(rule, state, eventId!);

    expect(attempts).toBe(0);
    expect(alertStatus(eventId!)).toEqual({
      sms_status: "skipped_account_paused",
      sms_error: "Account notification pause is enabled.",
    });
    expect(await listNotificationLogs(userId)).toHaveLength(0);
  });

  it("keeps notification caps working when account notifications are not paused", async () => {
    vi.stubEnv("GLOBAL_DAILY_NOTIFICATION_LIMIT", "0");
    await createNotificationChannel(userId, {
      type: "email",
      destination: "test@example.com",
      label: "Email",
      isVerified: true,
      isEnabled: true,
    });
    const rule = await createWorkerRule();
    const eventId = await createAlertEvent(rule, state, "condition met");
    expect(eventId).toBeTruthy();

    const attempts = await sendRuleNotifications(rule, state, eventId!);

    expect(attempts).toBe(1);
    expect(alertStatus(eventId!).sms_status).toBe("skipped_global_limit");
    expect(await listNotificationLogs(userId)).toMatchObject([
      {
        provider: "notification-cap",
        status: "skipped_global_limit",
      },
    ]);
  });
});
