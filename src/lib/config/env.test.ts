import { describe, expect, it } from "vitest";
import { getConfigWarnings, getSafeConfigDiagnostics, loadServerEnv } from "./env";

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

  it("warns about production deployment footguns without blocking local defaults", () => {
    expect(getConfigWarnings({})).toEqual([]);
    expect(
      getConfigWarnings({
        NODE_ENV: "production",
        DATABASE_PROVIDER: "sqlite",
      }),
    ).toContain("SQLite is configured in a production-like environment; use DATABASE_PROVIDER=postgres for deployment.");
    expect(
      getConfigWarnings({
        MARKET_DATA_PROVIDER: "alpaca",
        ALPACA_API_KEY_ID: "key",
      }),
    ).toContain("MARKET_DATA_PROVIDER=alpaca is set but Alpaca credentials are incomplete; the app will use mock data.");
    expect(
      getConfigWarnings({
        ENABLE_REAL_NOTIFICATIONS: "true",
        GLOBAL_DAILY_NOTIFICATION_LIMIT: "100",
      }),
    ).toContain(
      "ENABLE_REAL_NOTIFICATIONS=true is set without a low GLOBAL_DAILY_NOTIFICATION_LIMIT. Start real Discord testing with a low cap.",
    );
  });
});
