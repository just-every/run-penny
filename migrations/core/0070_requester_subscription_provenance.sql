-- Existing boards and historical explicit checkbox permissions retain their meaning.
ALTER TABLE boards ADD COLUMN vote_subscriptions INTEGER NOT NULL DEFAULT 0 CHECK(vote_subscriptions IN(0,1));
ALTER TABLE boards ADD COLUMN vote_subscription_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE requester_update_permissions ADD COLUMN grant_origin TEXT NOT NULL DEFAULT 'explicit' CHECK(grant_origin IN('explicit','vote_subscription','author_subscription'));
ALTER TABLE requester_update_permissions ADD COLUMN board_id TEXT REFERENCES boards(id);
ALTER TABLE requester_update_permissions ADD COLUMN setting_version INTEGER;
CREATE TABLE penny_mail_identity (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), company_name TEXT NOT NULL,
 sender_name TEXT NOT NULL DEFAULT '', from_address TEXT, reply_to TEXT,
 postal_address TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE penny_mail_identity_tests (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL,
 input_hash TEXT NOT NULL, provider TEXT NOT NULL, outcome TEXT NOT NULL,
 tested_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TRIGGER notification_author_publication AFTER UPDATE OF published_at ON requests
WHEN OLD.published_at IS NULL AND NEW.published_at IS NOT NULL AND NEW.moderation_state='approved'
 AND NEW.author_requester_id IS NOT NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT OR IGNORE INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
 VALUES('publication:'||NEW.id,NEW.id,'status',NEW.id,'Your request is now public.',NEW.published_at,NEW.published_at);
END;

DROP TRIGGER notification_recipient_intent;
CREATE TRIGGER notification_recipient_intent AFTER INSERT ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.roadmap_update_version_id IS NULL
BEGIN
 INSERT INTO notification_intents(event_id,requester_id,address_id,created_at,updated_at)
 SELECT NEW.id,f.requester_id,a.id,NEW.created_at,NEW.created_at
 FROM request_follows f JOIN requesters person ON person.id=f.requester_id
 JOIN requester_addresses a ON a.requester_id=person.id
 JOIN requests r ON r.id=f.request_id JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE f.request_id=NEW.request_id AND (NEW.id NOT LIKE 'publication:%' OR person.id=r.author_requester_id) AND f.muted_at IS NULL AND person.blocked_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM requester_identity_merges retired WHERE retired.source_requester_id=person.id)
 AND a.verified_at IS NOT NULL AND a.suppressed_at IS NULL
 AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL
 AND r.merged_into_request_id IS NULL AND b.visibility='public' AND (author.id IS NULL OR author.blocked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM requester_notification_preferences p WHERE p.requester_id=person.id AND p.muted_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_notification_mutes m JOIN request_canonical_roots root ON root.origin_id=m.request_id WHERE m.requester_id=person.id AND root.canonical_id=r.id)
 AND a.id=(SELECT candidate.id FROM requester_addresses candidate
   JOIN requester_update_permissions permission ON permission.requester_address_id=candidate.id
   JOIN request_canonical_roots root ON root.origin_id=permission.request_id
   WHERE candidate.requester_id=person.id AND candidate.verified_at IS NOT NULL AND candidate.suppressed_at IS NULL
   AND permission.requester_id=person.id AND permission.revoked_at IS NULL AND permission.suppressed_at IS NULL AND root.canonical_id=r.id
   ORDER BY permission.granted_at,candidate.id LIMIT 1);
END;
CREATE TRIGGER data_guard_penny_mail_identity_insert BEFORE INSERT ON penny_mail_identity
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_penny_mail_identity_update BEFORE UPDATE ON penny_mail_identity
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_penny_mail_identity_delete BEFORE DELETE ON penny_mail_identity
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
