CREATE TABLE IF NOT EXISTS app_secrets (
  secret_key TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
