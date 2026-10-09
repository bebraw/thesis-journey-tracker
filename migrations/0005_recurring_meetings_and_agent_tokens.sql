ALTER TABLE students ADD COLUMN meeting_schedule TEXT CHECK (meeting_schedule IS NULL OR json_valid(meeting_schedule));

CREATE TABLE agent_tokens (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
