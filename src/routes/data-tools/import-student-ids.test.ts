import { beforeEach, describe, expect, it } from "vitest";
import { MockD1Database } from "../../../tests/helpers/mock-d1";
import { handleAccessManagement } from "../access-management";
import { handleImportJson } from "./transfer";

describe("imported thesis identities", () => {
  let db: MockD1Database;
  const admin = { id: 1, name: "Lead", role: "editor" as const, isAdmin: true, canSupervise: true, sessionVersion: 1 };

  beforeEach(() => {
    db = new MockD1Database();
    db.sqlite.exec(`
      INSERT INTO app_users (id, name, password_hash, role, is_admin, can_supervise) VALUES
        (1, 'Lead', 'hash', 'editor', 1, 1), (2, 'Reader', 'hash', 'readonly', 0, 0);
      INSERT INTO thesis_assignments VALUES (1, 1, 'supervisor');
    `);
  });

  function importTheses(names: string[], mode: "append" | "replace") {
    const students = names.map((name) => ({
      name,
      degreeType: "msc",
      currentPhase: "editing",
      logs: [{ happenedAt: "2026-11-16T09:00:00Z", discussed: name, agreedPlan: "Review draft" }],
      phaseAudit: [{ changedAt: "2026-11-17T09:00:00Z", fromPhase: "researching", toPhase: "editing" }],
    }));
    const backup = JSON.stringify({ app: "thesis-journey-tracker", schemaVersion: 1, students });
    const form = new FormData();
    form.set("importFile", new File([backup], "backup.json"));
    form.set("mode", mode);
    form.set("legacySupervisor", String(admin.id));
    if (mode === "replace") form.set("confirmReplace", "yes");
    const env = { DB: db, REPLACE_IMPORT_ENABLED: "1" };
    return handleImportJson(new Request("https://test/actions/import-json", { method: "POST", body: form }), env, admin);
  }

  it("rejects an advisor assignment from a team form opened before replacement", async () => {
    const team = await handleAccessManagement(new Request("https://test/access?studentId=1"), { DB: db }, admin);
    expect(await team.text()).toContain("Advisor to add");
    const staleForm = new URLSearchParams({ action: "add-advisor", accountId: "2", studentId: "1" });

    const restore = await importTheses(["Another thesis", "Base Student"], "replace");
    expect(restore.headers.get("location")).toContain("notice=");
    expect(db.students.map(({ id }) => id)).toEqual([2, 3]);
    expect((await handleAccessManagement(new Request("https://test/access?studentId=1"), { DB: db }, admin)).status).toBe(404);
    const changed = await handleAccessManagement(
      new Request("https://test/access", { method: "POST", body: staleForm }),
      { DB: db },
      admin,
    );
    expect(changed.headers.get("location")).toContain("error=");
    expect(db.sqlite.prepare("SELECT student_id FROM thesis_assignments WHERE user_id = 2").all()).toEqual([]);
  });

  it("allocates fresh IDs and keeps each team's history together for concurrent appends", async () => {
    db.sqlite.exec("DELETE FROM students");
    const imports = await Promise.all([importTheses(["First", "Second"], "append"), importTheses(["Third"], "append")]);
    for (const response of imports) expect(response.headers.get("location")).toContain("notice=");
    expect(db.students.map(({ id }) => id)).toEqual([2, 3, 4]);
    const joined = db.sqlite
      .prepare(
        `SELECT s.name, l.discussed, p.to_phase, a.user_id FROM students s
         JOIN meeting_logs l ON l.student_id = s.id
         JOIN student_phase_audit p ON p.student_id = s.id
         JOIN thesis_assignments a ON a.student_id = s.id
         ORDER BY s.name`,
      )
      .all();
    expect(joined).toEqual(["First", "Second", "Third"].map((name) => ({ name, discussed: name, to_phase: "editing", user_id: admin.id })));
  });
});
