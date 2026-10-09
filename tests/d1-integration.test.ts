import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { createAgentToken, authenticateAgent, revokeAgentToken, listAgentTokens } from "../src/agent/tokens";
import { handleMcp } from "../src/agent/mcp";
import { handleAgentAccess } from "../src/routes/agent-access";
import { getLoginAttempt, recordLoginFailure, revokeAuthUserSessions } from "../src/auth/store";
import { deleteAppSecret, getAppSecret, upsertAppSecret } from "../src/calendar/store";
import {
  archiveStudent,
  createMeetingLog,
  createMeetingLogWithNextMeeting,
  createPhaseAuditEntry,
  createStudent,
  getStudentById,
  listLogsForStudent,
  listPhaseAuditEntriesForStudent,
  listStudents,
  restoreStudent,
  updateStudent,
  updateStudentWithPhaseAudit,
} from "../src/students/store";

describe("D1-backed db helpers", () => {
  let platform: PlatformProxy<Env>;
  let persistPath = "";

  beforeAll(async () => {
    persistPath = mkdtempSync(join(tmpdir(), "thesis-d1-"));
    platform = await getPlatformProxy<Env>({
      configPath: join(process.cwd(), "wrangler.toml"),
      envFiles: [],
      persist: { path: persistPath },
      remoteBindings: false,
    });
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        start_date TEXT,
        current_phase TEXT NOT NULL CHECK (current_phase IN ('research_plan', 'researching', 'editing', 'submitted')),
        next_meeting_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        degree_type TEXT NOT NULL DEFAULT 'msc' CHECK (degree_type IN ('bsc', 'msc', 'dsc')),
        thesis_topic TEXT,
        student_notes TEXT,
        archived_at TEXT
      );
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS meeting_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        happened_at TEXT NOT NULL,
        discussed TEXT NOT NULL,
        agreed_plan TEXT NOT NULL,
        next_step_deadline TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS student_phase_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        changed_at TEXT NOT NULL,
        from_phase TEXT NOT NULL CHECK (from_phase IN ('research_plan', 'researching', 'editing', 'submitted')),
        to_phase TEXT NOT NULL CHECK (to_phase IN ('research_plan', 'researching', 'editing', 'submitted')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS login_attempts (
        attempt_key TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL DEFAULT 0,
        first_failed_at TEXT NOT NULL,
        last_failed_at TEXT NOT NULL,
        locked_until TEXT
      );
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS app_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('editor', 'readonly')),
        session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TRIGGER IF NOT EXISTS trg_app_users_updated_at
      AFTER UPDATE ON app_users
      FOR EACH ROW
      BEGIN
        UPDATE app_users
        SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = OLD.id;
      END;
    `,
    );
    await runStatement(
      platform.env.DB,
      `
      CREATE TABLE IF NOT EXISTS app_secrets (
        secret_key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    );
    for (const sql of readFileSync(join(process.cwd(), "migrations/0005_recurring_meetings_and_agent_tokens.sql"), "utf8")
      .split(";")
      .filter((part) => part.trim()))
      await runStatement(platform.env.DB, sql);
  }, 60_000);

  afterAll(async () => {
    if (platform) {
      await platform.dispose();
    }
    rmSync(persistPath, { force: true, recursive: true });
  }, 60_000);

  beforeEach(async () => {
    await runStatement(platform.env.DB, "DELETE FROM agent_tokens");
    await runStatement(platform.env.DB, "DELETE FROM student_phase_audit");
    await runStatement(platform.env.DB, "DELETE FROM meeting_logs");
    await runStatement(platform.env.DB, "DELETE FROM students");
    await runStatement(platform.env.DB, "DELETE FROM login_attempts");
    await runStatement(platform.env.DB, "DELETE FROM app_users");
    await runStatement(platform.env.DB, "DELETE FROM app_secrets");
  });

  it("reads aggregated student data from a local D1 binding", async () => {
    const studentId = await createStudent(platform.env.DB, {
      name: "D1 Student",
      email: "d1@example.edu",
      degreeType: "msc",
      thesisTopic: "Local D1 integration",
      studentNotes: "Uses the real D1 engine",
      startDate: "2026-01-15",
      currentPhase: "researching",
      nextMeetingAt: "2026-04-10T09:00:00.000Z",
    });

    await createMeetingLog(platform.env.DB, {
      studentId,
      happenedAt: "2026-03-22T09:00:00.000Z",
      discussed: "Integration test log",
      agreedPlan: "Verify D1 list ordering",
      nextStepDeadline: "2026-03-29",
    });

    await createPhaseAuditEntry(platform.env.DB, {
      studentId,
      changedAt: "2026-03-20T12:00:00.000Z",
      fromPhase: "research_plan",
      toPhase: "researching",
    });

    const students = await listStudents(platform.env.DB, { includeArchived: true });
    const student = students[0];
    const logs = await listLogsForStudent(platform.env.DB, studentId);
    const phaseAudit = await listPhaseAuditEntriesForStudent(platform.env.DB, studentId);

    expect(students).toHaveLength(1);
    expect(student?.name).toBe("D1 Student");
    expect(student?.logCount).toBe(1);
    expect(student?.lastLogAt).toBe("2026-03-22T09:00:00.000Z");
    expect(logs[0]?.discussed).toBe("Integration test log");
    expect(phaseAudit[0]?.toPhase).toBe("researching");
  });

  it("clears a saved next meeting when a meeting log has no follow-up time", async () => {
    const studentId = await createStudent(platform.env.DB, {
      name: "Unscheduled Follow-up Student",
      email: null,
      degreeType: "msc",
      thesisTopic: null,
      studentNotes: null,
      startDate: "2026-01-15",
      currentPhase: "researching",
      nextMeetingAt: "2026-04-10T09:00:00.000Z",
    });

    await createMeetingLogWithNextMeeting(
      platform.env.DB,
      {
        studentId,
        happenedAt: "2026-04-10T09:00:00.000Z",
        discussed: "Reviewed current draft",
        agreedPlan: "Continue revisions before scheduling the next meeting",
        nextStepDeadline: null,
      },
      null,
    );

    const student = await getStudentById(platform.env.DB, studentId);
    const logs = await listLogsForStudent(platform.env.DB, studentId);

    expect(logs).toHaveLength(1);
    expect(student?.nextMeetingAt).toBeNull();
  });

  it("rolls back the student update when the phase audit insert fails in a D1 batch", async () => {
    const studentId = await createStudent(platform.env.DB, {
      name: "Rollback Student",
      email: null,
      degreeType: "msc",
      thesisTopic: null,
      studentNotes: null,
      startDate: "2026-01-15",
      currentPhase: "researching",
      nextMeetingAt: null,
    });

    await expect(
      updateStudentWithPhaseAudit(
        platform.env.DB,
        studentId,
        {
          name: "Rollback Student",
          email: null,
          degreeType: "msc",
          thesisTopic: null,
          studentNotes: null,
          startDate: "2026-01-15",
          currentPhase: "editing",
          nextMeetingAt: null,
        },
        {
          studentId,
          changedAt: "2026-03-20T12:00:00.000Z",
          fromPhase: "researching",
          toPhase: "not-a-phase" as never,
        },
      ),
    ).rejects.toThrow();

    const student = await getStudentById(platform.env.DB, studentId, { includeArchived: true });
    const phaseAudit = await listPhaseAuditEntriesForStudent(platform.env.DB, studentId);

    expect(student?.currentPhase).toBe("researching");
    expect(phaseAudit).toHaveLength(0);
  });

  it("atomically records concurrent login failures", async () => {
    const now = "2026-03-24T09:00:00.000Z";
    await Promise.all(
      Array.from({ length: 5 }, () =>
        recordLoginFailure(platform.env.DB, "account:1", {
          now,
          failureWindowStart: "2026-03-24T08:45:00.000Z",
          maxFailures: 5,
          lockedUntil: "2026-03-24T09:15:00.000Z",
        }),
      ),
    );

    const attempt = await getLoginAttempt(platform.env.DB, "account:1");
    expect(attempt?.failureCount).toBe(5);
    expect(attempt?.lockedUntil).toBe("2026-03-24T09:15:00.000Z");
  });

  it("revokes sessions when the app user update trigger adds another D1 change", async () => {
    await runStatement(platform.env.DB, "INSERT INTO app_users (name, password_hash, role) VALUES ('D1 Advisor', 'unused', 'editor')");
    const user = await platform.env.DB.prepare("SELECT id, session_version FROM app_users WHERE name = ?")
      .bind("D1 Advisor")
      .first<{ id: number; session_version: number }>();

    expect(user).not.toBeNull();
    await expect(revokeAuthUserSessions(platform.env.DB, user!.id)).resolves.toBeUndefined();

    const updatedUser = await platform.env.DB.prepare("SELECT session_version FROM app_users WHERE id = ?")
      .bind(user!.id)
      .first<{ session_version: number }>();
    expect(updatedUser?.session_version).toBe(2);
  });

  it("validates returned student rows for creates, updates, and archives", async () => {
    const studentId = await createStudent(platform.env.DB, {
      name: "Mutation Student",
      email: "mutation@example.edu",
      degreeType: "msc",
      thesisTopic: "Mutation postconditions",
      studentNotes: null,
      startDate: "2026-01-15",
      currentPhase: "researching",
      nextMeetingAt: null,
    });

    expect(studentId).toBeGreaterThan(0);

    await expect(
      updateStudent(platform.env.DB, studentId, {
        name: "Updated Mutation Student",
        email: "mutation@example.edu",
        degreeType: "msc",
        thesisTopic: "Mutation postconditions",
        studentNotes: "Updated through RETURNING",
        startDate: "2026-01-15",
        currentPhase: "editing",
        nextMeetingAt: null,
      }),
    ).resolves.toBeUndefined();

    await expect(archiveStudent(platform.env.DB, studentId, "2026-04-01T10:00:00.000Z")).resolves.toBeUndefined();
    const student = await getStudentById(platform.env.DB, studentId, { includeArchived: true });
    expect(student?.name).toBe("Updated Mutation Student");
    expect(student?.archivedAt).toBe("2026-04-01T10:00:00.000Z");

    await expect(restoreStudent(platform.env.DB, studentId)).resolves.toBeUndefined();
    const restoredStudent = await getStudentById(platform.env.DB, studentId);
    expect(restoredStudent?.archivedAt).toBeNull();

    await expect(
      updateStudent(platform.env.DB, 999_999, {
        name: "Missing Student",
        email: null,
        degreeType: "msc",
        thesisTopic: null,
        studentNotes: null,
        startDate: null,
        currentPhase: "research_plan",
        nextMeetingAt: null,
      }),
    ).rejects.toThrow("did not affect the expected database row");
    await expect(archiveStudent(platform.env.DB, 999_999, "2026-04-01T10:00:00.000Z")).rejects.toThrow(
      "did not affect the expected database row",
    );
    await expect(restoreStudent(platform.env.DB, 999_999)).rejects.toThrow("did not affect the expected database row");
  });

  it("validates application secret upserts while keeping deletion idempotent", async () => {
    await expect(
      upsertAppSecret(platform.env.DB, "calendar_refresh_token", "encrypted-v1", "2026-04-01T10:00:00.000Z"),
    ).resolves.toBeUndefined();
    await expect(
      upsertAppSecret(platform.env.DB, "calendar_refresh_token", "encrypted-v2", "2026-04-02T10:00:00.000Z"),
    ).resolves.toBeUndefined();

    await expect(getAppSecret(platform.env.DB, "calendar_refresh_token")).resolves.toEqual({
      secretKey: "calendar_refresh_token",
      encryptedValue: "encrypted-v2",
      updatedAt: "2026-04-02T10:00:00.000Z",
    });

    await expect(deleteAppSecret(platform.env.DB, "calendar_refresh_token")).resolves.toBeUndefined();
    await expect(deleteAppSecret(platform.env.DB, "calendar_refresh_token")).resolves.toBeUndefined();
    await expect(getAppSecret(platform.env.DB, "calendar_refresh_token")).resolves.toBeNull();
  });

  it("issues hashed, expiring tokens and limits revocation to the owning account", async () => {
    await runStatement(
      platform.env.DB,
      "INSERT INTO app_users (id, name, password_hash, role) VALUES (1, 'Advisor', 'unused', 'editor'), (2, 'Professor', 'unused', 'readonly')",
    );
    const user = { id: 2, name: "Professor", role: "readonly" as const, sessionVersion: 1 };
    const secret = await createAgentToken(platform.env.DB, user, "Codex", 30);
    const request = new Request("https://tracker.example/mcp", { headers: { Authorization: `Bearer ${secret}` } });
    expect(await authenticateAgent(request, platform.env.DB)).toMatchObject({ id: 2, role: "readonly" });
    const stored = await platform.env.DB.prepare("SELECT token_hash FROM agent_tokens WHERE user_id = 2").first<{ token_hash: string }>();
    expect(stored?.token_hash).not.toContain(secret);
    expect(stored?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    const token = (await listAgentTokens(platform.env.DB, 2))[0]!;
    await revokeAgentToken(platform.env.DB, 1, token.id);
    expect(await authenticateAgent(request, platform.env.DB)).not.toBeNull();
    await platform.env.DB.prepare("UPDATE agent_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").bind(token.id).run();
    expect(await authenticateAgent(request, platform.env.DB)).toBeNull();
    await platform.env.DB.prepare("UPDATE agent_tokens SET expires_at = '2099-01-01T00:00:00.000Z' WHERE id = ?").bind(token.id).run();
    await revokeAgentToken(platform.env.DB, 2, token.id);
    expect(await authenticateAgent(request, platform.env.DB)).toBeNull();
  });

  it("serves professor setup and enforces readonly MCP access, including after role changes", async () => {
    await runStatement(platform.env.DB, "INSERT INTO app_users (id, name, password_hash, role) VALUES (1, 'Advisor', 'unused', 'editor')");
    const user = { id: 1, name: "Advisor", role: "editor" as const, sessionVersion: 1 };
    const env = { DB: platform.env.DB };
    const secret = await createAgentToken(platform.env.DB, user, "Codex", 30);
    const rpc = (method: string, params: unknown = {}, extraHeaders = {}) =>
      handleMcp(
        new Request("https://tracker.example/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            authorization: `Bearer ${secret}`,
            ...extraHeaders,
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
        env,
      );
    const created = (await (await rpc("tools/call", { name: "create_student", arguments: { name: "Nghi Tran" } })).json()) as {
      result: { content: Array<{ text: string }> };
    };
    const studentId = JSON.parse(created.result.content[0]!.text).id;
    await rpc("tools/call", {
      name: "set_meeting_schedule",
      arguments: { studentId, schedule: { startLocal: "2026-10-16T14:00", timeZone: "Europe/Helsinki", intervalWeeks: 1 } },
    });
    expect(await getStudentById(platform.env.DB, studentId)).toMatchObject({ nextMeetingAt: "2026-10-16T11:00:00.000Z" });
    const invalid = (await (
      await rpc("tools/call", { name: "update_student", arguments: { studentId, currentPhase: "wrong", name: "Overwrite" } })
    ).json()) as { result: { isError: boolean } };
    expect(invalid.result.isError).toBe(true);
    expect((await getStudentById(platform.env.DB, studentId))?.name).toBe("Nghi Tran");
    await runStatement(platform.env.DB, "UPDATE app_users SET role = 'readonly' WHERE id = 1");
    const listing = (await (await rpc("tools/list")).json()) as { result: { tools: Array<{ name: string }> } };
    expect(listing.result.tools.map((tool) => tool.name)).toEqual(["list_students", "get_student"]);
    const denied = (await (await rpc("tools/call", { name: "update_student", arguments: { studentId, name: "Forbidden" } })).json()) as {
      result: { isError: boolean };
    };
    expect(denied.result.isError).toBe(true);
    expect((await getStudentById(platform.env.DB, studentId))?.name).toBe("Nghi Tran");
    expect((await rpc("tools/list", {}, { origin: "https://attacker.example" })).status).toBe(403);
    expect((await handleMcp(new Request("https://tracker.example/mcp"), env)).status).toBe(401);
    const setup = await handleAgentAccess(new Request("https://tracker.example/agent-access"), env, { ...user, role: "readonly" });
    expect(await setup.text()).toContain("Create token and show setup");
    const issued = await handleAgentAccess(
      new Request("https://tracker.example/agent-access", {
        method: "POST",
        body: new URLSearchParams({ name: "Professor Codex", days: "90" }),
      }),
      env,
      { ...user, role: "readonly" },
    );
    const html = await issued.text();
    expect(html).toContain("mcp_servers.thesis_tracker");
    expect(html).toContain("tjt_");
    expect(html).toContain("Read-only:");
    const revisited = await handleAgentAccess(new Request("https://tracker.example/agent-access"), env, { ...user, role: "readonly" });
    expect(await revisited.text()).not.toContain("tjt_");
  });

  it("rejects session revocation for a missing user", async () => {
    await expect(revokeAuthUserSessions(platform.env.DB, 999_999)).rejects.toThrow("did not affect the expected database row");
  });
});

async function runStatement(db: globalThis.D1Database, sql: string): Promise<void> {
  await db.prepare(sql.trim()).run();
}
