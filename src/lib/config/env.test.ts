import { describe, expect, it } from "vitest";
import { getSafeConfigDiagnostics, loadServerEnv } from "./env";

describe("server env validation", () => {
  it("defaults the database provider to SQLite", () => {
    expect(loadServerEnv({}).DATABASE_PROVIDER).toBe("sqlite");
  });

  it("requires DATABASE_URL for Postgres", () => {
    expect(() => loadServerEnv({ DATABASE_PROVIDER: "postgres" })).toThrow(
      "DATABASE_URL is required when DATABASE_PROVIDER=postgres.",
    );
  });

  it("reports invalid enum values with helpful messages", () => {
    expect(() => loadServerEnv({ MARKET_DATA_PROVIDER: "live" })).toThrow(
      'MARKET_DATA_PROVIDER must be "mock" or "alpaca".',
    );
    expect(() => loadServerEnv({ DATABASE_PROVIDER: "mysql" })).toThrow(
      'DATABASE_PROVIDER must be "sqlite" or "postgres".',
    );
  });

  it("does not expose secrets in sanitized diagnostics or errors", () => {
    const secretUrl = "postgresql://user:very-secret-password@example.test/signaldesk";
    const diagnostics = getSafeConfigDiagnostics({
      DATABASE_PROVIDER: "postgres",
      DATABASE_URL: secretUrl,
      ALPACA_API_KEY_ID: "alpaca-key",
      ALPACA_API_SECRET_KEY: "alpaca-secret",
      ENABLE_REAL_NOTIFICATIONS: "true",
    });

    expect(diagnostics).toMatchObject({
      valid: true,
      databaseProvider: "postgres",
      databaseUrlPresent: true,
      postgresConfigComplete: true,
      alpacaCredentialsPresent: true,
      discordRealNotificationSafety: "real-enabled",
    });
    expect(JSON.stringify(diagnostics)).not.toContain("very-secret-password");
    expect(JSON.stringify(diagnostics)).not.toContain("alpaca-secret");
  });
});
