import { beforeEach, describe, expect, it } from "vitest";
import { MockD1Database } from "../../tests/helpers/mock-d1";
import type { SessionUser } from "../auth";
import { authenticateAgent, createAgentToken } from "../agent/tokens";
import { resolveAuthState, resolveSessionUser } from "../auth/state";
import { handleAccessManagement } from "./access-management";

describe("managing access", () => {
  let db: MockD1Database;
  const admin = { id: 1, name: "Admin", role: "readonly", sessionVersion: 1, isAdmin: true } satisfies SessionUser;
  const lead = { id: 2, name: "Lead", role: "editor", sessionVersion: 1, canSupervise: true } satisfies SessionUser;
  const advisor = { id: 3, name: "Reader", role: "readonly", sessionVersion: 1 } satisfies SessionUser;
  function post(user: SessionUser, action: string, params: Record<string, string>) {
    return handleAccessManagement(
      new Request("https://test/access", { method: "POST", body: new URLSearchParams({ action, ...params }) }),
      { DB: db },
      user,
    );
  }
  function get(user: SessionUser, studentId?: number) {
    return handleAccessManagement(new Request(`https://test/access${studentId ? `?studentId=${studentId}` : ""}`), { DB: db }, user);
  }
  const saved = (response: Response) => new URL(response.headers.get("location")!, "https://test").searchParams.has("notice");
  beforeEach(() => {
    db = new MockD1Database();
    db.sqlite.exec(`
      INSERT INTO app_users (id, name, role, password_hash, is_admin, can_supervise) VALUES
        (1, 'Admin', 'readonly', 'hash', 1, 0), (2, 'Lead', 'editor', 'hash', 0, 1),
        (3, 'Reader', 'readonly', 'hash', 0, 0), (4, 'Second lead', 'editor', 'hash', 0, 1);
      INSERT INTO students (id,name,current_phase,archived_at) VALUES (4,'Other archive','submitted','2026-11-17');
      INSERT INTO thesis_assignments VALUES (1,2,'supervisor');
    `);
  });

  it("lets supervisors manage only their own teams and gives administrators a directory without credentials", async () => {
    expect((await get(advisor)).status).toBe(403);
    expect((await get(lead, 4)).status).toBe(404);
    const html = await (await get(lead, 1)).text();
    expect(html).toContain("Advisor to add");
    expect(html).not.toContain("Create an account");
    expect(html).not.toContain("Other archive");
    const directory = await (await get(admin)).text();
    expect(directory).toContain("Other archive");
    expect(directory).toContain("Create an account");
    expect(directory).not.toContain("password_hash");
    expect(saved(await post(lead, "add-advisor", { accountId: "3", studentId: "1" }))).toBe(true);
    expect(saved(await post(lead, "remove-advisor", { accountId: "3", studentId: "4" }))).toBe(false);
    expect((await post(lead, "disable-account", { accountId: "3", version: "1" })).status).toBe(403);
  });

  it("rechecks lead eligibility, preserves the old team on stale transfers, and handles promotion of a current advisor", async () => {
    expect(saved(await post(admin, "assign-unowned", { accountId: "3", studentId: "4" }))).toBe(false);
    const staleSelection = new URLSearchParams([
      ["action", "assign-unowned"],
      ["accountId", "2"],
      ["studentId", "4"],
      ["studentId", "1"],
    ]);
    expect(
      saved(await handleAccessManagement(new Request("https://test/access", { method: "POST", body: staleSelection }), { DB: db }, admin)),
    ).toBe(false);
    expect(saved(await post(admin, "assign-unowned", { accountId: "2", studentId: "4" }))).toBe(true);
    expect(saved(await post(lead, "add-advisor", { accountId: "4", studentId: "4" }))).toBe(true);
    expect(saved(await post(admin, "transfer", { accountId: "4", previousLead: "3", studentId: "4" }))).toBe(false);
    expect(saved(await post(admin, "transfer", { accountId: "4", previousLead: "2", studentId: "4" }))).toBe(true);
    expect(db.sqlite.prepare("SELECT user_id, assignment_role FROM thesis_assignments WHERE student_id=4").all()).toEqual([
      { user_id: 4, assignment_role: "supervisor" },
    ]);
    expect(saved(await post(lead, "add-advisor", { accountId: "3", studentId: "4" }))).toBe(false);
  });

  it("protects the last admin, all supervised theses, and concurrent changes, and keeps old access revoked after enabling an account", async () => {
    expect(saved(await post(admin, "disable-account", { accountId: "1", version: "1" }))).toBe(false);
    expect(saved(await post(admin, "update-account", { accountId: "1", version: "1", name: "Admin", role: "readonly" }))).toBe(false);
    expect(saved(await post(admin, "disable-account", { accountId: "2", version: "1" }))).toBe(false);
    expect(saved(await post(admin, "update-account", { accountId: "2", version: "1", name: "Lead", role: "readonly" }))).toBe(false);
    const token = await createAgentToken(db, advisor, "Reader token", 30);
    const bearer = new Request("https://test/mcp", { headers: { Authorization: `Bearer ${token}` } });
    expect(await authenticateAgent(bearer, db)).toMatchObject({ id: 3 });
    expect(saved(await post(lead, "add-advisor", { accountId: "3", studentId: "1" }))).toBe(true);
    expect(saved(await post(admin, "disable-account", { accountId: "3", version: "1" }))).toBe(true);
    expect(resolveSessionUser(await resolveAuthState({ DB: db }), { userId: 3, sessionVersion: 1 })).toBeNull();
    expect(saved(await post(admin, "enable-account", { accountId: "3", version: "1" }))).toBe(false);
    expect(saved(await post(admin, "enable-account", { accountId: "3", version: "2" }))).toBe(true);
    expect(await authenticateAgent(bearer, db)).toBeNull();
    expect(db.sqlite.prepare("SELECT 1 FROM thesis_assignments WHERE user_id=3").all()).toEqual([]);
  });

  it("creates named accounts without overwriting existing credentials and resets passwords independently of rights", async () => {
    const payload = { name: "New advisor", role: "editor", password: "test-account-password" };
    expect(saved(await post(admin, "create-account", payload))).toBe(true);
    const account = db.appUsers.find((entry) => entry.name === payload.name)!;
    expect(account).toMatchObject({ role: "editor", can_supervise: 0, is_admin: 0 });
    expect(saved(await post(admin, "create-account", { ...payload, password: "different-new-password" }))).toBe(false);
    expect(db.appUsers.find((entry) => entry.id === account.id)?.password_hash).toBe(account.password_hash);
    expect(
      saved(await post(admin, "update-account", { accountId: String(account.id), version: "1", name: "Renamed", role: "supervisor" })),
    ).toBe(true);
    expect(
      saved(await post(admin, "reset-password", { accountId: String(account.id), version: "2", password: "updated-fresh-password" })),
    ).toBe(true);
    const updated = db.appUsers.find((entry) => entry.id === account.id)!;
    expect(updated).toMatchObject({ name: "Renamed", role: "editor", can_supervise: 1, is_admin: 0, session_version: 3 });
    expect(updated.password_hash).not.toBe(account.password_hash);
  });

  it("deletes a disabled account with its credentials and advisor grants while preserving student records and other users", async () => {
    const oldToken = await createAgentToken(db, advisor, "Reader token", 30);
    const leadToken = await createAgentToken(db, lead, "Lead token", 30);
    const bearer = (token: string) => new Request("https://test/mcp", { headers: { Authorization: `Bearer ${token}` } });
    db.sqlite.exec(`
      INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan) VALUES (4, '2026-11-14', 'Draft', 'Revise chapter');
      INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase) VALUES (4, '2026-11-17', 'editing', 'submitted');
      INSERT INTO thesis_assignments VALUES (4,4,'supervisor'),(4,3,'advisor');
    `);
    const studentData = () => [db.students, db.meetingLogs, db.phaseAuditEntries];
    const originalData = studentData();
    const otherUsers = db.appUsers.filter((user) => user.id !== advisor.id);
    expect(await (await get(admin)).text()).not.toContain("Permanently delete account");
    expect(saved(await post(admin, "delete-account", { accountId: "3", version: "1" }))).toBe(false);
    expect(saved(await post(admin, "delete-account", { accountId: "1", version: "1" }))).toBe(false);
    expect(saved(await post(admin, "disable-account", { accountId: "3", version: "1" }))).toBe(true);
    expect(await (await get(admin)).text()).toContain("Permanently delete account");
    // Simulate a pre-existing advisor row left on a disabled account.
    db.sqlite.exec("INSERT INTO thesis_assignments VALUES (4,3,'advisor')");
    const target = { accountId: "3", version: "2" };
    expect((await post(lead, "delete-account", target)).status).toBe(403);
    expect(saved(await post({ ...lead, isAdmin: true }, "delete-account", target))).toBe(false);
    expect(saved(await post(admin, "delete-account", { ...target, version: "1" }))).toBe(false);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM thesis_assignments WHERE user_id=3").get()?.count).toBe(1);
    expect(saved(await post(admin, "delete-account", target))).toBe(true);
    expect(saved(await post(admin, "delete-account", target))).toBe(false);
    expect(db.appUsers).toEqual(otherUsers);
    expect(studentData()).toEqual(originalData);
    expect(db.sqlite.prepare("SELECT * FROM thesis_assignments ORDER BY student_id").all()).toEqual([
      { student_id: 1, user_id: 2, assignment_role: "supervisor" },
      { student_id: 4, user_id: 4, assignment_role: "supervisor" },
    ]);
    expect(db.sqlite.prepare("SELECT user_id FROM agent_tokens").all()).toEqual([{ user_id: lead.id }]);
    expect(await authenticateAgent(bearer(leadToken), db)).toMatchObject({ id: lead.id });
    expect(
      saved(await post(admin, "create-account", { name: advisor.name, role: "readonly", password: "replacement-user-password" })),
    ).toBe(true);
    expect(db.appUsers.find((user) => user.name === advisor.name)?.id).not.toBe(advisor.id);
    expect(resolveSessionUser(await resolveAuthState({ DB: db }), { userId: advisor.id, sessionVersion: 1 })).toBeNull();
    expect(await authenticateAgent(bearer(oldToken), db)).toBeNull();
  });

  it("keeps both assignments when a disabled account still supervises an archived thesis or deletion fails halfway", async () => {
    db.sqlite.exec(`
      UPDATE app_users SET disabled_at='2026-11-24' WHERE id=4;
      INSERT INTO thesis_assignments VALUES (4,4,'supervisor'), (1,4,'advisor');
    `);
    const target = { accountId: "4", version: "1" };
    expect(saved(await post(admin, "delete-account", target))).toBe(false);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM thesis_assignments WHERE user_id=4").get()?.count).toBe(2);
    expect(saved(await post(admin, "transfer", { studentId: "4", previousLead: "4", accountId: "2" }))).toBe(true);
    db.failQueries.push(/^DELETE FROM app_users /);
    await expect(post(admin, "delete-account", target)).rejects.toThrow("Simulated database failure");
    expect(db.sqlite.prepare("SELECT assignment_role FROM thesis_assignments WHERE user_id=4").get()?.assignment_role).toBe("advisor");
    expect(db.appUsers.some((user) => user.id === 4)).toBe(true);
  });
});
