import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import {
  createMeetingLog,
  createPhaseAuditEntry,
  createStudent,
  getStudentById,
  listLogsForStudent,
  listPhaseAuditEntriesForStudent,
  listStudents,
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
    await runStatement(platform.env.DB, `
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
    `);
    await runStatement(platform.env.DB, `
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
    `);
    await runStatement(platform.env.DB, `
      CREATE TABLE IF NOT EXISTS student_phase_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        changed_at TEXT NOT NULL,
        from_phase TEXT NOT NULL CHECK (from_phase IN ('research_plan', 'researching', 'editing', 'submitted')),
        to_phase TEXT NOT NULL CHECK (to_phase IN ('research_plan', 'researching', 'editing', 'submitted')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `);
  }, 60_000);

  afterAll(async () => {
    if (platform) {
      await platform.dispose();
    }
    rmSync(persistPath, { force: true, recursive: true });
  }, 60_000);

  beforeEach(async () => {
    await runStatement(platform.env.DB, "DELETE FROM student_phase_audit");
    await runStatement(platform.env.DB, "DELETE FROM meeting_logs");
    await runStatement(platform.env.DB, "DELETE FROM students");
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
});

async function runStatement(db: globalThis.D1Database, sql: string): Promise<void> {
  await db.prepare(sql.trim()).run();
}
