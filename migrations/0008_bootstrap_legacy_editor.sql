-- An existing installation with one editor has an unambiguous first administrator.
-- Leave installations that already configured scoped access to their administrator.
UPDATE app_users
SET is_admin = 1, can_supervise = 1, session_version = session_version + 1
WHERE role = 'editor'
  AND (SELECT COUNT(*) FROM app_users WHERE role = 'editor') = 1
  AND NOT EXISTS (
    SELECT 1 FROM app_users WHERE is_admin = 1 OR can_supervise = 1 OR disabled_at IS NOT NULL
  )
  AND NOT EXISTS (SELECT 1 FROM thesis_assignments);
