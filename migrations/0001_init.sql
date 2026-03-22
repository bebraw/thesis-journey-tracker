PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
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

INSERT INTO settings (key, value)
VALUES ('show_mock_data', '0')
ON CONFLICT(key) DO NOTHING;

INSERT INTO students (
  name,
  email,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Mia Koskinen',
  'mia.koskinen@example.edu',
  '2026-01-10',
  '2026-07-10',
  'researching',
  '2026-03-29T10:00:00.000Z',
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Mia Koskinen' AND is_mock = 1);

INSERT INTO students (
  name,
  email,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Noah Virtanen',
  'noah.virtanen@example.edu',
  '2025-12-01',
  '2026-06-01',
  'first_complete_draft',
  NULL,
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Noah Virtanen' AND is_mock = 1);

INSERT INTO students (
  name,
  email,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Aino Lehtinen',
  'aino.lehtinen@example.edu',
  '2025-11-15',
  '2026-05-15',
  'editing',
  '2026-03-24T12:30:00.000Z',
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Aino Lehtinen' AND is_mock = 1);

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-10T09:00:00.000Z',
  'Defined thesis scope and final research questions for chapter 1.',
  'Collect five core papers and finish updated research plan draft.',
  '2026-03-20',
  1
FROM students s
WHERE s.name = 'Mia Koskinen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-10T09:00:00.000Z'
      AND ml.is_mock = 1
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-12T14:00:00.000Z',
  'Reviewed structure of full draft and identified weak discussion section.',
  'Rewrite discussion subsection and align claims with cited evidence.',
  '2026-03-26',
  1
FROM students s
WHERE s.name = 'Noah Virtanen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-12T14:00:00.000Z'
      AND ml.is_mock = 1
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-14T08:30:00.000Z',
  'Editing pass on methods/results transition and formatting issues.',
  'Deliver submission-ready version to supervisor for final checks.',
  '2026-03-28',
  1
FROM students s
WHERE s.name = 'Aino Lehtinen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-14T08:30:00.000Z'
      AND ml.is_mock = 1
  );
