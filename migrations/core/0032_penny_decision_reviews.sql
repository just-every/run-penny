-- Commitment history remains in the original revision and snapshot tables.
ALTER TABLE decisions ADD COLUMN review_generation INTEGER NOT NULL DEFAULT 0;
CREATE TABLE decision_reviews (
 id TEXT PRIMARY KEY NOT NULL, decision_id TEXT NOT NULL REFERENCES decisions(id),
 operator_id TEXT NOT NULL REFERENCES operators(id), note TEXT NOT NULL,
 review_at TEXT NOT NULL, decision_revision_id TEXT REFERENCES decision_revisions(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE decision_review_notifications (
 id TEXT PRIMARY KEY NOT NULL, decision_id TEXT NOT NULL REFERENCES decisions(id),
 owner_operator_id TEXT NOT NULL REFERENCES operators(id), review_generation INTEGER NOT NULL,
 review_at TEXT NOT NULL, dismissed_at TEXT,
 state TEXT NOT NULL CHECK(state IN('queued','sending','accepted','failed','unknown','held')),
 claim_id TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
 provider_message_id TEXT, failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(decision_id,review_generation)
);
CREATE INDEX decision_review_due ON decisions(state,review_at);
CREATE TRIGGER decision_revision_validate BEFORE INSERT ON decision_revisions
WHEN NEW.revision_number>1 AND (SELECT phase FROM data_state WHERE singleton=1)!='applying'
BEGIN
 SELECT RAISE(ABORT,'decision revision changed') WHERE NEW.revision_number!=(SELECT COALESCE(MAX(revision_number),0)+1 FROM decision_revisions WHERE decision_id=NEW.decision_id);
 SELECT RAISE(ABORT,'decision revision requires commitment') WHERE (SELECT state FROM decisions WHERE id=NEW.decision_id) NOT IN('committed','review_due');
 SELECT RAISE(ABORT,'Selected bet mismatch') WHERE NOT EXISTS(SELECT 1 FROM candidate_bets WHERE id=NEW.selected_candidate_bet_id AND decision_id=NEW.decision_id);
 SELECT RAISE(ABORT,'Owner required') WHERE NEW.owner_operator_id IS NULL;
 SELECT RAISE(ABORT,'Linked evidence required') WHERE NOT EXISTS(SELECT 1 FROM candidate_bets b JOIN candidate_bet_evidence_links l ON l.candidate_bet_id=b.id WHERE b.decision_id=NEW.decision_id);
 SELECT RAISE(ABORT,'No viable alternative reason required') WHERE (SELECT COUNT(*) FROM candidate_bets WHERE decision_id=NEW.decision_id)<2 AND COALESCE(trim(NEW.no_viable_alternative_reason),'')='';
 SELECT RAISE(ABORT,'Multiple historical roadmap items require resolution') WHERE (SELECT COUNT(*) FROM roadmap_items WHERE candidate_bet_id=NEW.selected_candidate_bet_id)>1;
END;
-- Restored mail effects need explicit reconciliation; they can never replay on Cron.
CREATE TRIGGER decision_review_restore_hold AFTER INSERT ON decision_review_notifications
WHEN (SELECT phase FROM data_state WHERE singleton=1)='applying' AND NEW.state IN('queued','sending','unknown')
BEGIN UPDATE decision_review_notifications SET state='held',claim_id=NULL,failure_reason='restored_delivery_review_required' WHERE id=NEW.id; END;
CREATE TRIGGER data_wait_for_decision_review_mail BEFORE UPDATE OF phase ON data_state
WHEN NEW.phase='locked' AND OLD.phase='idle' AND EXISTS(SELECT 1 FROM decision_review_notifications WHERE state='sending')
BEGIN SELECT RAISE(ABORT,'notification_writer_active'); END;
CREATE TRIGGER data_guard_decision_reviews_insert BEFORE INSERT ON decision_reviews
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_reviews_update BEFORE UPDATE ON decision_reviews
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_reviews_delete BEFORE DELETE ON decision_reviews
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_review_notifications_insert BEFORE INSERT ON decision_review_notifications
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_review_notifications_update BEFORE UPDATE ON decision_review_notifications
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_decision_review_notifications_delete BEFORE DELETE ON decision_review_notifications
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
