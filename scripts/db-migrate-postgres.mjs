import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadServerEnv } from "../src/lib/config/env.ts";

const dryRun = process.argv.includes("--dry-run");
const migrationArg = process.argv.find((arg) => arg.startsWith("--migration="));
const migrationName = migrationArg?.split("=").at(1) ?? "001_initial.sql";
const allowedMigrations = new Set(["001_initial.sql", "002_symbol_levels.sql"]);
const migrationPath = join(process.cwd(), "db", "migrations", migrationName);

if (!allowedMigrations.has(migrationName)) {
  throw new Error("Choose a known migration: 001_initial.sql or 002_symbol_levels.sql.");
}

function sanitizePostgresError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .slice(0, 300);
}

export function validatePostgresMigrationConfig(env = process.env) {
  const config = loadServerEnv(env);
  if (config.DATABASE_PROVIDER !== "postgres") {
    throw new Error("Refusing to run Postgres migration unless DATABASE_PROVIDER=postgres.");
  }
  if (!config.DATABASE_URL) {
    throw new Error("Refusing to run Postgres migration without DATABASE_URL.");
  }
  return config;
}

async function main() {
  const config = validatePostgresMigrationConfig();
  const sql = readFileSync(migrationPath, "utf8");

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      migration: `db/migrations/${migrationName}`,
      databaseProvider: "postgres",
      databaseUrlPresent: true,
      note: "Dry run only. No database connection was opened and no SQL was applied.",
    }, null, 2));
    return;
  }

  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await pool.query(sql);
    console.log(JSON.stringify({
      ok: true,
      dryRun: false,
      migration: `db/migrations/${migrationName}`,
      databaseProvider: "postgres",
      databaseUrlPresent: true,
      note: "Postgres migration applied.",
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      migration: `db/migrations/${migrationName}`,
      databaseProvider: "postgres",
      databaseUrlPresent: true,
      error: sanitizePostgresError(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: sanitizePostgresError(error),
    }, null, 2));
    process.exitCode = 1;
  });
}
