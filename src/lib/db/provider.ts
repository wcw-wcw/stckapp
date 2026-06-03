import {
  getSafeConfigDiagnostics,
  loadServerEnv,
  type DatabaseProvider,
  type RawServerEnv,
} from "../config/env";

export type DatabaseProviderMode = {
  configuredProvider: DatabaseProvider;
  activeProvider: DatabaseProvider;
  usingLocalSqlite: boolean;
  postgresConfigComplete: boolean;
  databaseUrlPresent: boolean;
  repositoryAdapter: RepositoryAdapterName;
  note: string;
};

export type RepositoryAdapterName = "sqlite-sync" | "postgres-pool";

export function resolveDatabaseProviderMode(
  env: RawServerEnv = process.env,
): DatabaseProviderMode {
  const config = loadServerEnv(env);
  const postgresConfigComplete = config.DATABASE_PROVIDER === "postgres" && Boolean(config.DATABASE_URL);

  if (config.DATABASE_PROVIDER === "postgres") {
    return {
      configuredProvider: "postgres",
      activeProvider: "postgres",
      usingLocalSqlite: false,
      postgresConfigComplete,
      databaseUrlPresent: Boolean(config.DATABASE_URL),
      repositoryAdapter: "postgres-pool",
      note: "Postgres is active through the async pooled repository adapter.",
    };
  }

  return {
    configuredProvider: "sqlite",
    activeProvider: "sqlite",
    usingLocalSqlite: true,
    postgresConfigComplete: false,
    databaseUrlPresent: Boolean(config.DATABASE_URL),
    repositoryAdapter: "sqlite-sync",
    note: "SQLite is active for local-first development.",
  };
}

export function getDatabaseProviderDiagnostics(env: RawServerEnv = process.env) {
  const config = getSafeConfigDiagnostics(env);
  if (!config.valid) {
    return {
      configuredProvider: config.databaseProvider,
      activeProvider: "sqlite" as const,
      usingLocalSqlite: true,
      postgresConfigComplete: config.postgresConfigComplete,
      databaseUrlPresent: config.databaseUrlPresent,
      repositoryAdapter: "sqlite-sync" as const,
      note: "Database configuration is invalid; fix the environment before switching providers.",
      configValid: false,
      configErrors: config.errors,
    };
  }

  return {
    ...resolveDatabaseProviderMode(env),
    configValid: true,
    configErrors: [] as string[],
  };
}

export function assertSqliteRepositoryProvider(env: RawServerEnv = process.env) {
  const mode = resolveDatabaseProviderMode(env);
  if (mode.configuredProvider !== "sqlite") {
    throw new Error(
      "DATABASE_PROVIDER=postgres is configured. Use the async repository facade instead of the direct SQLite database module.",
    );
  }
  return mode;
}
