import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { getPostgresStatus, sanitizePostgresError } from "./postgres";

describe("postgres database adapter safety", () => {
  it("redacts database URLs and password parameters from errors", () => {
    const message = sanitizePostgresError(
      new Error("failed postgresql://user:secret@example.test/db password=secret"),
    );

    expect(message).not.toContain("secret");
    expect(message).not.toContain("example.test");
    expect(message).toContain("[redacted");
  });

  it("reports untested status without opening a connection", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "postgres");
    vi.stubEnv("DATABASE_URL", "postgresql://user:secret@example.test/db");

    const status = await getPostgresStatus();

    expect(status).toMatchObject({
      provider: "postgres",
      configured: true,
      connectionTested: false,
      ok: null,
    });
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(JSON.stringify(status)).not.toContain("example.test");
  });

  it("uses Postgres placeholders in the adapter instead of SQLite placeholders", () => {
    const source = readFileSync(new URL("./postgres-repositories.ts", import.meta.url), "utf8");

    expect(source).toContain("$1");
    expect(source).not.toContain("WHERE user_id = ?");
    expect(source).not.toContain("VALUES (?,");
  });
});
