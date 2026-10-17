-- Assignment is private product history, never installation authority. Product
-- operator IDs survive archives; only current native membership is selectable.
CREATE TABLE penny_board_owners (
 board_id TEXT PRIMARY KEY NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
 operator_id TEXT REFERENCES operators(id),
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_request_owners (
 request_id TEXT PRIMARY KEY NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
 operator_id TEXT REFERENCES operators(id),
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_evidence_owners (
 evidence_id TEXT PRIMARY KEY NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
 operator_id TEXT REFERENCES operators(id),
 updated_at TEXT NOT NULL
);
CREATE TABLE penny_comment_receipts (
 comment_id TEXT NOT NULL REFERENCES request_comments(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id),
 comment_updated_at TEXT NOT NULL,
 acknowledged_at TEXT NOT NULL,
 PRIMARY KEY(comment_id,operator_id)
);
CREATE TABLE penny_ownership_guards (
 id TEXT PRIMARY KEY NOT NULL,
 allowed INTEGER NOT NULL CONSTRAINT penny_ownership_admitted CHECK(allowed=1)
);
CREATE INDEX penny_request_owner_queue ON penny_request_owners(operator_id,request_id);
CREATE INDEX penny_evidence_owner_queue ON penny_evidence_owners(operator_id,evidence_id);

-- All capture paths use these native product tables. Defaults apply only at
-- capture, under current membership, in the request's own transaction. Restoring
-- an archive preserves its exact assignment records and creates no defaults.
CREATE TRIGGER penny_request_owner_capture AFTER INSERT ON requests
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO penny_request_owners(request_id,operator_id,updated_at)
 SELECT NEW.id,d.operator_id,NEW.created_at FROM penny_board_owners d
 JOIN operators p ON p.id=d.operator_id JOIN oa_operators n ON n.email=p.email
 WHERE d.board_id=NEW.board_id AND n.status='active';
END;
CREATE TRIGGER penny_evidence_owner_capture AFTER INSERT ON request_evidence_links
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
 AND EXISTS(SELECT 1 FROM evidence_items e WHERE e.id=NEW.evidence_id AND e.created_at=NEW.created_at)
BEGIN
 INSERT INTO penny_evidence_owners(evidence_id,operator_id,updated_at)
 SELECT NEW.evidence_id,d.operator_id,NEW.created_at FROM requests r
 JOIN penny_board_owners d ON d.board_id=r.board_id JOIN operators p ON p.id=d.operator_id
 JOIN oa_operators n ON n.email=p.email WHERE r.id=NEW.request_id AND n.status='active'
 ON CONFLICT(evidence_id) DO NOTHING;
END;

-- The portable data engine owns changes while locked; ordinary mutations must
-- stop at the same fence as the records these assignments describe.
CREATE TRIGGER data_guard_board_owners_insert BEFORE INSERT ON penny_board_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_board_owners_update BEFORE UPDATE ON penny_board_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_board_owners_delete BEFORE DELETE ON penny_board_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_request_owners_insert BEFORE INSERT ON penny_request_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_request_owners_update BEFORE UPDATE ON penny_request_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_request_owners_delete BEFORE DELETE ON penny_request_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_evidence_owners_insert BEFORE INSERT ON penny_evidence_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_evidence_owners_update BEFORE UPDATE ON penny_evidence_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_evidence_owners_delete BEFORE DELETE ON penny_evidence_owners WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_comment_receipts_insert BEFORE INSERT ON penny_comment_receipts WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_comment_receipts_update BEFORE UPDATE ON penny_comment_receipts WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_comment_receipts_delete BEFORE DELETE ON penny_comment_receipts WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id)))) BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

-- Ownership edits participate in import reversal and erasure freshness.
CREATE TRIGGER feedback_native_penny_board_owners_insert AFTER INSERT ON penny_board_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_board_owners_update AFTER UPDATE ON penny_board_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_board_owners_delete AFTER DELETE ON penny_board_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_request_owners_insert AFTER INSERT ON penny_request_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_request_owners_update AFTER UPDATE ON penny_request_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_request_owners_delete AFTER DELETE ON penny_request_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_evidence_owners_insert AFTER INSERT ON penny_evidence_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_evidence_owners_update AFTER UPDATE ON penny_evidence_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_evidence_owners_delete AFTER DELETE ON penny_evidence_owners BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_comment_receipts_insert AFTER INSERT ON penny_comment_receipts BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_comment_receipts_update AFTER UPDATE ON penny_comment_receipts BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_penny_comment_receipts_delete AFTER DELETE ON penny_comment_receipts BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
