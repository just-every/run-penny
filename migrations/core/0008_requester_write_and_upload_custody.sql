-- Additive correction; 0001..0007 remain immutable.
-- 0005's journal cannot prove an old source vote survived removal followed by a
-- new canonical vote. A strictly newer current creation time disproves it.
-- On a running 0007 ledger legitimate overlapping votes project the MIN origin
-- time; retain those. Same-timestamp/previously-reprojected history is ambiguous
-- and is preserved rather than inventing evidence of a removal.
DELETE FROM request_vote_contributions AS c
WHERE EXISTS(SELECT 1 FROM request_merges m JOIN request_merge_vote_transfers t ON t.merge_id=m.id
 JOIN request_canonical_roots root ON root.origin_id=m.source_request_id
 JOIN request_votes v ON v.request_id=root.canonical_id AND v.requester_id=t.requester_id
 WHERE m.unmerged_at IS NULL AND m.source_request_id=c.request_id AND t.requester_id=c.requester_id
 AND t.source_created_at=c.created_at AND t.source_updated_at=c.updated_at
 AND v.created_at>m.merged_at AND v.created_at>t.source_created_at);

CREATE TABLE requester_write_guards(id TEXT PRIMARY KEY NOT NULL,
 permitted INTEGER NOT NULL CONSTRAINT requester_write_admitted CHECK(permitted=1));
CREATE TRIGGER data_guard_requester_write_guards_insert BEFORE INSERT ON requester_write_guards
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_requester_write_guards_update BEFORE UPDATE ON requester_write_guards
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_requester_write_guards_delete BEFORE DELETE ON requester_write_guards
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;

ALTER TABLE request_attachment_uploads ADD COLUMN writing INTEGER NOT NULL DEFAULT 0 CHECK(writing IN(0,1));
-- Prior releases did not record whether reserved puts were still running. Keep
-- every existing reservation fenced until explicit prior-writer quiescence.
UPDATE request_attachment_uploads SET writing=1;
-- Reservations and recovery claim writing before entering R2; maintenance and
-- file writers cannot both be admitted, regardless of handler scheduling.
CREATE TRIGGER data_wait_for_attachment_writers BEFORE UPDATE OF phase ON data_state
WHEN OLD.phase='idle' AND NEW.phase!='idle' AND EXISTS(SELECT 1 FROM request_attachment_uploads WHERE writing=1)
BEGIN SELECT RAISE(ABORT,'attachment_writer_active'); END;
