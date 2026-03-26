ALTER TABLE students
ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_students_archived_at ON students (archived_at);
