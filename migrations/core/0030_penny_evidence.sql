-- Evidence uses its existing immutable version and original attachment records.
ALTER TABLE evidence_items ADD COLUMN release_id TEXT REFERENCES releases(id);
CREATE INDEX evidence_release_idx ON evidence_items(release_id);
CREATE TABLE evidence_attachment_uploads (
 id TEXT PRIMARY KEY NOT NULL,
 evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
 storage_key TEXT NOT NULL UNIQUE,
 original_filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 byte_size INTEGER NOT NULL,
 sha256 TEXT NOT NULL,
 writing INTEGER NOT NULL CHECK(writing IN(0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TRIGGER data_guard_evidence_upload_insert BEFORE INSERT ON evidence_attachment_uploads
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_evidence_upload_update BEFORE UPDATE ON evidence_attachment_uploads
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_evidence_upload_delete BEFORE DELETE ON evidence_attachment_uploads
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_wait_for_evidence_writers BEFORE UPDATE OF phase ON data_state
WHEN OLD.phase='idle' AND NEW.phase!='idle' AND EXISTS(SELECT 1 FROM evidence_attachment_uploads WHERE writing=1)
BEGIN SELECT RAISE(ABORT,'attachment_writer_active'); END;
CREATE TRIGGER evidence_attachment_private_insert BEFORE INSERT ON attachments
WHEN NEW.evidence_id IS NOT NULL AND NEW.public_state!='operator_only'
BEGIN SELECT RAISE(ABORT,'evidence_attachment_private'); END;
CREATE TRIGGER evidence_attachment_private_update BEFORE UPDATE ON attachments
WHEN NEW.evidence_id IS NOT NULL AND NEW.public_state!='operator_only'
BEGIN SELECT RAISE(ABORT,'evidence_attachment_private'); END;
