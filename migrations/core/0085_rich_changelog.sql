CREATE TABLE release_labels (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
ALTER TABLE release_versions ADD COLUMN public_labels_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(public_labels_json) AND json_type(public_labels_json)='array');
ALTER TABLE release_versions ADD COLUMN public_products_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(public_products_json) AND json_type(public_products_json)='array');
CREATE TRIGGER release_rich_wording_immutable BEFORE UPDATE OF public_labels_json,public_products_json ON release_versions
WHEN OLD.snapshot_sealed_at IS NOT NULL AND (SELECT phase FROM data_state WHERE singleton=1)='idle'
BEGIN SELECT RAISE(ABORT,'published wording is immutable'); END;
CREATE TABLE release_attachments (
 id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES releases(id),
 storage_key TEXT NOT NULL UNIQUE, original_filename TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp','image/gif')),
 byte_size INTEGER NOT NULL CHECK(byte_size > 0), sha256 TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('writing','pending','approved')),
 approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK((state='approved')=(approved_at IS NOT NULL))
);
CREATE INDEX release_attachments_release ON release_attachments(release_id);
CREATE TRIGGER release_attachment_bytes_immutable BEFORE UPDATE OF release_id,storage_key,original_filename,content_type,byte_size,sha256 ON release_attachments
BEGIN SELECT RAISE(ABORT,'release attachment bytes are immutable'); END;
CREATE TRIGGER release_attachment_approval_immutable BEFORE UPDATE OF state,approved_at ON release_attachments
WHEN OLD.state='approved' AND (NEW.state IS NOT OLD.state OR NEW.approved_at IS NOT OLD.approved_at)
BEGIN SELECT RAISE(ABORT,'release attachment approval is immutable'); END;
CREATE TRIGGER data_wait_for_release_image_writers BEFORE UPDATE OF phase ON data_state
WHEN OLD.phase='idle' AND NEW.phase!='idle' AND EXISTS(SELECT 1 FROM release_attachments WHERE state='writing')
BEGIN SELECT RAISE(ABORT,'attachment_writer_active'); END;
CREATE TRIGGER data_guard_release_images_insert BEFORE INSERT ON release_attachments
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_release_images_update BEFORE UPDATE ON release_attachments
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
CREATE TRIGGER data_guard_release_images_delete BEFORE DELETE ON release_attachments
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked'
BEGIN SELECT RAISE(ABORT,'data_maintenance'); END;
