CREATE TABLE penny_vote_importance_settings (
 board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),
 labels_json TEXT NOT NULL CHECK(json_valid(labels_json) AND json_array_length(labels_json) IN(3,4)),
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_vote_importance (
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 requester_id TEXT NOT NULL REFERENCES requesters(id) ON DELETE CASCADE,
 importance INTEGER CHECK(importance BETWEEN 1 AND 4),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(request_id,requester_id),
 FOREIGN KEY(request_id,requester_id) REFERENCES request_vote_contributions(request_id,requester_id) ON DELETE CASCADE
);
CREATE INDEX penny_vote_importance_requester ON penny_vote_importance(requester_id);
CREATE TRIGGER data_guard_penny_vote_importance_settings_insert BEFORE INSERT ON penny_vote_importance_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_settings_insert AFTER INSERT ON penny_vote_importance_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_vote_importance_settings_update BEFORE UPDATE ON penny_vote_importance_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_settings_update AFTER UPDATE ON penny_vote_importance_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_vote_importance_settings_delete BEFORE DELETE ON penny_vote_importance_settings
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_settings_delete AFTER DELETE ON penny_vote_importance_settings
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_vote_importance_insert BEFORE INSERT ON penny_vote_importance
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_insert AFTER INSERT ON penny_vote_importance
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_vote_importance_update BEFORE UPDATE ON penny_vote_importance
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_update AFTER UPDATE ON penny_vote_importance
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_vote_importance_delete BEFORE DELETE ON penny_vote_importance
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_vote_importance_delete AFTER DELETE ON penny_vote_importance
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
