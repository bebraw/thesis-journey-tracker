PRAGMA foreign_keys = OFF;

UPDATE students
SET current_phase = 'editing'
WHERE current_phase IN ('first_complete_draft', 'submission_ready');

UPDATE student_phase_audit
SET from_phase = 'editing'
WHERE from_phase IN ('first_complete_draft', 'submission_ready');

UPDATE student_phase_audit
SET to_phase = 'editing'
WHERE to_phase IN ('first_complete_draft', 'submission_ready');

DELETE FROM student_phase_audit
WHERE from_phase = to_phase;

CREATE TABLE students_new (
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
  student_notes TEXT
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
  thesis_topic,
  student_notes
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
  thesis_topic,
  student_notes
FROM students;

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

CREATE TABLE student_phase_audit_new (
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

INSERT INTO student_phase_audit_new (
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

DROP TABLE student_phase_audit;
ALTER TABLE student_phase_audit_new RENAME TO student_phase_audit;

CREATE INDEX IF NOT EXISTS idx_student_phase_audit_student_id ON student_phase_audit (student_id, changed_at DESC);

PRAGMA foreign_keys = ON;
