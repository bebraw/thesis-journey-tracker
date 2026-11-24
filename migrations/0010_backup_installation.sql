-- A full D1 recovery preserves this identifier. Independent installations generate their own.
CREATE TABLE backup_installation (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  installation_id TEXT NOT NULL CHECK (length(installation_id) = 32)
);

INSERT INTO backup_installation (singleton, installation_id) VALUES (1, lower(hex(randomblob(16))));
