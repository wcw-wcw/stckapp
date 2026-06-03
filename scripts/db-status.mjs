import { getSafeConfigDiagnostics } from "../src/lib/config/env.ts";
import pg from "pg";

function sanitizePostgresError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .slice(0, 300);
}

async function testPostgresConnection() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  try {
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: sanitizePostgresError(error) };
  } finally {
    await pool.end();
  }
}

const shouldTestConnection = process.argv.includes("--test-connection");
const config = getSafeConfigDiagnostics();
const diagnostics = config.valid && config.databaseProvider === "postgres"
  ? {
      configuredProvider: "postgres",
      activeProvider: "postgres",
      usingLocalSqlite: false,
      postgresConfigComplete: config.postgresConfigComplete,
      databaseUrlPresent: config.databaseUrlPresent,
      repositoryAdapter: "postgres-pool",
      note: "Postgres is active through the async pooled repository adapter.",
      configValid: true,
      configErrors: [],
    }
  : {
      configuredProvider: config.databaseProvider,
      activeProvider: "sqlite",
      usingLocalSqlite: true,
      postgresConfigComplete: config.postgresConfigComplete,
      databaseUrlPresent: config.databaseUrlPresent,
      repositoryAdapter: "sqlite-sync",
      note: config.valid
        ? "SQLite is active for local-first development."
        : "Database configuration is invalid; fix the environment before switching providers.",
      configValid: config.valid,
      configErrors: config.errors,
    };

if (diagnostics.activeProvider === "postgres") {
  diagnostics.postgres = shouldTestConnection
    ? {
        provider: "postgres",
        configured: diagnostics.postgresConfigComplete,
        connectionTested: true,
        ...(await testPostgresConnection()),
      }
    : {
        provider: "postgres",
        configured: diagnostics.postgresConfigComplete,
        connectionTested: false,
        ok: null,
      };
}

console.log(JSON.stringify(diagnostics, null, 2));

if (!diagnostics.configValid) {
  process.exitCode = 1;
}
