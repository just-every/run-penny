-- Corrections share the original closed publication audience and target context.
ALTER TABLE release_versions ADD COLUMN original_publication_version_id TEXT REFERENCES release_versions(id);
ALTER TABLE release_versions ADD COLUMN delivery_requested_at TEXT;
UPDATE release_versions SET delivery_requested_at=snapshot_sealed_at WHERE snapshot_sealed_at IS NOT NULL;
CREATE TRIGGER release_original_publication_immutable BEFORE UPDATE OF original_publication_version_id ON release_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.snapshot_sealed_at IS NOT NULL
 AND NEW.original_publication_version_id IS NOT OLD.original_publication_version_id
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_delivery_command_immutable BEFORE UPDATE OF delivery_requested_at ON release_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.delivery_requested_at IS NOT NULL
 AND NEW.delivery_requested_at IS NOT OLD.delivery_requested_at
BEGIN SELECT RAISE(ABORT,'delivery command is immutable'); END;
CREATE INDEX release_outcomes_current ON release_outcomes(release_version_id,requester_id,roadmap_item_id,revision_number DESC);
