import { compareSchemaFiles } from "../src/lib/db/schema-parity.ts";

const result = compareSchemaFiles("db/local-schema.sql", "db/migrations/001_initial.sql");

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
