import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

function applyAllMigrations(db: DatabaseSync) {
  for (const name of MIGRATION_FILES) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
}

describe("schema migrations", () => {
  it("removes retired Google Calendar settings while preserving dashboard settings and meetings", () => {
    const db = new DatabaseSync(":memory:");
    const cleanupMigration = "0006_remove_google_calendar_settings.sql";
    for (const name of MIGRATION_FILES.filter((name) => name < cleanupMigration)) {
      db.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
    }
    db.exec(`
      INSERT INTO app_secrets (secret_key, encrypted_value, updated_at) VALUES
        ('google_calendar_config', 'old-calendar-credentials', '2026-10-09T09:00:00.000Z'),
        ('dashboard_lane_config', 'custom-lanes', '2026-10-09T09:00:00.000Z');
      INSERT INTO students (name, current_phase, next_meeting_at, meeting_schedule) VALUES
        ('Keep this student', 'researching', '2026-10-16T11:00:00.000Z', '{"startLocal":"2026-10-16T14:00","timeZone":"Europe/Helsinki","intervalWeeks":1}');
    `);

    db.exec(readFileSync(join(MIGRATIONS_DIR, cleanupMigration), "utf8"));

    expect(db.prepare("SELECT secret_key, encrypted_value FROM app_secrets").all()).toEqual([
      { secret_key: "dashboard_lane_config", encrypted_value: "custom-lanes" },
    ]);
    expect(db.prepare("SELECT name, next_meeting_at, meeting_schedule FROM students").get()).toEqual({
      name: "Keep this student",
      next_meeting_at: "2026-10-16T11:00:00.000Z",
      meeting_schedule: '{"startLocal":"2026-10-16T14:00","timeZone":"Europe/Helsinki","intervalWeeks":1}',
    });
    db.close();
  });

  it("adds thesis assignments to an existing database without changing historical records or granting access", () => {
    const db = new DatabaseSync(":memory:");
    const migration = "0007_thesis_assignments.sql";
    for (const file of MIGRATION_FILES.filter((name) => name < migration)) {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    }
    db.exec(`
      INSERT INTO students (id, name, current_phase, archived_at, meeting_schedule) VALUES
        (10, 'Active', 'researching', NULL, '{"intervalWeeks":2}'),
        (40, 'Archived', 'submitted', '2026-01-05', NULL);
      INSERT INTO meeting_logs (student_id,happened_at,discussed,agreed_plan) VALUES (40,'2026-01-02','Discuss','Deliver');
      INSERT INTO student_phase_audit (student_id,changed_at,from_phase,to_phase) VALUES (40,'2026-01-03','editing','submitted');
      INSERT INTO app_users (id,name,password_hash,role,session_version) VALUES
        (7,'Lead','original','editor',4),(19,'Reader','another','readonly',2);
      INSERT INTO agent_tokens (id,user_id,name,token_hash,expires_at) VALUES ('t',19,'Tool','example','2029-01-01');
      INSERT INTO app_secrets (secret_key,encrypted_value,updated_at) VALUES ('dashboard_lane_config','settings','2026-01-01');
    `);
    const historyTables = ["students", "meeting_logs", "student_phase_audit", "agent_tokens", "app_secrets"];
    const history = () => historyTables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
    const users = () =>
      db.prepare("SELECT id,name,password_hash,role,session_version,created_at,updated_at FROM app_users ORDER BY id").all();
    const originalHistory = history();
    const originalUsers = users();
    db.exec(readFileSync(join(MIGRATIONS_DIR, migration), "utf8"));
    expect(history()).toEqual(originalHistory);
    expect(users()).toEqual(originalUsers);
    expect(db.prepare("SELECT 1 FROM thesis_assignments").all()).toEqual([]);
    expect(db.prepare("SELECT 1 FROM app_users WHERE is_admin != 0 OR can_supervise != 0 OR disabled_at IS NOT NULL").all()).toEqual([]);

    db.exec(`
      UPDATE app_users SET is_admin=1,can_supervise=1 WHERE id=7;
      INSERT INTO thesis_assignments SELECT id,7,'supervisor' FROM students;
      INSERT INTO thesis_assignments VALUES (40,19,'advisor');
    `);
    expect(history()).toEqual(originalHistory);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(() => db.exec("INSERT INTO thesis_assignments VALUES (10,19,'supervisor')")).toThrow();
    expect(() => db.exec("DELETE FROM app_users WHERE id=7")).toThrow();
    for (const change of ["role='readonly'", "can_supervise=0", "disabled_at='2026-02-01'"]) {
      expect(() => db.exec(`UPDATE app_users SET ${change} WHERE id=7`)).toThrow("Transfer supervised theses");
    }
    db.exec("UPDATE app_users SET disabled_at='2026-02-02' WHERE id=19");
    expect(db.prepare("SELECT 1 FROM thesis_assignments WHERE user_id=19").get()).toBeUndefined();
    expect(db.prepare("SELECT revoked_at FROM agent_tokens WHERE id='t'").get()?.revoked_at).toBeTruthy();
    db.exec(`
      UPDATE app_users SET disabled_at=NULL WHERE id=19;
      INSERT INTO agent_tokens (id,user_id,name,token_hash,expires_at) VALUES ('t2',19,'Tool','next','2029-01-01');
      UPDATE app_users SET password_hash='reset' WHERE id=19;
    `);
    expect(db.prepare("SELECT 1 FROM agent_tokens WHERE revoked_at IS NULL").get()).toBeUndefined();
    db.close();
  });

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
        'dashboard_lane_config',
        'ciphertext',
        '2026-03-20T09:00:00.000Z'
      );
    `);

    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
      .all() as Array<{ name: string }>;
    expect(tableNames.map(({ name }) => name)).toEqual([
      "agent_tokens",
      "app_secrets",
      "app_users",
      "login_attempts",
      "meeting_logs",
      "student_phase_audit",
      "students",
      "thesis_assignments",
    ]);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
      .all() as Array<{ name: string }>;
    expect(indexes.map(({ name }) => name)).toEqual([
      "idx_app_users_role",
      "idx_login_attempts_last_failed_at",
      "idx_login_attempts_locked_until",
      "idx_meeting_logs_student_happened_at",
      "idx_student_phase_audit_student_id",
      "idx_students_archived_at",
      "idx_students_next_meeting",
      "idx_thesis_assignments_supervisor",
      "idx_thesis_assignments_user",
    ]);

    db.exec(`
      UPDATE students
      SET thesis_topic = 'Updated topic'
      WHERE id = 1;

      UPDATE app_users
      SET role = 'readonly'
      WHERE id = 1;
    `);

    const studentRow = db.prepare("SELECT current_phase, student_notes, thesis_topic, updated_at FROM students WHERE id = 1").get() as {
      current_phase: string;
      student_notes: string | null;
      thesis_topic: string | null;
      updated_at: string;
    };
    expect(studentRow.current_phase).toBe("researching");
    expect(studentRow.student_notes).toBe("Keep the single init migration in sync");
    expect(studentRow.thesis_topic).toBe("Updated topic");
    expect(studentRow.updated_at).not.toBe("2026-01-01T09:00:00.000Z");

    const appUserRow = db.prepare("SELECT role, session_version, updated_at FROM app_users WHERE id = 1").get() as {
      role: string;
      session_version: number;
      updated_at: string;
    };
    expect(appUserRow.role).toBe("readonly");
    expect(appUserRow.session_version).toBe(1);
    expect(appUserRow.updated_at).not.toBe("2026-01-01T09:00:00.000Z");

    db.exec("DELETE FROM students WHERE id = 1");

    const logCount = db.prepare("SELECT COUNT(*) AS count FROM meeting_logs").get() as { count: number };
    const phaseAuditCount = db.prepare("SELECT COUNT(*) AS count FROM student_phase_audit").get() as { count: number };
    expect(logCount.count).toBe(0);
    expect(phaseAuditCount.count).toBe(0);
  });
});
