PRAGMA foreign_keys = ON;

ALTER TABLE students
ADD COLUMN degree_type TEXT NOT NULL DEFAULT 'msc' CHECK (degree_type IN ('bsc', 'msc', 'dsc'));
