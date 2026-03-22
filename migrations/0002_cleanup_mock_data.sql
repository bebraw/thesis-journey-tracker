PRAGMA foreign_keys = ON;

DELETE FROM meeting_logs
WHERE is_mock = 1;

DELETE FROM students
WHERE is_mock = 1;

DROP TABLE IF EXISTS settings;
