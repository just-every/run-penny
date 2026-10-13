-- Add release delivery without enrolling historical outbox rows.
ALTER TABLE notification_events ADD COLUMN roadmap_update_version_id TEXT REFERENCES roadmap_update_versions(id);
CREATE TABLE roadmap_update_histories (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES roadmap_update_versions(id), request_id TEXT NOT NULL REFERENCES requests(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(version_id,request_id)
);
CREATE TABLE roadmap_update_contexts (
 version_id TEXT NOT NULL REFERENCES roadmap_update_versions(id), requester_id TEXT NOT NULL REFERENCES requesters(id),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), request_id TEXT NOT NULL REFERENCES requests(id),
 title TEXT NOT NULL, slug TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(version_id,requester_id,request_id)
);
CREATE TABLE release_target_snapshots (
 version_id TEXT NOT NULL REFERENCES release_versions(id), roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
 decision_id TEXT NOT NULL REFERENCES decisions(id), request_id TEXT NOT NULL REFERENCES requests(id),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(version_id,roadmap_item_id,request_id)
);
CREATE TABLE release_recipient_contexts (
 snapshot_id TEXT NOT NULL REFERENCES release_recipient_snapshots(id), request_id TEXT NOT NULL REFERENCES requests(id),
 roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id), title TEXT NOT NULL, slug TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(snapshot_id,request_id,roadmap_item_id)
);
ALTER TABLE release_versions ADD COLUMN publication_claim TEXT;
ALTER TABLE release_versions ADD COLUMN author_name TEXT;
ALTER TABLE release_versions ADD COLUMN tag_names_json TEXT;
UPDATE release_versions SET author_name=(SELECT o.display_name FROM releases r JOIN operators o ON o.id=r.author_operator_id WHERE r.id=release_id),
 tag_names_json=(SELECT json_group_array(name) FROM (SELECT tag.name FROM tags tag JOIN json_each(subject_tags_json) selected ON tag.id=selected.value ORDER BY tag.name));
ALTER TABLE notification_outbox ADD COLUMN address_id TEXT REFERENCES requester_addresses(id);
ALTER TABLE notification_outbox ADD COLUMN release_snapshot_id TEXT REFERENCES release_recipient_snapshots(id);
ALTER TABLE notification_outbox ADD COLUMN claim_id TEXT;
ALTER TABLE notification_outbox ADD COLUMN provider TEXT;
ALTER TABLE notification_outbox ADD COLUMN provider_message_id TEXT;
ALTER TABLE notification_outbox ADD COLUMN first_attempt_at TEXT;
ALTER TABLE notification_outbox ADD COLUMN accepted_at TEXT;
ALTER TABLE notification_outbox ADD COLUMN delivered_at TEXT;
CREATE TABLE notification_outbox_attempts (
 id TEXT PRIMARY KEY, outbox_id TEXT NOT NULL REFERENCES notification_outbox(id), provider TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('sending','accepted','delivered','rejected','rate_limited','unknown','suppressed','failed')),
 provider_message_id TEXT, event_message_id TEXT, recipient_email TEXT, recipient_verification_epoch INTEGER, failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE notification_delivery_facts (
 batch_id TEXT PRIMARY KEY REFERENCES notification_batches(id), state TEXT NOT NULL CHECK(state IN('accepted','delivered','failed','suppressed')), accepted_at TEXT, delivered_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TRIGGER data_wait_for_release_writers BEFORE UPDATE OF phase ON data_state
WHEN OLD.phase='idle' AND NEW.phase!='idle' AND EXISTS(SELECT 1 FROM notification_outbox_attempts WHERE state='sending')
BEGIN SELECT RAISE(ABORT,'notification_writer_active'); END;
CREATE TRIGGER release_wording_immutable BEFORE UPDATE OF title,release_type,body,publication_date,setup_url,outcome_prompt,subject_tags_json,author_name,tag_names_json ON release_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM releases WHERE id=OLD.release_id AND state='published')
BEGIN SELECT RAISE(ABORT,'published wording is immutable'); END;
CREATE TRIGGER roadmap_wording_immutable BEFORE UPDATE OF public_status,title,problem,body,public_slug,approval_id,approval_at,approval_updated_at ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.published_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'published wording is immutable'); END;
CREATE TRIGGER data_guard_roadmap_update_contexts_insert BEFORE INSERT ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_contexts_update BEFORE UPDATE ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_contexts_delete BEFORE DELETE ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_target_snapshots_insert BEFORE INSERT ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_target_snapshots_update BEFORE UPDATE ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_target_snapshots_delete BEFORE DELETE ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_recipient_contexts_insert BEFORE INSERT ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_recipient_contexts_update BEFORE UPDATE ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_recipient_contexts_delete BEFORE DELETE ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_outbox_attempts_insert BEFORE INSERT ON notification_outbox_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_outbox_attempts_update BEFORE UPDATE ON notification_outbox_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_outbox_attempts_delete BEFORE DELETE ON notification_outbox_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_delivery_facts_insert BEFORE INSERT ON notification_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_delivery_facts_update BEFORE UPDATE ON notification_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_notification_delivery_facts_delete BEFORE DELETE ON notification_delivery_facts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;

ALTER TABLE release_recipient_snapshots ADD COLUMN recipient_email TEXT;
ALTER TABLE release_recipient_snapshots ADD COLUMN verification_epoch INTEGER;
CREATE TRIGGER release_identity_merge_guard BEFORE INSERT ON requester_identity_merges
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
 AND EXISTS(SELECT 1 FROM notification_outbox n JOIN notification_outbox_attempts a ON a.id=n.claim_id
 WHERE a.state='sending' AND n.requester_id IN(NEW.source_requester_id,NEW.target_requester_id))
BEGIN SELECT RAISE(ABORT,'identity_merge_notification_active'); END;
-- Extend genuine Base storage custody to release deliveries, preserving every old row.
CREATE TABLE mail_event_records_next (
 id TEXT PRIMARY KEY, value_json TEXT NOT NULL CHECK(json_valid(value_json)),
 address_id TEXT NOT NULL REFERENCES requester_addresses(id), batch_id TEXT REFERENCES notification_batches(id),
 outbox_id TEXT REFERENCES notification_outbox(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((batch_id IS NULL)!=(outbox_id IS NULL))
);
INSERT INTO mail_event_records_next(id,value_json,address_id,batch_id,created_at,updated_at)
 SELECT id,value_json,address_id,batch_id,created_at,updated_at FROM mail_event_records;
DROP TABLE mail_event_records;
ALTER TABLE mail_event_records_next RENAME TO mail_event_records;

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
CREATE TRIGGER data_guard_roadmap_update_histories_insert BEFORE INSERT ON roadmap_update_histories WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_histories_update BEFORE UPDATE ON roadmap_update_histories WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_roadmap_update_histories_delete BEFORE DELETE ON roadmap_update_histories WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_insert BEFORE INSERT ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_update BEFORE UPDATE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_mail_event_records_delete BEFORE DELETE ON mail_event_records WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
ALTER TABLE release_targets ADD COLUMN approval_id TEXT;
ALTER TABLE release_targets ADD COLUMN approval_at TEXT;
ALTER TABLE release_targets ADD COLUMN approval_updated_at TEXT;
ALTER TABLE release_targets ADD COLUMN public_title TEXT;
ALTER TABLE release_targets ADD COLUMN public_summary TEXT;
ALTER TABLE release_targets ADD COLUMN public_slug TEXT;
CREATE TABLE release_draft_mappings (
 release_id TEXT NOT NULL REFERENCES releases(id), roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id),
 request_id TEXT NOT NULL REFERENCES requests(id), approval_at TEXT NOT NULL, approval_updated_at TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(release_id,roadmap_item_id,request_id)
);
CREATE TRIGGER data_guard_release_draft_mappings_insert BEFORE INSERT ON release_draft_mappings WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_draft_mappings_update BEFORE UPDATE ON release_draft_mappings WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_release_draft_mappings_delete BEFORE DELETE ON release_draft_mappings WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER release_recipient_snapshots_immutable_update BEFORE UPDATE ON release_recipient_snapshots WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE v.id=OLD.release_version_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_recipient_snapshots_immutable_delete BEFORE DELETE ON release_recipient_snapshots WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE v.id=OLD.release_version_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_recipient_contexts_immutable_update BEFORE UPDATE ON release_recipient_contexts WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id JOIN releases r ON r.id=v.release_id WHERE s.id=OLD.snapshot_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_recipient_contexts_immutable_delete BEFORE DELETE ON release_recipient_contexts WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id JOIN releases r ON r.id=v.release_id WHERE s.id=OLD.snapshot_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_target_snapshots_immutable_update BEFORE UPDATE ON release_target_snapshots WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE v.id=OLD.version_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_target_snapshots_immutable_delete BEFORE DELETE ON release_target_snapshots WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM release_versions v JOIN releases r ON r.id=v.release_id WHERE v.id=OLD.version_id AND r.state='published') BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_targets_immutable_update BEFORE UPDATE ON roadmap_update_targets WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM roadmap_update_versions WHERE id=OLD.version_id AND published_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_targets_immutable_delete BEFORE DELETE ON roadmap_update_targets WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM roadmap_update_versions WHERE id=OLD.version_id AND published_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_contexts_immutable_update BEFORE UPDATE ON roadmap_update_contexts WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM roadmap_update_versions WHERE id=OLD.version_id AND published_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_contexts_immutable_delete BEFORE DELETE ON roadmap_update_contexts WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM roadmap_update_versions WHERE id=OLD.version_id AND published_at IS NOT NULL) BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
