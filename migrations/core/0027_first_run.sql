-- First-run confirmation belongs to this installation, not to portable domain data.
-- Additive: existing owners, sessions and application rows are preserved. An
-- installation that already has an active owner has been in use, so its setup
-- is recorded as finished by the earliest of them.
CREATE TABLE oa_first_run (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  completed_by TEXT NOT NULL REFERENCES oa_operators(id),
  completed_at INTEGER NOT NULL
);
INSERT INTO oa_first_run (singleton, completed_by, completed_at)
SELECT 1, id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM oa_operators WHERE role = 'owner' AND status = 'active'
ORDER BY created_at, id LIMIT 1;
