import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareSchemaFiles, parseSchemaTables } from "./schema-parity";

describe("SQLite and Postgres schema parity", () => {
  it("keeps app table and column sets aligned", () => {
    const result = compareSchemaFiles("db/local-schema.sql", "db/migrations/001_initial.sql");

    expect(result).toEqual({
      ok: true,
      localOnlyTables: [],
      postgresOnlyTables: [],
      columnMismatches: [],
    });
  });

  it("tracks saved symbol levels in both schemas", () => {
    const localTables = parseSchemaTables(readFileSync("db/local-schema.sql", "utf8"));
    const postgresTables = parseSchemaTables(readFileSync("db/migrations/001_initial.sql", "utf8"));

    expect(localTables.get("symbol_levels")).toEqual([
      "created_at",
      "expires_at",
      "id",
      "level_type",
      "name",
      "notes",
      "price",
      "symbol",
      "updated_at",
      "user_id",
    ]);
    expect(postgresTables.get("symbol_levels")).toEqual(localTables.get("symbol_levels"));
  });
});
