import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("postgres migration script safety", () => {
  it("refuses to run unless DATABASE_PROVIDER=postgres", () => {
    const env = {
      ...process.env,
      DATABASE_PROVIDER: "sqlite",
      DATABASE_URL: "postgresql://user:secret@example.test/signaldesk",
    };

    let stderr = "";
    try {
      execFileSync(
        "node",
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          "scripts/db-migrate-postgres.mjs",
          "--dry-run",
        ],
        { cwd: process.cwd(), env, encoding: "utf8", stdio: "pipe" },
      );
      throw new Error("Migration script unexpectedly succeeded.");
    } catch (error) {
      stderr = String((error as { stderr?: Buffer | string }).stderr ?? "");
    }

    expect(stderr).toContain("DATABASE_PROVIDER=postgres");
    expect(stderr).not.toContain("secret");
    expect(stderr).not.toContain("example.test");
  });
});
