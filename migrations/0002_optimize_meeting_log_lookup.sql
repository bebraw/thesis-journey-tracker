DROP INDEX IF EXISTS idx_logs_student_id;

CREATE INDEX IF NOT EXISTS idx_meeting_logs_student_happened_at
ON meeting_logs (student_id, happened_at DESC, id DESC);
