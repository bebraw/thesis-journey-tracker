import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPlatformProxy, unstable_splitSqlQuery, type PlatformProxy } from "wrangler";
import { createAgentToken, authenticateAgent, revokeAgentToken, listAgentTokens } from "../src/agent/tokens";
import { collectStudentBackup } from "../src/backup/data";
import { handleMcp } from "../src/agent/mcp";
import { handleAgentAccess } from "../src/routes/agent-access";
import { getLoginAttempt, recordLoginFailure, revokeAuthUserSessions } from "../src/auth/store";
import { renameOwnAccount } from "../src/auth/username";
import { createManagedAccount, updateManagedAccount } from "../src/auth/access-management";
import { deleteAppSecret, getAppSecret, upsertAppSecret } from "../src/app-settings/store";
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
    const directory = join(process.cwd(), "migrations");
    const migrations = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of migrations) {
      for (const statement of unstable_splitSqlQuery(readFileSync(join(directory, file), "utf8"))) {
        await runStatement(platform.env.DB, statement);
      }
    }
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

    await runStatement(
      platform.env.DB,
      "INSERT INTO app_users (id,name,role,can_supervise,password_hash) VALUES (42,'Lead','editor',1,'sample')",
    );
    await platform.env.DB.prepare("INSERT INTO thesis_assignments VALUES (?,42,'supervisor')").bind(studentId).run();
    const backup = await collectStudentBackup(platform.env.DB);
    expect(backup.installationId).toMatch(/^[a-f0-9]{32}$/);
    expect(backup.bundles).toEqual([
      { student, logs, phaseAudit, assignments: [{ userId: 42, name: "Lead", role: "supervisor" }] },
    ]);
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
      upsertAppSecret(platform.env.DB, "dashboard_lane_config", "encrypted-v1", "2026-04-01T10:00:00.000Z"),
    ).resolves.toBeUndefined();
    await expect(
      upsertAppSecret(platform.env.DB, "dashboard_lane_config", "encrypted-v2", "2026-04-02T10:00:00.000Z"),
    ).resolves.toBeUndefined();

    await expect(getAppSecret(platform.env.DB, "dashboard_lane_config")).resolves.toEqual({
      secretKey: "dashboard_lane_config",
      encryptedValue: "encrypted-v2",
      updatedAt: "2026-04-02T10:00:00.000Z",
    });

    await expect(deleteAppSecret(platform.env.DB, "dashboard_lane_config")).resolves.toBeUndefined();
    await expect(deleteAppSecret(platform.env.DB, "dashboard_lane_config")).resolves.toBeUndefined();
    await expect(getAppSecret(platform.env.DB, "dashboard_lane_config")).resolves.toBeNull();
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
    await runStatement(
      platform.env.DB,
      "INSERT INTO app_users (id, name, password_hash, role, can_supervise) VALUES (1, 'Advisor', 'unused', 'editor', 1)",
    );
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
    const before = await rpc("tools/call", { name: "get_student", arguments: { studentId } });
    expect(await before.text()).toContain("Nghi Tran");
    await platform.env.DB.prepare("DELETE FROM thesis_assignments WHERE student_id = ?").bind(studentId).run();
    const after = await rpc("tools/call", { name: "get_student", arguments: { studentId } });
    expect(await after.text()).toContain("Student not found");
    const hiddenList = await rpc("tools/call", { name: "list_students", arguments: { search: "Nghi", includeArchived: true } });
    expect(await hiddenList.text()).not.toContain("Nghi Tran");
    const revokedEdit = await rpc("tools/call", { name: "update_student", arguments: { studentId, name: "Forbidden" } });
    expect(await revokedEdit.text()).toContain("Student not found");
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
    await runStatement(platform.env.DB, "UPDATE app_users SET disabled_at = CURRENT_TIMESTAMP WHERE id = 1");
    expect((await rpc("tools/list")).status).toBe(401);
  });

  it("enforces active thesis assignments on individual and compound writes in D1", async () => {
    const db = platform.env.DB;
    await runStatement(
      db,
      `INSERT INTO app_users (id, name, password_hash, role, is_admin, can_supervise) VALUES
      (1, 'First lead', '', 'editor', 0, 1), (2, 'Second lead', '', 'editor', 0, 1),
      (3, 'Advisor', '', 'editor', 0, 0), (4, 'Admin', '', 'editor', 1, 0)`,
    );
    const student = {
      name: "Assigned",
      degreeType: "msc" as const,
      currentPhase: "research_plan" as const,
      thesisTopic: null,
      email: null,
      studentNotes: null,
      nextMeetingAt: null,
      startDate: null,
    };
    const [assigned, other] = await Promise.all([createStudent(db, student, 1), createStudent(db, { ...student, name: "Other" }, 2)]);
    await db.prepare("INSERT INTO thesis_assignments (student_id, user_id, assignment_role) VALUES (?, 3, 'advisor')").bind(assigned).run();
    for (const userId of [1, 3]) {
      expect((await listStudents(db, { userId })).map((row) => row.id)).toEqual([assigned]);
      expect(await getStudentById(db, other, { userId, includeArchived: true })).toBeNull();
    }
    expect((await listStudents(db, { userId: 2 })).map((row) => row.id)).toEqual([other]);
    expect(await listStudents(db, { userId: 4 })).toEqual([]);
    await expect(createStudent(db, student, 3)).rejects.toThrow();
    expect(await listStudents(db)).toHaveLength(2);
    const note = {
      studentId: assigned,
      happenedAt: "2026-04-01T12:00:00.000Z",
      discussed: "Draft",
      agreedPlan: "Revise",
      nextStepDeadline: null,
    };
    const followUp = "2026-05-01T12:00:00.000Z";
    const update = { ...student, currentPhase: "editing" as const };
    const audit = { studentId: assigned, changedAt: note.happenedAt, fromPhase: student.currentPhase, toPhase: update.currentPhase };
    await updateStudentWithPhaseAudit(db, assigned, update, audit, 3);
    await createMeetingLogWithNextMeeting(db, note, followUp, false, 3);
    expect(await getStudentById(db, assigned, { userId: 1 })).toMatchObject({
      logCount: 1,
      nextMeetingAt: followUp,
      currentPhase: "editing",
    });
    expect(await listPhaseAuditEntriesForStudent(db, assigned, 1)).toHaveLength(1);
    expect(await listPhaseAuditEntriesForStudent(db, assigned, 2)).toEqual([]);
    expect(await listLogsForStudent(db, assigned, 2)).toEqual([]);
    await expect(archiveStudent(db, assigned, note.happenedAt, 3)).rejects.toThrow();
    await archiveStudent(db, assigned, note.happenedAt, 1);
    expect(await listStudents(db, { userId: 3 })).toEqual([]);
    expect((await listStudents(db, { userId: 3, onlyArchived: true })).map((row) => row.id)).toEqual([assigned]);
    await expect(createMeetingLogWithNextMeeting(db, note, null, true, 3)).rejects.toThrow();
    await expect(restoreStudent(db, assigned, 3)).rejects.toThrow();
    await restoreStudent(db, assigned, 1);
    await db.prepare("UPDATE app_users SET role = 'readonly' WHERE id = 3").run();
    expect(await getStudentById(db, assigned, { userId: 3 })).not.toBeNull();
    await expect(updateStudentWithPhaseAudit(db, assigned, student, audit, 3)).rejects.toThrow();
    await db.prepare("DELETE FROM thesis_assignments WHERE user_id = 3").run();
    await db.prepare("UPDATE app_users SET role = 'editor' WHERE id = 3").run();
    expect(await getStudentById(db, assigned, { userId: 3 })).toBeNull();
    await expect(createMeetingLogWithNextMeeting(db, note, null, true, 3)).rejects.toThrow();
    await expect(updateStudent(db, assigned, student, 3)).rejects.toThrow();
    expect(await getStudentById(db, assigned, { userId: 1 })).toMatchObject({
      logCount: 1,
      nextMeetingAt: followUp,
      currentPhase: "editing",
    });
    expect(await listPhaseAuditEntriesForStudent(db, assigned, 1)).toHaveLength(1);
  });

  it("keeps self-service and administrator name changes unique under concurrent Unicode-equivalent writes", async () => {
    const db = platform.env.DB;
    await runStatement(
      db,
      `INSERT INTO app_users (id, name, role, password_hash, is_admin, disabled_at) VALUES
      (1, 'Admin', 'editor', 'admin-hash', 1, NULL), (2, 'Advisor', 'readonly', 'advisor-hash', 0, NULL),
      (3, 'Päivi', 'readonly', 'disabled-hash', 0, '2026-11-01')`,
    );
    const admin = { id: 1, name: "Admin", sessionVersion: 1, role: "editor" as const, isAdmin: true };
    const advisor = { id: 2, name: "Advisor", sessionVersion: 1, role: "readonly" as const };
    const token = await createAgentToken(db, advisor, "Before rename", 30);
    const bearer = new Request("https://tracker.test/mcp", { headers: { authorization: `Bearer ${token}` } });
    expect(await renameOwnAccount(db, advisor, "Advisor", "PÄIVI")).toBeNull();
    expect(await renameOwnAccount(db, advisor, "Advisor", "ADVISOR")).toBe(2);
    expect(await authenticateAgent(bearer, db)).toMatchObject({ id: 2, name: "ADVISOR", role: "readonly", sessionVersion: 2 });
    const rights = { name: "ÄITI MÄKI", isAdmin: false, canSupervise: false, role: "readonly" as const };
    expect(await updateManagedAccount(db, admin, advisor.id, 1, rights)).toBe(false);
    const renamed = { ...advisor, name: "ADVISOR", sessionVersion: 2 };
    const results = await Promise.all([
      renameOwnAccount(db, renamed, "ADVISOR", "äiti mäki"),
      createManagedAccount(db, admin, rights, "new-hash"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const { results: rows } = await db.prepare("SELECT id, name FROM app_users").all<{ id: number; name: string }>();
    const holder = rows.filter((row) => row.name.toLocaleLowerCase() === "äiti mäki");
    expect(holder).toHaveLength(1);
    expect(await updateManagedAccount(db, admin, admin.id, 1, { ...rights, isAdmin: true })).toBe(false);
  });

  it("rejects session revocation for a missing user", async () => {
    await expect(revokeAuthUserSessions(platform.env.DB, 999_999)).rejects.toThrow("did not affect the expected database row");
  });
});

async function runStatement(db: globalThis.D1Database, sql: string): Promise<void> {
  await db.prepare(sql.trim()).run();
}
