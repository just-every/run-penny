-- Private metadata snapshots; restored history is never an actionable undo.
CREATE TABLE penny_request_batches (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES operators(id), selected INTEGER NOT NULL,
 created_at TEXT NOT NULL, undone_at TEXT, held INTEGER NOT NULL DEFAULT 0 CHECK(held IN(0,1))
);
CREATE TABLE penny_request_batch_items (
 batch_id TEXT NOT NULL REFERENCES penny_request_batches(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 before_json TEXT NOT NULL, after_json TEXT, restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN(0,1)),
 PRIMARY KEY(batch_id,request_id)
);
CREATE TRIGGER data_guard_penny_request_batches_insert BEFORE INSERT ON penny_request_batches
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batches_insert AFTER INSERT ON penny_request_batches
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_request_batches_update BEFORE UPDATE ON penny_request_batches
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batches_update AFTER UPDATE ON penny_request_batches
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_request_batches_delete BEFORE DELETE ON penny_request_batches
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batches_delete AFTER DELETE ON penny_request_batches
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_request_batch_items_insert BEFORE INSERT ON penny_request_batch_items
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batch_items_insert AFTER INSERT ON penny_request_batch_items
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_request_batch_items_update BEFORE UPDATE ON penny_request_batch_items
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batch_items_update AFTER UPDATE ON penny_request_batch_items
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_request_batch_items_delete BEFORE DELETE ON penny_request_batch_items
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_request_batch_items_delete AFTER DELETE ON penny_request_batch_items
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
