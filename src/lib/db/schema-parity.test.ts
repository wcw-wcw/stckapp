import { describe, expect, it } from "vitest";
import { compareSchemaFiles } from "./schema-parity";

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
});
