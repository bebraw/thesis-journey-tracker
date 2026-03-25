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

PRAGMA foreign_keys = ON;
