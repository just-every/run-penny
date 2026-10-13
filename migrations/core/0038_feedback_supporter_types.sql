-- UserVoice distinguishes support an admin captured on a person's behalf. The
-- distinction is kept beside the historical vote and never grants authority.
-- Additive: earlier votes, jobs, receipts, originals and fences are unchanged.
CREATE TABLE request_vote_supporter_types (
  request_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  supporter_type TEXT NOT NULL CHECK (supporter_type IN ('proxy', 'unmarked')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(request_id, requester_id),
  FOREIGN KEY(request_id, requester_id) REFERENCES request_vote_contributions(request_id, requester_id) ON DELETE CASCADE
);

CREATE TRIGGER data_guard_request_vote_supporter_types_insert BEFORE INSERT ON request_vote_supporter_types
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_vote_supporter_types_update BEFORE UPDATE ON request_vote_supporter_types
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_vote_supporter_types_delete BEFORE DELETE ON request_vote_supporter_types
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;

CREATE TRIGGER feedback_native_request_vote_supporter_types_insert AFTER INSERT ON "request_vote_supporter_types" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_vote_supporter_types_update AFTER UPDATE ON "request_vote_supporter_types" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER feedback_native_request_vote_supporter_types_delete AFTER DELETE ON "request_vote_supporter_types" BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
