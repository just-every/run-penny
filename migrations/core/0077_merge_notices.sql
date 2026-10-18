-- Expand the event discriminant without changing any retained event or FK.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE penny_event_upgrade AS SELECT rowid AS original_rowid,* FROM notification_events;
DROP TABLE notification_events;
CREATE TABLE notification_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES requests(id),
 kind TEXT NOT NULL CHECK(kind IN('status','comment','merge')), subject_id TEXT NOT NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 roadmap_update_version_id TEXT REFERENCES roadmap_update_versions(id)
);
INSERT INTO notification_events(rowid,id,request_id,kind,subject_id,body,created_at,updated_at,roadmap_update_version_id)
 SELECT original_rowid,id,request_id,kind,subject_id,body,created_at,updated_at,roadmap_update_version_id FROM penny_event_upgrade;
DROP TABLE penny_event_upgrade;
CREATE TRIGGER notification_recipient_intent AFTER INSERT ON notification_events
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.roadmap_update_version_id IS NULL AND NEW.kind<>'merge'
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
CREATE TABLE penny_merge_notices (
 merge_id TEXT PRIMARY KEY REFERENCES request_merges(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), queued_at TEXT, restoration_hold_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE penny_merge_notice_recipients (
 merge_id TEXT NOT NULL REFERENCES penny_merge_notices(merge_id) ON DELETE CASCADE,
 requester_id TEXT NOT NULL REFERENCES requesters(id) ON DELETE CASCADE,
 address_id TEXT NOT NULL REFERENCES requester_addresses(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(merge_id,requester_id)
);
CREATE TRIGGER notification_merge_recipient_intent AFTER INSERT ON notification_events
WHEN NEW.kind='merge' AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO notification_intents(event_id,requester_id,address_id,created_at,updated_at)
 SELECT NEW.id,requester_id,address_id,NEW.created_at,NEW.created_at FROM penny_merge_notice_recipients WHERE merge_id=NEW.subject_id;
END;
CREATE TRIGGER data_guard_notification_events_insert BEFORE INSERT ON notification_events
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_notification_events_insert AFTER INSERT ON notification_events
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_notification_events_update BEFORE UPDATE ON notification_events
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_notification_events_update AFTER UPDATE ON notification_events
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_notification_events_delete BEFORE DELETE ON notification_events
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_notification_events_delete AFTER DELETE ON notification_events
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notices_insert BEFORE INSERT ON penny_merge_notices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notices_insert AFTER INSERT ON penny_merge_notices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notices_update BEFORE UPDATE ON penny_merge_notices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notices_update AFTER UPDATE ON penny_merge_notices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notices_delete BEFORE DELETE ON penny_merge_notices
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notices_delete AFTER DELETE ON penny_merge_notices
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notice_recipients_insert BEFORE INSERT ON penny_merge_notice_recipients
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notice_recipients_insert AFTER INSERT ON penny_merge_notice_recipients
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notice_recipients_update BEFORE UPDATE ON penny_merge_notice_recipients
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notice_recipients_update AFTER UPDATE ON penny_merge_notice_recipients
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
CREATE TRIGGER data_guard_penny_merge_notice_recipients_delete BEFORE DELETE ON penny_merge_notice_recipients
WHEN NOT EXISTS(SELECT 1 FROM data_state s WHERE s.singleton=1 AND (s.phase='idle' OR (s.phase='applying' AND EXISTS(SELECT 1 FROM data_apply_claims c WHERE c.operation_id=s.lock_id))))
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER feedback_native_penny_merge_notice_recipients_delete AFTER DELETE ON penny_merge_notice_recipients
BEGIN UPDATE feedback_import_native_revision SET revision=revision+1 WHERE singleton=1; END;
