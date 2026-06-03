import pg from "pg";
import { loadServerEnv, safeLoadServerEnv } from "../config/env";

const { Pool } = pg;

declare global {
  var signalDeskPostgresPool: pg.Pool | undefined;
}

export type PostgresStatus = {
  provider: "postgres";
  configured: boolean;
  connectionTested: boolean;
  ok: boolean | null;
  error?: string;
};

export function sanitizePostgresError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .slice(0, 300);
}

export function getPostgresPool() {
  const env = loadServerEnv();
  if (env.DATABASE_PROVIDER !== "postgres" || !env.DATABASE_URL) {
    throw new Error("Postgres database is not configured.");
  }
  global.signalDeskPostgresPool ??= new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return global.signalDeskPostgresPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return getPostgresPool().query<T>(text, [...values]);
}

export async function getPostgresStatus(options: { testConnection?: boolean } = {}): Promise<PostgresStatus> {
  const env = safeLoadServerEnv(process.env);
  const configured = env.success && env.data.DATABASE_PROVIDER === "postgres" && Boolean(env.data.DATABASE_URL);

  if (!options.testConnection) {
    return {
      provider: "postgres",
      configured,
      connectionTested: false,
      ok: null,
    };
  }

  if (!configured) {
    return {
      provider: "postgres",
      configured: false,
      connectionTested: true,
      ok: false,
      error: "DATABASE_PROVIDER=postgres and DATABASE_URL are required before testing Postgres.",
    };
  }

  try {
    await query("SELECT 1");
    return {
      provider: "postgres",
      configured: true,
      connectionTested: true,
      ok: true,
    };
  } catch (error) {
    return {
      provider: "postgres",
      configured: true,
      connectionTested: true,
      ok: false,
      error: sanitizePostgresError(error),
    };
  }
}
