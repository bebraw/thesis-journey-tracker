import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MockD1Database } from "../tests/helpers/mock-d1.ts";
import { usernameDirectorySql } from "../src/auth/username.ts";
import {
  buildCreateSql,
  buildPasswordResetSql,
  createPasswordHash,
  executeWranglerSql,
  parseArgs,
  validatePassword,
} from "./create-auth-user.mjs";

describe("account provisioning", () => {
  it("requires long passwords and rejects plaintext password arguments", () => {
    expect(() => validatePassword("too-short")).toThrow("at least 15 characters");
    expect(() => validatePassword("long-enough-password")).not.toThrow();
    expect(() => parseArgs(["--password", "visible-secret"])).toThrow("Unknown argument: --password");
    expect(() => parseArgs(["--iterations", "1"])).toThrow("Unknown argument: --iterations");
  });

  it("creates a fixed-work-factor verifier and checks names before creating a new account", () => {
    const passwordHash = createPasswordHash("long-enough-password");
    expect(passwordHash).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(passwordHash).not.toContain("long-enough-password");

    const db = new MockD1Database().sqlite;
    const directory = () => db.prepare(`SELECT ${usernameDirectorySql} AS directory`).get().directory;
    const create = (name) => buildCreateSql({ name, role: "editor" }, passwordHash, directory());
    const stale = create("väinö");
    db.exec(create("Väinö"));
    const original = db.prepare("SELECT * FROM app_users").all();
    expect(() => create("Väinö")).toThrow("already in use");
    expect(() => create("VÄINÖ")).toThrow("already in use");
    expect(() => db.exec(stale)).toThrow();
    expect(db.prepare("SELECT * FROM app_users").all()).toEqual(original);
    db.close();
  });

  it("resets credentials by verified ID after a rename and preserves the replacement login and role flags", () => {
    const db = new MockD1Database().sqlite;
    db.exec(`INSERT INTO app_users (id, name, role, password_hash, is_admin, can_supervise) VALUES (4, 'Advisor', 'editor', 'original', 1, 1);
      INSERT INTO thesis_assignments VALUES (1, 4, 'supervisor');
      INSERT INTO agent_tokens (id, user_id, name, token_hash, expires_at) VALUES ('token', 4, 'Agent', 'hash', '2030-01-01');
      UPDATE app_users SET name = 'Supervisor', session_version = session_version + 1 WHERE id = 4;
      INSERT INTO app_users (id, name, role, password_hash) VALUES (5, 'Advisor', 'readonly', 'replacement');`);
    const args = parseArgs(["reset-password", "--id", "4"]);
    expect(db.prepare(buildPasswordResetSql(args.id, "reset")).all()).toEqual([{ id: 4 }]);
    expect(
      db.prepare("SELECT id, role, name, is_admin, can_supervise, session_version, password_hash FROM app_users ORDER BY id").all(),
    ).toEqual([
      { id: 4, role: "editor", name: "Supervisor", is_admin: 1, can_supervise: 1, session_version: 3, password_hash: "reset" },
      { id: 5, role: "readonly", name: "Advisor", is_admin: 0, can_supervise: 0, session_version: 1, password_hash: "replacement" },
    ]);
    expect(db.prepare("SELECT user_id FROM thesis_assignments").all()).toEqual([{ user_id: 4 }]);
    expect(db.prepare("SELECT revoked_at FROM agent_tokens").get().revoked_at).toBeTruthy();
    expect(db.prepare(buildPasswordResetSql(77, "unapplied")).all()).toEqual([]);
    expect(() => parseArgs(["reset-password", "--name", "Advisor"])).toThrow("verified numeric account ID");
    expect(() => parseArgs(["reset-password", "--id", "4", "--role", "editor"])).toThrow("Omit --name and --role");
    expect(() => parseArgs(["reset-password", "--id", "1.5"])).toThrow("verified numeric account ID");
    db.close();
  });

  it("passes only a mode-0600 SQL file to Wrangler and removes it afterward", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "thesis-auth-test-"));
    let sqlPath = "";
    const passwordHash = createPasswordHash("long-enough-password");
    const sql = buildPasswordResetSql(4, passwordHash);

    try {
      executeWranglerSql(
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
            return { status: 0, stdout: JSON.stringify([{ success: true, results: [{}], meta: { rows_written: 2 } }]) };
          },
        },
      );

      expect(existsSync(sqlPath)).toBe(false);
      for (const remote of [false, true]) {
        const result = remote ? { results: [{}], meta: { rows_written: 0 } } : { results: [] };
        const spawn = () => ({ status: 0, stdout: JSON.stringify([{ ...result, success: true }]) });
        expect(() => executeWranglerSql(sql, { remote }, { tempRoot, spawn })).toThrow("No account was updated");
      }
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
