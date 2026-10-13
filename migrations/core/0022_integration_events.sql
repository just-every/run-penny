CREATE TABLE penny_integration_destinations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN('webhook','slack','receiver')),
 events_json TEXT NOT NULL, native_operator_id TEXT NOT NULL, operator_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE TABLE penny_integration_credentials (
 id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, signing_key TEXT
);
CREATE TABLE penny_effect_suppression (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1)
);
CREATE TABLE penny_integration_events (
 id TEXT PRIMARY KEY, event TEXT NOT NULL, request_id TEXT REFERENCES requests(id),
 comment_id TEXT REFERENCES request_comments(id), status_id TEXT REFERENCES request_status_updates(id),
 release_id TEXT REFERENCES releases(id), version_id TEXT REFERENCES release_versions(id),
 created_at INTEGER NOT NULL, held INTEGER NOT NULL DEFAULT 0 CHECK(held IN(0,1))
);
CREATE TABLE penny_integration_targets (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES penny_integration_events(id), destination_id TEXT NOT NULL,
 UNIQUE(event_id,destination_id)
);
CREATE TRIGGER penny_event_targets AFTER INSERT ON penny_integration_events
WHEN NEW.held=0
BEGIN
 INSERT INTO penny_integration_targets(id,event_id,destination_id)
 SELECT NEW.id||':'||d.id,NEW.id,d.id FROM penny_integration_destinations d JOIN oa_operators o ON o.id=d.native_operator_id
 WHERE d.kind IN('webhook','slack') AND d.revoked_at IS NULL AND o.status='active' AND o.version=d.operator_version
 AND NEW.event IN(SELECT value FROM json_each(d.events_json));
END;
CREATE TABLE penny_integration_receipts (
 namespace TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 request_id TEXT NOT NULL REFERENCES requests(id), note_id TEXT NOT NULL REFERENCES request_notes(id),
 received_at INTEGER NOT NULL, PRIMARY KEY(namespace,id)
);
CREATE TRIGGER penny_event_request AFTER UPDATE OF published_at ON requests
 WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NOT EXISTS(SELECT 1 FROM penny_effect_suppression) AND OLD.published_at IS NULL AND NEW.published_at IS NOT NULL AND NEW.moderation_state='approved'
 AND NEW.withdrawn_at IS NULL AND NEW.merged_into_request_id IS NULL AND EXISTS(SELECT 1 FROM boards WHERE id=NEW.board_id AND visibility='public')
 BEGIN INSERT OR IGNORE INTO penny_integration_events(id,event,request_id,created_at) VALUES('request:'||NEW.id,'request.published',NEW.id,unixepoch()*1000); END;
CREATE TRIGGER penny_event_comment_insert AFTER INSERT ON request_comments
 WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NOT EXISTS(SELECT 1 FROM penny_effect_suppression) AND NEW.moderation_state='approved' AND NEW.published_at IS NOT NULL AND NEW.historical_private=0
 AND (NEW.requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters WHERE id=NEW.requester_id AND blocked_at IS NULL)) AND EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=NEW.request_id AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters u WHERE u.id=r.author_requester_id AND u.blocked_at IS NULL)))
 BEGIN INSERT OR IGNORE INTO penny_integration_events(id,event,request_id,comment_id,created_at) VALUES('comment:'||NEW.id,'comment.published',NEW.request_id,NEW.id,unixepoch()*1000); END;
CREATE TRIGGER penny_event_comment_update AFTER UPDATE OF published_at,moderation_state ON request_comments
 WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NOT EXISTS(SELECT 1 FROM penny_effect_suppression) AND NEW.moderation_state='approved' AND NEW.published_at IS NOT NULL AND NEW.historical_private=0
 AND (NEW.requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters WHERE id=NEW.requester_id AND blocked_at IS NULL)) AND EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=NEW.request_id AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters u WHERE u.id=r.author_requester_id AND u.blocked_at IS NULL)))
 BEGIN INSERT OR IGNORE INTO penny_integration_events(id,event,request_id,comment_id,created_at) VALUES('comment:'||NEW.id,'comment.published',NEW.request_id,NEW.id,unixepoch()*1000); END;
CREATE TRIGGER penny_event_status AFTER INSERT ON request_status_updates
 WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NOT EXISTS(SELECT 1 FROM penny_effect_suppression) AND EXISTS(SELECT 1 FROM requests r JOIN boards b ON b.id=r.board_id WHERE r.id=NEW.request_id AND b.visibility='public' AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters u WHERE u.id=r.author_requester_id AND u.blocked_at IS NULL)))
 BEGIN INSERT OR IGNORE INTO penny_integration_events(id,event,request_id,status_id,created_at) VALUES('status:'||NEW.id,'status.published',NEW.request_id,NEW.id,unixepoch()*1000); END;
CREATE TRIGGER penny_event_release AFTER UPDATE OF state ON releases
 WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NOT EXISTS(SELECT 1 FROM penny_effect_suppression) AND OLD.state='draft' AND NEW.state='published'
 AND EXISTS(SELECT 1 FROM release_versions WHERE id=NEW.current_version_id AND snapshot_sealed_at IS NOT NULL)
 BEGIN INSERT OR IGNORE INTO penny_integration_events(id,event,release_id,version_id,created_at) VALUES('release:'||NEW.current_version_id,'release.published',NEW.id,NEW.current_version_id,unixepoch()*1000); END;
CREATE TRIGGER data_guard_penny_integration_destinations_insert BEFORE INSERT ON penny_integration_destinations
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_destinations_update BEFORE UPDATE ON penny_integration_destinations
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_destinations_delete BEFORE DELETE ON penny_integration_destinations
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_credentials_insert BEFORE INSERT ON penny_integration_credentials
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_credentials_update BEFORE UPDATE ON penny_integration_credentials
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_credentials_delete BEFORE DELETE ON penny_integration_credentials
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_events_insert BEFORE INSERT ON penny_integration_events
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_events_update BEFORE UPDATE ON penny_integration_events
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_events_delete BEFORE DELETE ON penny_integration_events
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_receipts_insert BEFORE INSERT ON penny_integration_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_receipts_update BEFORE UPDATE ON penny_integration_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_receipts_delete BEFORE DELETE ON penny_integration_receipts
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_targets_insert BEFORE INSERT ON penny_integration_targets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_targets_update BEFORE UPDATE ON penny_integration_targets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_penny_integration_targets_delete BEFORE DELETE ON penny_integration_targets
 WHEN (SELECT phase FROM data_state WHERE singleton=1)<>'idle' AND NOT EXISTS(SELECT 1 FROM data_apply_claims c JOIN data_state s ON s.lock_id=c.operation_id WHERE s.phase='applying')
 BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
