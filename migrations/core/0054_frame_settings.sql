-- Installation-owned embedding policy; origins are public, authority is native.
CREATE TABLE penny_frame_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 public_origin_allowlist TEXT NOT NULL CHECK(json_valid(public_origin_allowlist)),
 updated_at TEXT NOT NULL
);

-- Retain minimal mail effect history independently of recipients/attempt rows.
-- Erasure redacts target references through audit_entries' existing custody.
-- Imported/restored histories carry their own audits and must not emit new ones.
CREATE TRIGGER penny_request_mail_audit_insert AFTER INSERT ON notification_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),'system','request_notifications','request_mail.attempt.'||NEW.state,'notification_batch',NEW.batch_id,NEW.created_at,NEW.created_at,NEW.created_at);
END;
CREATE TRIGGER penny_request_mail_audit_update AFTER UPDATE OF state ON notification_attempts
WHEN NEW.state<>OLD.state AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN
 INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),'system','request_notifications','request_mail.attempt.'||NEW.state,'notification_batch',NEW.batch_id,NEW.updated_at,NEW.updated_at,NEW.updated_at);
END;
CREATE TRIGGER penny_release_mail_audit_insert AFTER INSERT ON notification_outbox_attempts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM notification_outbox WHERE id=NEW.outbox_id AND event_type='release_version')
BEGIN
 INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),'system','release_notifications','release_mail.attempt.'||NEW.state,'notification_outbox',NEW.outbox_id,NEW.created_at,NEW.created_at,NEW.created_at);
END;
CREATE TRIGGER penny_release_mail_audit_update AFTER UPDATE OF state ON notification_outbox_attempts
WHEN NEW.state<>OLD.state AND (SELECT phase FROM data_state WHERE singleton=1)='idle' AND EXISTS(SELECT 1 FROM notification_outbox WHERE id=NEW.outbox_id AND event_type='release_version')
BEGIN
 INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
 VALUES(lower(hex(randomblob(16))),'system','release_notifications','release_mail.attempt.'||NEW.state,'notification_outbox',NEW.outbox_id,NEW.updated_at,NEW.updated_at,NEW.updated_at);
END;
