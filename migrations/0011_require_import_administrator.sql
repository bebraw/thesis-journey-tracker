CREATE VIEW student_import_administrators AS
SELECT id AS user_id, session_version
FROM app_users
WHERE is_admin = 1 AND disabled_at IS NULL;

-- Inserting into this view checks the administrator without changing account data.
-- RAISE makes D1 roll back the import batch if access changed during the upload.
CREATE TRIGGER require_student_import_administrator
INSTEAD OF INSERT ON student_import_administrators
WHEN NOT EXISTS (
  SELECT 1 FROM student_import_administrators
  WHERE user_id = NEW.user_id AND session_version = NEW.session_version
)
BEGIN
  SELECT RAISE(ABORT, 'Administrator access changed before import');
END;
