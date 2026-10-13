-- Durable public-event intent. 0001–0009 remain unchanged.
-- No historical unsent intent is replayed: it lacks address-bound consent snapshots.
-- A caller's publication action is retained with its immutable public version.
-- Historical status rows keep NULL versions and their original values.
ALTER TABLE request_status_updates ADD COLUMN action_key TEXT;
ALTER TABLE request_status_updates ADD COLUMN publication_version INTEGER;
CREATE UNIQUE INDEX request_status_action ON request_status_updates(request_id,action_key);
CREATE UNIQUE INDEX request_status_version ON request_status_updates(request_id,publication_version);
CREATE TABLE requester_notification_preferences (
 requester_id TEXT PRIMARY KEY REFERENCES requesters(id), muted_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE request_notification_mutes (
 requester_id TEXT NOT NULL REFERENCES requesters(id), request_id TEXT NOT NULL REFERENCES requests(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(requester_id,request_id)
);
CREATE TABLE notification_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
 kind TEXT NOT NULL CHECK(kind IN('status','comment')), subject_id TEXT NOT NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE notification_batches (
 id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES requesters(id),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), request_id TEXT NOT NULL REFERENCES requests(id),
 first_event_id TEXT NOT NULL REFERENCES notification_events(id), window_start TEXT NOT NULL, window_end TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('queued','sending','accepted','suppressed','failed','unknown')),
 attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, claim_id TEXT,
 provider TEXT, provider_message_id TEXT, failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(address_id,request_id,first_event_id)
);
CREATE TABLE notification_intents (
 event_id TEXT NOT NULL REFERENCES notification_events(id), requester_id TEXT NOT NULL REFERENCES requesters(id),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), batch_id TEXT REFERENCES notification_batches(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, coalescing_at TEXT, PRIMARY KEY(event_id,address_id)
);
CREATE INDEX notification_intents_unbatched ON notification_intents(batch_id,created_at);
CREATE INDEX notification_batches_due ON notification_batches(state,next_attempt_at);
CREATE TABLE notification_attempts (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES notification_batches(id),
 provider TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('sending','accepted','rejected','rate_limited','unknown','suppressed','failed')),
 provider_message_id TEXT, failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER notification_status_intent AFTER INSERT ON request_status_updates
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
 SELECT NEW.id,NEW.request_id,'status',NEW.id,NEW.body,NEW.published_at,NEW.published_at;
END;
CREATE TRIGGER notification_comment_insert AFTER INSERT ON request_comments
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.moderation_state='approved' AND NEW.published_at IS NOT NULL
BEGIN
 INSERT OR IGNORE INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
 VALUES(NEW.id,NEW.request_id,'comment',NEW.id,NEW.body,NEW.published_at,NEW.published_at);
END;
CREATE TRIGGER notification_comment_approval AFTER UPDATE OF moderation_state,published_at ON request_comments
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.moderation_state='approved' AND NEW.published_at IS NOT NULL
 AND (OLD.moderation_state!='approved' OR OLD.published_at IS NULL)
BEGIN
 INSERT OR IGNORE INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
 VALUES(NEW.id,NEW.request_id,'comment',NEW.id,NEW.body,NEW.published_at,NEW.published_at);
END;
-- Consent is captured in the transaction that publishes the event. One verified
-- address per identity is selected deterministically from explicit permissions.
CREATE TRIGGER notification_recipient_intent AFTER INSERT ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_intents(event_id,requester_id,address_id,created_at,updated_at)
 SELECT NEW.id,f.requester_id,a.id,NEW.created_at,NEW.created_at
 FROM request_follows f JOIN requesters person ON person.id=f.requester_id
 JOIN requester_addresses a ON a.requester_id=person.id
 JOIN requests r ON r.id=f.request_id JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE f.request_id=NEW.request_id AND f.muted_at IS NULL AND person.blocked_at IS NULL
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
   AND permission.requester_id=person.id AND permission.revoked_at IS NULL AND root.canonical_id=r.id
   ORDER BY permission.granted_at,candidate.id LIMIT 1);
END;
CREATE TRIGGER data_guard_requester_notification_preferences_insert BEFORE INSERT ON requester_notification_preferences
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_requester_notification_preferences_update BEFORE UPDATE ON requester_notification_preferences
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_requester_notification_preferences_delete BEFORE DELETE ON requester_notification_preferences
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_notification_mutes_insert BEFORE INSERT ON request_notification_mutes
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_notification_mutes_update BEFORE UPDATE ON request_notification_mutes
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_notification_mutes_delete BEFORE DELETE ON request_notification_mutes
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_events_insert BEFORE INSERT ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_events_update BEFORE UPDATE ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_events_delete BEFORE DELETE ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_intents_insert BEFORE INSERT ON notification_intents
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_intents_update BEFORE UPDATE ON notification_intents
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_intents_delete BEFORE DELETE ON notification_intents
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_batches_insert BEFORE INSERT ON notification_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_batches_update BEFORE UPDATE ON notification_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_batches_delete BEFORE DELETE ON notification_batches
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_attempts_insert BEFORE INSERT ON notification_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_attempts_update BEFORE UPDATE ON notification_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_attempts_delete BEFORE DELETE ON notification_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
-- Maintenance must not export/restore under an in-flight provider attempt.
CREATE TRIGGER data_wait_for_notification_writers BEFORE UPDATE OF phase ON data_state
WHEN OLD.phase='idle' AND NEW.phase!='idle' AND EXISTS(SELECT 1 FROM notification_batches WHERE state='sending')
BEGIN SELECT RAISE(ABORT,'notification_writer_active'); END;
