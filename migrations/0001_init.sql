PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  degree_type TEXT NOT NULL DEFAULT 'msc' CHECK (degree_type IN ('bsc', 'msc', 'dsc')),
  thesis_topic TEXT,
  start_date TEXT NOT NULL,
  target_submission_date TEXT NOT NULL,
  current_phase TEXT NOT NULL CHECK (current_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  next_meeting_at TEXT,
  is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS meeting_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  happened_at TEXT NOT NULL,
  discussed TEXT NOT NULL,
  agreed_plan TEXT NOT NULL,
  next_step_deadline TEXT,
  is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_students_is_mock ON students (is_mock);
CREATE INDEX IF NOT EXISTS idx_students_next_meeting ON students (next_meeting_at);
CREATE INDEX IF NOT EXISTS idx_logs_student_id ON meeting_logs (student_id);
CREATE INDEX IF NOT EXISTS idx_logs_is_mock ON meeting_logs (is_mock);

CREATE TRIGGER IF NOT EXISTS trg_students_updated_at
AFTER UPDATE ON students
FOR EACH ROW
BEGIN
  UPDATE students
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.id;
END;
