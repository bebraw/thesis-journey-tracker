PRAGMA foreign_keys = OFF;

CREATE TABLE students_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  start_date TEXT,
  current_phase TEXT NOT NULL CHECK (current_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  next_meeting_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  degree_type TEXT NOT NULL DEFAULT 'msc' CHECK (degree_type IN ('bsc', 'msc', 'dsc')),
  thesis_topic TEXT
);

INSERT INTO students_new (
  id,
  name,
  email,
  start_date,
  current_phase,
  next_meeting_at,
  created_at,
  updated_at,
  degree_type,
  thesis_topic
)
SELECT
  id,
  name,
  email,
  start_date,
  current_phase,
  next_meeting_at,
  created_at,
  updated_at,
  degree_type,
  thesis_topic
FROM students;

CREATE TABLE meeting_logs_snapshot (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  happened_at TEXT NOT NULL,
  discussed TEXT NOT NULL,
  agreed_plan TEXT NOT NULL,
  next_step_deadline TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO meeting_logs_snapshot (
  id,
  student_id,
  happened_at,
  discussed,
  agreed_plan,
  next_step_deadline,
  created_at
)
SELECT
  id,
  student_id,
  happened_at,
  discussed,
  agreed_plan,
  next_step_deadline,
  created_at
FROM meeting_logs;

CREATE TABLE student_phase_audit_snapshot (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  from_phase TEXT NOT NULL,
  to_phase TEXT NOT NULL
);

INSERT INTO student_phase_audit_snapshot (
  id,
  student_id,
  changed_at,
  from_phase,
  to_phase
)
SELECT
  id,
  student_id,
  changed_at,
  from_phase,
  to_phase
FROM student_phase_audit;

DROP TABLE meeting_logs;
DROP TABLE student_phase_audit;
DROP TRIGGER IF EXISTS trg_students_updated_at;
DROP TABLE students;
ALTER TABLE students_new RENAME TO students;

CREATE INDEX IF NOT EXISTS idx_students_next_meeting ON students (next_meeting_at);

CREATE TRIGGER IF NOT EXISTS trg_students_updated_at
AFTER UPDATE ON students
FOR EACH ROW
BEGIN
  UPDATE students
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.id;
END;

CREATE TABLE meeting_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  happened_at TEXT NOT NULL,
  discussed TEXT NOT NULL,
  agreed_plan TEXT NOT NULL,
  next_step_deadline TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

INSERT INTO meeting_logs (
  id,
  student_id,
  happened_at,
  discussed,
  agreed_plan,
  next_step_deadline,
  created_at
)
SELECT
  id,
  student_id,
  happened_at,
  discussed,
  agreed_plan,
  next_step_deadline,
  created_at
FROM meeting_logs_snapshot;

DROP TABLE meeting_logs_snapshot;

CREATE INDEX IF NOT EXISTS idx_logs_student_id ON meeting_logs (student_id);

CREATE TABLE student_phase_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  from_phase TEXT NOT NULL CHECK (from_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  to_phase TEXT NOT NULL CHECK (to_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

INSERT INTO student_phase_audit (
  id,
  student_id,
  changed_at,
  from_phase,
  to_phase
)
SELECT
  id,
  student_id,
  changed_at,
  from_phase,
  to_phase
FROM student_phase_audit_snapshot;

DROP TABLE student_phase_audit_snapshot;

CREATE INDEX IF NOT EXISTS idx_student_phase_audit_student_id ON student_phase_audit (student_id, changed_at DESC);

PRAGMA foreign_keys = ON;
