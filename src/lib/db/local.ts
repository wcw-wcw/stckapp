import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { assertSqliteRepositoryProvider } from "./provider";

const databasePath = join(process.cwd(), "data", "signaldesk.sqlite");
const schemaPath = join(process.cwd(), "db", "local-schema.sql");

declare global {
  var signalDeskDb: DatabaseSync | undefined;
}

function openDatabase() {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(readFileSync(schemaPath, "utf8"));
  ensureLocalSchemaUpgrades(database);
  return database;
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

function ensureLocalSchemaUpgrades(database: DatabaseSync) {
  ensureColumn(database, "market_worker_status", "worker_id", "TEXT");
  ensureColumn(database, "market_worker_status", "worker_name", "TEXT");
  ensureColumn(database, "market_worker_status", "runtime_mode", "TEXT NOT NULL DEFAULT 'in-process'");
  ensureColumn(database, "market_worker_status", "heartbeat_at", "TEXT");
  ensureColumn(database, "market_worker_status", "last_tick_at", "TEXT");
  ensureColumn(database, "market_worker_status", "last_candle_at", "TEXT");
  ensureColumn(database, "market_worker_status", "symbols_evaluated", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "rules_evaluated", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "triggers_created", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "cooldown_skips", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "provider_errors", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "notification_attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "is_running", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "market_worker_status", "next_retry_at", "TEXT");
  database.exec(
    "CREATE INDEX IF NOT EXISTS alert_events_rule_candle_idx ON alert_events (rule_id, triggered_at);",
  );
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      notifications_paused INTEGER NOT NULL DEFAULT 0 CHECK (notifications_paused IN (0, 1)),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS provider_error_logs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      symbol TEXT,
      context TEXT NOT NULL,
      status_code INTEGER,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS provider_error_logs_created_idx
      ON provider_error_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS provider_error_logs_symbol_created_idx
      ON provider_error_logs (symbol, created_at DESC);
    CREATE TABLE IF NOT EXISTS symbol_levels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL REFERENCES supported_symbols(symbol),
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK (price > 0),
      level_type TEXT NOT NULL CHECK (level_type IN ('support', 'resistance', 'watch', 'other')),
      notes TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS symbol_levels_user_symbol_idx
      ON symbol_levels (user_id, symbol, created_at DESC);
  `);
}

export function getDatabase() {
  assertSqliteRepositoryProvider();
  if (!existsSync(schemaPath)) {
    throw new Error("Local database schema is missing.");
  }
  global.signalDeskDb ??= openDatabase();
  return global.signalDeskDb;
}
