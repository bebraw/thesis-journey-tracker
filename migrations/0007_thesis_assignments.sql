ALTER TABLE app_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));
ALTER TABLE app_users ADD COLUMN can_supervise INTEGER NOT NULL DEFAULT 0 CHECK (can_supervise IN (0, 1));
ALTER TABLE app_users ADD COLUMN disabled_at TEXT;

CREATE TABLE thesis_assignments (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  assignment_role TEXT NOT NULL CHECK (assignment_role IN ('supervisor', 'advisor')),
  PRIMARY KEY (student_id, user_id)
);

CREATE UNIQUE INDEX idx_thesis_assignments_supervisor ON thesis_assignments (student_id)
  WHERE assignment_role = 'supervisor';
CREATE INDEX idx_thesis_assignments_user ON thesis_assignments (user_id, student_id);

CREATE TRIGGER trg_app_users_revoke_agent_tokens
AFTER UPDATE OF disabled_at, password_hash ON app_users
WHEN (OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL) OR NEW.password_hash <> OLD.password_hash
BEGIN
  UPDATE agent_tokens
  SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.id AND revoked_at IS NULL;
END;

CREATE TRIGGER trg_app_users_remove_disabled_advisor
AFTER UPDATE OF disabled_at ON app_users
WHEN OLD.disabled_at IS NULL AND NEW.disabled_at IS NOT NULL
BEGIN
  DELETE FROM thesis_assignments WHERE user_id = NEW.id AND assignment_role = 'advisor';
END;

CREATE TRIGGER trg_app_users_keep_thesis_supervisor
BEFORE UPDATE OF role, can_supervise, disabled_at ON app_users
WHEN (NEW.role <> 'editor' OR NEW.can_supervise = 0 OR NEW.disabled_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM thesis_assignments WHERE user_id = NEW.id AND assignment_role = 'supervisor')
BEGIN
  SELECT RAISE(ABORT, 'Transfer supervised theses before changing this account');
END;
