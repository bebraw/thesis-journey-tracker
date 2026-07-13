CREATE INDEX IF NOT EXISTS idx_login_attempts_last_failed_at ON login_attempts (last_failed_at);
