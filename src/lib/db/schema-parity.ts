import { readFileSync } from "node:fs";

export type SchemaTable = {
  name: string;
  columns: string[];
};

export type SchemaParityResult = {
  ok: boolean;
  localOnlyTables: string[];
  postgresOnlyTables: string[];
  columnMismatches: Array<{
    table: string;
    localOnlyColumns: string[];
    postgresOnlyColumns: string[];
  }>;
};

const tablePattern = /CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_]+)\s*\(([\s\S]*?)\);/gi;
const tableConstraintPrefixes = new Set(["primary", "foreign", "unique", "check", "constraint"]);

function splitColumnLines(body: string) {
  const lines: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) lines.push(current);
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function parseSchemaTables(sql: string) {
  const tables = new Map<string, string[]>();
  for (const match of sql.matchAll(tablePattern)) {
    const name = match[1];
    const columns = splitColumnLines(match[2])
      .map((line) => line.replace(/^"|"$/g, "").split(/\s+/)[0].replace(/"/g, "").toLowerCase())
      .filter((column) => !tableConstraintPrefixes.has(column))
      .sort();
    tables.set(name, columns);
  }
  return tables;
}

const difference = (left: string[], right: string[]) => left.filter((item) => !right.includes(item));

export function compareSchemaParity(localSql: string, postgresSql: string): SchemaParityResult {
  const localTables = parseSchemaTables(localSql);
  const postgresTables = parseSchemaTables(postgresSql);
  const localTableNames = [...localTables.keys()].sort();
  const postgresTableNames = [...postgresTables.keys()].sort();
  const sharedTables = localTableNames.filter((table) => postgresTables.has(table));
  const columnMismatches = sharedTables
    .map((table) => {
      const localColumns = localTables.get(table) ?? [];
      const postgresColumns = postgresTables.get(table) ?? [];
      return {
        table,
        localOnlyColumns: difference(localColumns, postgresColumns),
        postgresOnlyColumns: difference(postgresColumns, localColumns),
      };
    })
    .filter((item) => item.localOnlyColumns.length > 0 || item.postgresOnlyColumns.length > 0);

  const localOnlyTables = difference(localTableNames, postgresTableNames);
  const postgresOnlyTables = difference(postgresTableNames, localTableNames);

  return {
    ok: localOnlyTables.length === 0 && postgresOnlyTables.length === 0 && columnMismatches.length === 0,
    localOnlyTables,
    postgresOnlyTables,
    columnMismatches,
  };
}

export function compareSchemaFiles(localSchemaPath: string, postgresMigrationPath: string) {
  return compareSchemaParity(
    readFileSync(localSchemaPath, "utf8"),
    readFileSync(postgresMigrationPath, "utf8"),
  );
}
