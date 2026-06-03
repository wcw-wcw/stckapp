import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLocalCleanup } from "./cleanup";

declare global {
  var signalDeskDb: DatabaseSync | undefined;
}

const userId = "user-1";
const now = new Date("2026-06-03T15:00:00.000Z");

function setupDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(new URL("../../../db/local-schema.sql", import.meta.url), "utf8"));
  global.signalDeskDb = database;
  database
    .prepare(
      "INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(userId, "test@example.com", "hash", "user", now.toISOString(), now.toISOString());
  return database;
}

describe("local cleanup", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = setupDatabase();
  });

  afterEach(() => {
    global.signalDeskDb = undefined;
    database.close();
  });

  it("deletes expired and old local records with useful counts", async () => {
    database
      .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("session-old", userId, "old", "2026-06-03T14:59:00.000Z", now.toISOString());
    database
      .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("session-new", userId, "new", "2026-06-03T15:01:00.000Z", now.toISOString());
    database
      .prepare(
        "INSERT INTO phone_verifications (id, user_id, phone_number, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run("phone-old", userId, "+13125550123", "hash", "2026-06-03T14:59:00.000Z", "2026-06-02T14:00:00.000Z");
    database
      .prepare(
        "INSERT INTO provider_error_logs (id, provider, symbol, context, status_code, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("provider-old", "mock", "SPY", "test", null, "old", "2026-05-15T15:00:00.000Z");
    database
      .prepare(
        "INSERT INTO provider_error_logs (id, provider, symbol, context, status_code, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run("provider-new", "mock", "SPY", "test", null, "new", "2026-06-01T15:00:00.000Z");
    database
      .prepare(
        "INSERT INTO notification_logs (id, user_id, provider, channel_type, destination, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("notification-old", userId, "mock-email", "email", "test@example.com", "sent", "old", "2026-05-01T15:00:00.000Z");
    database
      .prepare(
        "INSERT INTO backtest_results (id, user_id, rule_id, symbol, range_label, range_start, range_end, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("backtest-old", userId, null, "SPY", "1d", now.toISOString(), now.toISOString(), "{}", "2026-05-01T15:00:00.000Z");
    database
      .prepare(
        "INSERT INTO suggested_rule_candidates (id, symbol, rule_json, stats_json, score, sample_size, generated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("suggestion-old", "SPY", "{}", "{}", 1, 10, now.toISOString(), "2026-06-03T14:00:00.000Z");
    database
      .prepare(
        "INSERT INTO suggested_rule_candidates (id, symbol, rule_json, stats_json, score, sample_size, generated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("suggestion-new", "SPY", "{}", "{}", 1, 10, now.toISOString(), "2026-06-03T16:00:00.000Z");

    expect(await runLocalCleanup(now)).toEqual({
      expiredSessions: 1,
      phoneVerifications: 1,
      providerErrorLogs: 1,
      notificationLogs: 1,
      cachedBacktestResults: 1,
      suggestedRuleCandidates: 1,
    });
    expect(database.prepare("SELECT COUNT(*) AS count FROM sessions").get()).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM provider_error_logs").get()).toEqual({ count: 1 });
    expect(database.prepare("SELECT COUNT(*) AS count FROM suggested_rule_candidates").get()).toEqual({ count: 1 });
  });
});
