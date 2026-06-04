import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBasicHealth, getDeepHealth } from "./health";
import { recordWorkerTickStatus } from "@/lib/db/repositories";

declare global {
  var signalDeskDb: DatabaseSync | undefined;
}

function setupDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(new URL("../../db/local-schema.sql", import.meta.url), "utf8"));
  global.signalDeskDb = database;
  return database;
}

describe("health payloads", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = setupDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.signalDeskDb = undefined;
    database.close();
  });

  it("returns sanitized basic health status", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "postgres");
    vi.stubEnv("DATABASE_URL", "postgresql://user:very-secret@example.test/signaldesk");
    vi.stubEnv("ALPACA_API_SECRET_KEY", "alpaca-secret");

    const health = await getBasicHealth();
    const serialized = JSON.stringify(health);

    expect(health.service).toBe("signaldesk");
    expect(serialized).not.toContain("very-secret");
    expect(serialized).not.toContain("alpaca-secret");
    expect(serialized).not.toContain("example.test");
  });

  it("includes worker heartbeat freshness in deep health", async () => {
    await recordWorkerTickStatus({
      status: "running",
      mode: "mock",
      runtimeMode: "standalone",
      workerId: "worker-test",
      workerName: "Worker Test",
      lastCandleAt: "2026-06-03T15:00:00.000Z",
      symbolsEvaluated: 1,
      rulesEvaluated: 2,
      triggersCreated: 0,
      cooldownSkips: 0,
      providerErrors: 0,
      notificationAttempts: 0,
      isRunning: true,
    });

    const health = await getDeepHealth();

    expect(health.worker).toMatchObject({
      workerId: "worker-test",
      runtimeMode: "standalone",
      running: true,
      heartbeatFresh: true,
    });
    expect(JSON.stringify(health)).not.toContain("postgresql://");
  });
});
