-- Native proxy attribution follows the origin contribution through merge/unmerge.
CREATE TABLE penny_proxy_votes (
 request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 requester_id TEXT NOT NULL REFERENCES requesters(id) ON DELETE CASCADE,
 recorder_operator_id TEXT NOT NULL REFERENCES operators(id),
 source TEXT NOT NULL, source_url TEXT, evidence_id TEXT REFERENCES evidence_items(id) ON DELETE SET NULL,
 direct_vote_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(request_id,requester_id),
 FOREIGN KEY(request_id,requester_id) REFERENCES request_vote_contributions(request_id,requester_id) ON DELETE CASCADE
);
CREATE INDEX penny_proxy_votes_requester ON penny_proxy_votes(requester_id);
CREATE TRIGGER data_guard_penny_proxy_votes_insert BEFORE INSERT ON penny_proxy_votes
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_proxy_votes_insert AFTER INSERT ON penny_proxy_votes
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_proxy_votes_update BEFORE UPDATE ON penny_proxy_votes
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_proxy_votes_update AFTER UPDATE ON penny_proxy_votes
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_proxy_votes_delete BEFORE DELETE ON penny_proxy_votes
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_proxy_votes_delete AFTER DELETE ON penny_proxy_votes
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
