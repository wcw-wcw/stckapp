import { describe, expect, it } from "vitest";
import { getDatabaseProviderDiagnostics, resolveDatabaseProviderMode } from "./provider";
import { getRepositoryProvider } from "./repositories";

describe("database provider resolution", () => {
  it("uses SQLite by default", () => {
    expect(resolveDatabaseProviderMode({})).toMatchObject({
      configuredProvider: "sqlite",
      activeProvider: "sqlite",
      usingLocalSqlite: true,
      repositoryAdapter: "sqlite-sync",
    });
  });

  it("selects Postgres when configured with DATABASE_URL", () => {
    expect(
      resolveDatabaseProviderMode({
        DATABASE_PROVIDER: "postgres",
        DATABASE_URL: "postgresql://user:password@example.test/signaldesk",
      }),
    ).toMatchObject({
      configuredProvider: "postgres",
      activeProvider: "postgres",
      usingLocalSqlite: false,
      postgresConfigComplete: true,
      repositoryAdapter: "postgres-pool",
    });
  });

  it("selects the repository adapter from provider config", () => {
    expect(getRepositoryProvider({})).toBe("sqlite-sync");
    expect(
      getRepositoryProvider({
        DATABASE_PROVIDER: "postgres",
        DATABASE_URL: "postgresql://user:password@example.test/signaldesk",
      }),
    ).toBe("postgres-pool");
  });

  it("keeps diagnostics sanitized", () => {
    const diagnostics = getDatabaseProviderDiagnostics({
      DATABASE_PROVIDER: "postgres",
      DATABASE_URL: "postgresql://user:password@example.test/signaldesk",
    });

    expect(diagnostics.databaseUrlPresent).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain("password");
    expect(JSON.stringify(diagnostics)).not.toContain("example.test");
  });
});
