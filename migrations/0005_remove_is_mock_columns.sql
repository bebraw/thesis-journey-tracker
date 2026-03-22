PRAGMA foreign_keys = ON;

DROP INDEX IF EXISTS idx_students_is_mock;
DROP INDEX IF EXISTS idx_logs_is_mock;

ALTER TABLE students DROP COLUMN is_mock;
ALTER TABLE meeting_logs DROP COLUMN is_mock;
