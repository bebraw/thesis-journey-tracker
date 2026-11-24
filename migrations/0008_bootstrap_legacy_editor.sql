-- Capture the original account configuration before changing any rights.
CREATE TABLE legacy_access_upgrade AS
SELECT id AS editor_id, (
  SELECT MIN(id) FROM app_users WHERE role = 'readonly' HAVING COUNT(*) = 1
) AS reader_id
FROM app_users
WHERE role = 'editor'
  AND (SELECT COUNT(*) FROM app_users WHERE role = 'editor') = 1
  AND NOT EXISTS (
    SELECT 1 FROM app_users WHERE is_admin = 1 OR can_supervise = 1 OR disabled_at IS NOT NULL
  )
  AND NOT EXISTS (SELECT 1 FROM thesis_assignments);

UPDATE app_users
SET is_admin = 1, can_supervise = 1, session_version = session_version + 1
WHERE id IN (SELECT editor_id FROM legacy_access_upgrade);

-- Only the unambiguous two-person team inherits the active and archived cohort.
INSERT INTO thesis_assignments (student_id, user_id, assignment_role)
SELECT students.id, users.id,
  CASE WHEN users.id = legacy.editor_id THEN 'supervisor' ELSE 'advisor' END
FROM legacy_access_upgrade AS legacy
JOIN app_users AS users ON users.id IN (legacy.editor_id, legacy.reader_id)
CROSS JOIN students
WHERE legacy.reader_id IS NOT NULL;

DROP TABLE legacy_access_upgrade;
