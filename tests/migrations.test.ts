import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();

function applyMigrations(db: DatabaseSync, upTo: string, startAfter?: string) {
  let shouldApply = startAfter ? false : true;

  for (const name of MIGRATION_FILES) {
    if (!shouldApply) {
      if (name === startAfter) {
        shouldApply = true;
      }
      continue;
    }

    db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
    if (name === upTo) {
      return;
    }
  }

  throw new Error(`Migration ${upTo} not found`);
}

describe("schema migrations", () => {
  it("preserves meeting logs and phase audit rows while rebuilding the students table", () => {
    const db = new DatabaseSync(":memory:");

    applyMigrations(db, "0005_remove_is_mock_columns.sql");

    db.exec(`
      INSERT INTO students (
        id,
        name,
        email,
        start_date,
        target_submission_date,
        current_phase,
        next_meeting_at,
        created_at,
        updated_at,
        degree_type,
        thesis_topic
      ) VALUES (
        1,
        'Migration Student',
        'migration@example.edu',
        '2026-01-01',
        '2026-07-01',
        'researching',
        NULL,
        '2026-01-01T09:00:00.000Z',
        '2026-01-01T09:00:00.000Z',
        'msc',
        'Migration-safe schema changes'
      );

      INSERT INTO meeting_logs (
        id,
        student_id,
        happened_at,
        discussed,
        agreed_plan,
        next_step_deadline,
        created_at
      ) VALUES (
        1,
        1,
        '2026-03-22T09:00:00.000Z',
        'Initial review',
        'Write chapter 1',
        '2026-03-29',
        '2026-03-22T09:00:00.000Z'
      );
    `);

    applyMigrations(db, "0009_add_login_attempts.sql", "0005_remove_is_mock_columns.sql");

    db.exec(`
      INSERT INTO student_phase_audit (
        id,
        student_id,
        changed_at,
        from_phase,
        to_phase
      ) VALUES (
        1,
        1,
        '2026-03-21T12:00:00.000Z',
        'research_plan',
        'researching'
      );
    `);

    applyMigrations(db, "0014_add_student_archiving.sql", "0009_add_login_attempts.sql");

    const studentCount = db.prepare("SELECT COUNT(*) AS count FROM students").get() as { count: number };
    const logCount = db.prepare("SELECT COUNT(*) AS count FROM meeting_logs").get() as { count: number };
    const phaseAuditCount = db.prepare("SELECT COUNT(*) AS count FROM student_phase_audit").get() as { count: number };

    expect(studentCount.count).toBe(1);
    expect(logCount.count).toBe(1);
    expect(phaseAuditCount.count).toBe(1);

    const logRow = db
      .prepare("SELECT student_id, discussed, agreed_plan, next_step_deadline FROM meeting_logs WHERE id = 1")
      .get() as { student_id: number; discussed: string; agreed_plan: string; next_step_deadline: string | null };
    expect(logRow.student_id).toBe(1);
    expect(logRow.discussed).toBe("Initial review");
    expect(logRow.agreed_plan).toBe("Write chapter 1");
    expect(logRow.next_step_deadline).toBe("2026-03-29");

    const auditRow = db
      .prepare("SELECT student_id, from_phase, to_phase FROM student_phase_audit WHERE id = 1")
      .get() as { student_id: number; from_phase: string; to_phase: string };
    expect(auditRow.student_id).toBe(1);
    expect(auditRow.from_phase).toBe("research_plan");
    expect(auditRow.to_phase).toBe("researching");
  });
});
