-- A version 2 backup identifies an account by its immutable ID and its original backup name.
ALTER TABLE app_users ADD COLUMN backup_name TEXT;

CREATE TRIGGER trg_app_users_preserve_backup_name
AFTER UPDATE OF name ON app_users
WHEN OLD.backup_name IS NULL AND OLD.name COLLATE BINARY <> NEW.name
BEGIN
  UPDATE app_users SET backup_name = OLD.name WHERE id = NEW.id;
END;
