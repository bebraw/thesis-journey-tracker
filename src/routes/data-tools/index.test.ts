import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword, seedTestUsers } from "../../../tests/helpers/auth";
import { MockD1Database } from "../../../tests/helpers/mock-d1";

vi.mock("../../../.generated/styles.css", () => ({ default: "" }));
vi.mock("../../favicon.ico", () => ({ default: new ArrayBuffer(0) }));

type WorkerFetch = (typeof import("../../worker"))["default"]["fetch"];

describe("data import and export", () => {
  let env: { DB: MockD1Database; SESSION_SECRET: string; REPLACE_IMPORT_ENABLED?: string };
  let fetchHandler: WorkerFetch;

  beforeEach(async () => {
    vi.resetModules();
    const workerModule = await import("../../worker");
    fetchHandler = workerModule.default.fetch;
    env = {
      DB: new MockD1Database(),
      SESSION_SECRET: "test-secret",
    };
    await seedTestUsers(env.DB, [{ name: "Advisor", password: "test-password", role: "editor" }]);

    env.DB.meetingLogs.push({
      id: 1,
      student_id: 1,
      happened_at: "2026-03-22T09:00:00.000Z",
      discussed: "Initial review",
      agreed_plan: "Write chapter 1",
      next_step_deadline: "2026-03-29",
    });
    env.DB.phaseAuditEntries.push({
      id: 1,
      student_id: 1,
      changed_at: "2026-03-21T12:00:00.000Z",
      from_phase: "research_plan",
      to_phase: "researching",
    });
  });

  it("exports the current dataset as a JSON attachment", async () => {
    env.DB.students[0]!.archived_at = "2026-03-24T10:00:00.000Z";

    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/actions/export-json", {
        headers: { cookie },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain("attachment;");

    const body = JSON.parse(await response.text()) as {
      app: string;
      schemaVersion: number;
      students: Array<{
        name: string;
        archivedAt?: string | null;
        studentNotes?: string | null;
        logs: Array<{ discussed: string }>;
        phaseAudit: Array<{ fromPhase: string; toPhase: string }>;
      }>;
    };

    expect(body.app).toBe("thesis-journey-tracker");
    expect(body.schemaVersion).toBe(1);
    expect(body.students).toHaveLength(1);
    expect(body.students[0]?.name).toBe("Base Student");
    expect(body.students[0]?.archivedAt).toBe("2026-03-24T10:00:00.000Z");
    expect(body.students[0]?.studentNotes).toBe("Baseline student note");
    expect(body.students[0]?.logs[0]?.discussed).toBe("Initial review");
    expect(body.students[0]?.phaseAudit[0]?.fromPhase).toBe("research_plan");
    expect(body.students[0]?.phaseAudit[0]?.toPhase).toBe("researching");
  });

  it("exports a professor-friendly markdown status report", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/actions/export-professor-report", {
        headers: { cookie },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain("thesis-journey-status-report-");

    const body = await response.text();
    expect(body).toContain("# Thesis Supervision Status Report");
    expect(body).toContain("## Summary");
    expect(body).toContain("## Student Updates");
    expect(body).toContain("Base Student (MSc)");
    expect(body).toContain('agreed next step "Write chapter 1"');
  });

  it("records a phase audit entry when a student's phase changes", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Base Student",
          email: "base@example.edu",
          degreeType: "msc",
          thesisTopic: "Baseline supervision topic",
          studentNotes: "Updated student note",
          startDate: "",
          currentPhase: "editing",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.phaseAuditEntries).toHaveLength(2);
    expect(env.DB.phaseAuditEntries[1]?.from_phase).toBe("researching");
    expect(env.DB.phaseAuditEntries[1]?.to_phase).toBe("editing");
  });

  it("rolls back a phase change if writing the audit entry fails", async () => {
    env.DB.failQueries.push(/^INSERT INTO student_phase_audit/);

    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const response = await fetchHandler(
      new Request("http://localhost/actions/update-student/1", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams({
          name: "Base Student",
          email: "base@example.edu",
          degreeType: "msc",
          thesisTopic: "Baseline supervision topic",
          studentNotes: "Baseline student note",
          startDate: "",
          currentPhase: "editing",
          nextMeetingAt: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Failed+to+save+student+update");
    expect(env.DB.students[0]?.current_phase).toBe("researching");
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
    expect(env.DB.phaseAuditEntries[0]?.to_phase).toBe("researching");
  });

  it("appends imported students and logs by default", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [
              {
                name: "Imported Student",
                email: "imported@example.edu",
                degreeType: "dsc",
                thesisTopic: "Imported thesis",
                studentNotes: "Imported student note",
                startDate: "2026-02-01",
                currentPhase: "editing",
                nextMeetingAt: "2026-04-01T09:00:00.000Z",
                logs: [
                  {
                    happenedAt: "2026-03-20T10:00:00.000Z",
                    discussed: "Imported log",
                    agreedPlan: "Imported next step",
                    nextStepDeadline: "2026-03-30",
                  },
                ],
                phaseAudit: [
                  {
                    changedAt: "2026-03-15T08:00:00.000Z",
                    fromPhase: "research_plan",
                    toPhase: "editing",
                  },
                ],
              },
            ],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/data-tools?notice=");
    expect(env.DB.students).toHaveLength(2);
    expect(env.DB.students[1]?.name).toBe("Imported Student");
    expect(env.DB.students[1]?.student_notes).toBe("Imported student note");
    expect(env.DB.students[1]?.current_phase).toBe("editing");
    expect(env.DB.meetingLogs).toHaveLength(2);
    expect(env.DB.meetingLogs[1]?.discussed).toBe("Imported log");
    expect(env.DB.phaseAuditEntries).toHaveLength(2);
    expect(env.DB.phaseAuditEntries[1]?.to_phase).toBe("editing");
  });

  it("rejects imports that exceed the single-batch D1 safety limit", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);

    const oversizedStudents = Array.from({ length: 751 }, (_, index) => ({
      name: `Imported Student ${index + 1}`,
      email: null,
      degreeType: "msc",
      thesisTopic: null,
      studentNotes: null,
      startDate: "2026-02-01",
      currentPhase: "research_plan",
      nextMeetingAt: null,
      logs: [],
      phaseAudit: [],
    }));

    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: oversizedStudents,
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Import%20is%20too%20large%20for%20a%20single%20D1%20batch");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
  });

  it("requires confirmation before replacement import", async () => {
    env.REPLACE_IMPORT_ENABLED = "1";
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Confirm+replacement+before+importing");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
  });

  it("replaces the current dataset when replacement is confirmed", async () => {
    env.REPLACE_IMPORT_ENABLED = "1";
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [
              {
                name: "Replacement Student",
                email: null,
                degreeType: "bsc",
                thesisTopic: null,
                startDate: null,
                currentPhase: "research_plan",
                nextMeetingAt: null,
                logs: [],
                phaseAudit: [
                  {
                    changedAt: "2026-01-20T08:00:00.000Z",
                    fromPhase: "research_plan",
                    toPhase: "researching",
                  },
                ],
              },
            ],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");
    formData.set("confirmReplace", "yes");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.students[0]?.name).toBe("Replacement Student");
    expect(env.DB.meetingLogs).toHaveLength(0);
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
    expect(env.DB.phaseAuditEntries[0]?.to_phase).toBe("researching");
  });

  it("blocks replacement imports unless they are explicitly enabled", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");
    formData.set("confirmReplace", "yes");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Replacement+imports+are+disabled+in+this+environment");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
  });

  it("keeps existing data untouched if a replacement batch fails", async () => {
    env.REPLACE_IMPORT_ENABLED = "1";
    env.DB.failQueries.push(/^INSERT INTO meeting_logs/);

    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set(
      "importFile",
      new File(
        [
          JSON.stringify({
            app: "thesis-journey-tracker",
            schemaVersion: 1,
            exportedAt: "2026-03-23T08:00:00.000Z",
            students: [
              {
                name: "Replacement Student",
                email: null,
                degreeType: "bsc",
                thesisTopic: null,
                startDate: null,
                currentPhase: "research_plan",
                nextMeetingAt: null,
                logs: [
                  {
                    happenedAt: "2026-03-20T10:00:00.000Z",
                    discussed: "Imported log",
                    agreedPlan: "Imported next step",
                    nextStepDeadline: "2026-03-30",
                  },
                ],
                phaseAudit: [],
              },
            ],
          }),
        ],
        "backup.json",
        { type: "application/json" },
      ),
    );
    formData.set("mode", "replace");
    formData.set("confirmReplace", "yes");

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("Existing%20data%20was%20left%20unchanged");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.students[0]?.name).toBe("Base Student");
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.meetingLogs[0]?.discussed).toBe("Initial review");
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
    expect(env.DB.phaseAuditEntries[0]?.to_phase).toBe("researching");
  });

  it("rejects invalid JSON imports without changing stored data", async () => {
    const cookie = await loginWithPassword(fetchHandler, env, "Advisor", "test-password");
    expect(cookie.startsWith("thesis_session=")).toBe(true);
    const formData = new FormData();
    formData.set("importFile", new File(["not-json"], "broken.json", { type: "application/json" }));

    const response = await fetchHandler(
      new Request("http://localhost/actions/import-json", {
        method: "POST",
        headers: { cookie },
        body: formData,
      }),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("not%20valid%20JSON");
    expect(env.DB.students).toHaveLength(1);
    expect(env.DB.meetingLogs).toHaveLength(1);
    expect(env.DB.phaseAuditEntries).toHaveLength(1);
  });
});
