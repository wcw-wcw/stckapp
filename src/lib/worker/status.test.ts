import { describe, expect, it } from "vitest";
import { activeWorkerWarning, isRecentWorkerHeartbeat, sanitizeWorkerError } from "./status";

describe("worker status helpers", () => {
  it("redacts secrets from worker errors", () => {
    const message = sanitizeWorkerError(
      "failed postgresql://user:secret@example.test/db password=hunter2 https://discord.com/api/webhooks/123/secret",
    );

    expect(message).toContain("[redacted-database-url]");
    expect(message).toContain("password=[redacted]");
    expect(message).toContain("[redacted-discord-webhook]");
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("secret@example");
  });

  it("treats recent running heartbeats as active", () => {
    const now = new Date("2026-06-03T15:00:00.000Z");
    expect(
      isRecentWorkerHeartbeat(
        {
          is_running: 1,
          heartbeat_at: "2026-06-03T14:59:30.000Z",
          last_update_at: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isRecentWorkerHeartbeat(
        {
          is_running: 1,
          heartbeat_at: "2026-06-03T14:55:00.000Z",
          last_update_at: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("warns when another worker has a fresh heartbeat", () => {
    expect(
      activeWorkerWarning(
        {
          worker_id: "other-worker",
          worker_name: "Other worker",
          runtime_mode: "standalone",
          is_running: 1,
          heartbeat_at: "2026-06-03T14:59:30.000Z",
          last_update_at: null,
        },
        "current-worker",
        new Date("2026-06-03T15:00:00.000Z"),
      ),
    ).toBe("Another worker appears active: Other worker (standalone).");
  });
});
