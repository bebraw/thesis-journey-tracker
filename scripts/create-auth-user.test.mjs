import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildUpsertSql, createPasswordHash, executeWranglerSql, parseArgs, validatePassword } from "./create-auth-user.mjs";

describe("account provisioning", () => {
  it("requires long passwords and rejects plaintext password arguments", () => {
    expect(() => validatePassword("too-short")).toThrow("at least 15 characters");
    expect(() => validatePassword("long-enough-password")).not.toThrow();
    expect(() => parseArgs(["--password", "visible-secret"])).toThrow("Unknown argument: --password");
    expect(() => parseArgs(["--iterations", "1"])).toThrow("Unknown argument: --iterations");
  });

  it("creates a fixed-work-factor verifier and revokes existing sessions on update", () => {
    const passwordHash = createPasswordHash("long-enough-password");
    expect(passwordHash).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(passwordHash).not.toContain("long-enough-password");

    const sql = buildUpsertSql({ name: "Advisor", passwordHash, role: "editor" });
    expect(sql).toContain("session_version = app_users.session_version + 1");
  });

  it("passes only a mode-0600 SQL file to Wrangler and removes it afterward", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "thesis-auth-test-"));
    let sqlPath = "";
    const passwordHash = createPasswordHash("long-enough-password");
    const sql = buildUpsertSql({ name: "Advisor", passwordHash, role: "editor" });

    try {
      const status = executeWranglerSql(
        sql,
        { remote: true, database: "test-db" },
        {
          tempRoot,
          spawn: (_command, args) => {
            expect(args.join(" ")).not.toContain(passwordHash);
            expect(args).not.toContain("--command");
            sqlPath = args[args.indexOf("--file") + 1];
            expect(readFileSync(sqlPath, "utf8")).toContain(passwordHash);
            if (process.platform !== "win32") {
              expect(statSync(sqlPath).mode & 0o777).toBe(0o600);
            }
            return { status: 0 };
          },
        },
      );

      expect(status).toBe(0);
      expect(existsSync(sqlPath)).toBe(false);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
