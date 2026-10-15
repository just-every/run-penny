-- import-kit d1ErasureProgressSchema: the durable journal that lets one saved-import
-- erasure step continue across requests. Rows hold opaque ids, digests and counts.
CREATE TABLE IF NOT EXISTS ik_d1_erasure_progress (id TEXT PRIMARY KEY,destination TEXT NOT NULL,request_hash TEXT NOT NULL,generation TEXT NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('index','values','sealed','complete')),index_rows INTEGER NOT NULL CHECK(index_rows>=0),value_rows INTEGER NOT NULL CHECK(value_rows>=0),revision INTEGER NOT NULL CHECK(revision=index_rows+value_rows),records_erased INTEGER NOT NULL CHECK(records_erased>=0),field_matches_json TEXT NOT NULL CHECK(json_valid(field_matches_json)),created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_progress_insert BEFORE INSERT ON ik_d1_erasure_progress WHEN EXISTS(SELECT 1 FROM ik_d1_erasure_progress WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_OPERATION_CHANGED'); END;
CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_progress_binding BEFORE UPDATE ON ik_d1_erasure_progress WHEN NEW.id IS NOT OLD.id OR NEW.destination IS NOT OLD.destination OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at OR OLD.phase='complete' BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_OPERATION_CHANGED'); END;
CREATE TRIGGER IF NOT EXISTS ik_d1_erasure_progress_delete BEFORE DELETE ON ik_d1_erasure_progress WHEN OLD.phase='complete' BEGIN SELECT RAISE(ABORT,'IMPORT_ERASURE_OPERATION_CHANGED'); END;

-- Penny maintenance admission for the new journal, like the other erasure custody tables.
CREATE TRIGGER penny_ik_d1_erasure_progress_insert BEFORE INSERT ON ik_d1_erasure_progress
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER penny_ik_d1_erasure_progress_update BEFORE UPDATE ON ik_d1_erasure_progress
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER penny_ik_d1_erasure_progress_delete BEFORE DELETE ON ik_d1_erasure_progress
WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
