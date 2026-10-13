-- Privacy erasure withdraws complete original bundles while retaining safe,
-- independently redacted normalized pages and their maintained Base custody.
ALTER TABLE feedback_import_bundles ADD COLUMN originals_state TEXT NOT NULL DEFAULT 'retained' CHECK(originals_state IN ('retained','withdrawn'));
-- Extend only the installation operation status constraint. Preserve prior
-- operations and their apply claims exactly while rebuilding the two FK tables.
CREATE TABLE data_operations_next (
 id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('export','restore','erase')),
 status TEXT NOT NULL CHECK(status IN ('pending','running','pending_import','running_import','pending_r2','running_r2','complete','aborted')),
 payload_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO data_operations_next SELECT * FROM data_operations;
CREATE TABLE data_apply_claims_saved(operation_id TEXT PRIMARY KEY NOT NULL);
INSERT INTO data_apply_claims_saved SELECT * FROM data_apply_claims;
DROP TABLE data_apply_claims;
DROP TABLE data_operations;
CREATE TABLE data_apply_claims(operation_id TEXT PRIMARY KEY NOT NULL REFERENCES data_operations(id));
ALTER TABLE data_operations_next RENAME TO data_operations;
INSERT INTO data_apply_claims SELECT * FROM data_apply_claims_saved;
DROP TABLE data_apply_claims_saved;

CREATE TABLE feedback_import_erasure_work (
 operation_id TEXT NOT NULL REFERENCES data_operations(id),
 ordinal INTEGER NOT NULL,
 target_kind TEXT NOT NULL,
 target_id TEXT NOT NULL,
 namespace TEXT NOT NULL,
 row_keys_json TEXT NOT NULL,
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1)),
 PRIMARY KEY(operation_id,ordinal),
 UNIQUE(operation_id,target_kind,target_id)
);

-- An undo must finish a bounded whole-operation scan before deleting anything.
CREATE TABLE feedback_import_reversal_scans (
 job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id),
 revision INTEGER NOT NULL,
 intent TEXT NOT NULL CHECK(intent IN ('undo','rollback')),
 ordinal INTEGER NOT NULL DEFAULT -1
);
