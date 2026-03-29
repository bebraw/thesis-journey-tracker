import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();

function applyAllMigrations(db: DatabaseSync) {
  for (const name of MIGRATION_FILES) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
}

describe("schema migrations", () => {
  it("creates the current application schema from scratch", () => {
    const db = new DatabaseSync(":memory:");

    applyAllMigrations(db);

    db.exec(`
      INSERT INTO students (
        id,
        name,
        email,
        start_date,
        current_phase,
        next_meeting_at,
        degree_type,
        thesis_topic,
        student_notes,
        archived_at,
        created_at,
        updated_at
      ) VALUES (
        1,
        'Migration Student',
        'migration@example.edu',
        '2026-01-01',
        'researching',
        '2026-04-01T09:00:00.000Z',
        'msc',
        'Folded baseline schema',
        'Keep the single init migration in sync',
        NULL,
        '2026-01-01T09:00:00.000Z',
        '2026-01-01T09:00:00.000Z'
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

      INSERT INTO app_users (
        id,
        name,
        password_hash,
        role,
        created_at,
        updated_at
      ) VALUES (
        1,
        'Advisor',
        'pbkdf2_sha256$1000$abc$def',
        'editor',
        '2026-01-01T09:00:00.000Z',
        '2026-01-01T09:00:00.000Z'
      );

      INSERT INTO login_attempts (
        attempt_key,
        failure_count,
        first_failed_at,
        last_failed_at,
        locked_until
      ) VALUES (
        '127.0.0.1',
        2,
        '2026-03-20T09:00:00.000Z',
        '2026-03-20T09:05:00.000Z',
        NULL
      );

      INSERT INTO app_secrets (
        secret_key,
        encrypted_value,
        updated_at
      ) VALUES (
        'calendar',
        'ciphertext',
        '2026-03-20T09:00:00.000Z'
      );
    `);

    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
      .all() as Array<{ name: string }>;
    expect(tableNames.map(({ name }) => name)).toEqual([
      "app_secrets",
      "app_users",
      "login_attempts",
      "meeting_logs",
      "student_phase_audit",
      "students",
    ]);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
      .all() as Array<{ name: string }>;
    expect(indexes.map(({ name }) => name)).toEqual([
      "idx_app_users_role",
      "idx_login_attempts_locked_until",
      "idx_meeting_logs_student_happened_at",
      "idx_student_phase_audit_student_id",
      "idx_students_archived_at",
      "idx_students_next_meeting",
    ]);

    db.exec(`
      UPDATE students
      SET thesis_topic = 'Updated topic'
      WHERE id = 1;

      UPDATE app_users
      SET role = 'readonly'
      WHERE id = 1;
    `);

    const studentRow = db
      .prepare("SELECT current_phase, student_notes, thesis_topic, updated_at FROM students WHERE id = 1")
      .get() as {
      current_phase: string;
      student_notes: string | null;
      thesis_topic: string | null;
      updated_at: string;
    };
    expect(studentRow.current_phase).toBe("researching");
    expect(studentRow.student_notes).toBe("Keep the single init migration in sync");
    expect(studentRow.thesis_topic).toBe("Updated topic");
    expect(studentRow.updated_at).not.toBe("2026-01-01T09:00:00.000Z");

    const appUserRow = db
      .prepare("SELECT role, updated_at FROM app_users WHERE id = 1")
      .get() as { role: string; updated_at: string };
    expect(appUserRow.role).toBe("readonly");
    expect(appUserRow.updated_at).not.toBe("2026-01-01T09:00:00.000Z");

    db.exec("DELETE FROM students WHERE id = 1");

    const logCount = db.prepare("SELECT COUNT(*) AS count FROM meeting_logs").get() as { count: number };
    const phaseAuditCount = db.prepare("SELECT COUNT(*) AS count FROM student_phase_audit").get() as { count: number };
    expect(logCount.count).toBe(0);
    expect(phaseAuditCount.count).toBe(0);
  });
});
