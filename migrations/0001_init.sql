PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  start_date TEXT,
  current_phase TEXT NOT NULL CHECK (current_phase IN (
    'research_plan',
    'researching',
    'editing',
    'submitted'
  )),
  next_meeting_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  degree_type TEXT NOT NULL DEFAULT 'msc' CHECK (degree_type IN ('bsc', 'msc', 'dsc')),
  thesis_topic TEXT,
  student_notes TEXT,
  archived_at TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_students_next_meeting ON students (next_meeting_at);
CREATE INDEX IF NOT EXISTS idx_students_archived_at ON students (archived_at);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_student_happened_at ON meeting_logs (student_id, happened_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS student_phase_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  from_phase TEXT NOT NULL CHECK (from_phase IN (
    'research_plan',
    'researching',
    'editing',
    'submitted'
  )),
  to_phase TEXT NOT NULL CHECK (to_phase IN (
    'research_plan',
    'researching',
    'editing',
    'submitted'
  )),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_phase_audit_student_id ON student_phase_audit (student_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS app_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'readonly')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  last_failed_at TEXT NOT NULL,
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts (locked_until);

CREATE TABLE IF NOT EXISTS app_secrets (
  secret_key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS trg_students_updated_at
AFTER UPDATE ON students
FOR EACH ROW
BEGIN
  UPDATE students
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_app_users_updated_at
AFTER UPDATE ON app_users
FOR EACH ROW
BEGIN
  UPDATE app_users
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.id;
END;
