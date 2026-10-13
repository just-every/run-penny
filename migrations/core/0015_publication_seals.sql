-- Completed publication owns a closed membership set, including after restore.
ALTER TABLE release_versions ADD COLUMN snapshot_sealed_at TEXT;
ALTER TABLE roadmap_update_versions ADD COLUMN snapshot_sealed_at TEXT;
ALTER TABLE roadmap_update_versions ADD COLUMN discarded_at TEXT;
-- Freeze every previously published aggregate, including those predating claims.
UPDATE release_versions SET snapshot_sealed_at=COALESCE((SELECT published_at FROM releases WHERE id=release_id),updated_at)
 WHERE EXISTS(SELECT 1 FROM releases WHERE id=release_id AND state='published');
UPDATE roadmap_update_versions SET snapshot_sealed_at=published_at WHERE published_at IS NOT NULL;
DROP TRIGGER release_wording_immutable;
CREATE TRIGGER release_wording_immutable BEFORE UPDATE OF title,release_type,body,publication_date,setup_url,outcome_prompt,subject_tags_json,author_name,tag_names_json ON release_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.snapshot_sealed_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'published wording is immutable'); END;
DROP TRIGGER roadmap_wording_immutable;
CREATE TRIGGER roadmap_wording_immutable BEFORE UPDATE OF public_status,title,problem,body,public_slug,approval_id,approval_at,approval_updated_at,discarded_at ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.snapshot_sealed_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'published wording is immutable'); END;
CREATE TRIGGER release_versions_seal_immutable BEFORE UPDATE OF snapshot_sealed_at,publication_claim ON release_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.snapshot_sealed_at IS NOT NULL
 AND (NEW.snapshot_sealed_at IS NOT OLD.snapshot_sealed_at OR NEW.publication_claim IS NOT OLD.publication_claim)
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_versions_seal_immutable BEFORE UPDATE OF snapshot_sealed_at,publication_claim ON roadmap_update_versions
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND OLD.snapshot_sealed_at IS NOT NULL
 AND (NEW.snapshot_sealed_at IS NOT OLD.snapshot_sealed_at OR NEW.publication_claim IS NOT OLD.publication_claim)
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_recipient_snapshots_immutable_insert BEFORE INSERT ON release_recipient_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=NEW.release_version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_recipient_snapshots_immutable_update;
CREATE TRIGGER release_recipient_snapshots_immutable_update BEFORE UPDATE ON release_recipient_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=OLD.release_version_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM release_versions v WHERE v.id=NEW.release_version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_recipient_snapshots_immutable_delete;
CREATE TRIGGER release_recipient_snapshots_immutable_delete BEFORE DELETE ON release_recipient_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=OLD.release_version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_recipient_contexts_immutable_insert BEFORE INSERT ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id WHERE s.id=NEW.snapshot_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_recipient_contexts_immutable_update;
CREATE TRIGGER release_recipient_contexts_immutable_update BEFORE UPDATE ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id WHERE s.id=OLD.snapshot_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id WHERE s.id=NEW.snapshot_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_recipient_contexts_immutable_delete;
CREATE TRIGGER release_recipient_contexts_immutable_delete BEFORE DELETE ON release_recipient_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_recipient_snapshots s JOIN release_versions v ON v.id=s.release_version_id WHERE s.id=OLD.snapshot_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER release_target_snapshots_immutable_insert BEFORE INSERT ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_target_snapshots_immutable_update;
CREATE TRIGGER release_target_snapshots_immutable_update BEFORE UPDATE ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM release_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER release_target_snapshots_immutable_delete;
CREATE TRIGGER release_target_snapshots_immutable_delete BEFORE DELETE ON release_target_snapshots
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM release_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_targets_immutable_insert BEFORE INSERT ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER roadmap_update_targets_immutable_update;
CREATE TRIGGER roadmap_update_targets_immutable_update BEFORE UPDATE ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER roadmap_update_targets_immutable_delete;
CREATE TRIGGER roadmap_update_targets_immutable_delete BEFORE DELETE ON roadmap_update_targets
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_contexts_immutable_insert BEFORE INSERT ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER roadmap_update_contexts_immutable_update;
CREATE TRIGGER roadmap_update_contexts_immutable_update BEFORE UPDATE ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
DROP TRIGGER roadmap_update_contexts_immutable_delete;
CREATE TRIGGER roadmap_update_contexts_immutable_delete BEFORE DELETE ON roadmap_update_contexts
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_histories_immutable_insert BEFORE INSERT ON roadmap_update_histories
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_histories_immutable_update BEFORE UPDATE ON roadmap_update_histories
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL) OR EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=NEW.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
CREATE TRIGGER roadmap_update_histories_immutable_delete BEFORE DELETE ON roadmap_update_histories
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND (EXISTS(SELECT 1 FROM roadmap_update_versions v WHERE v.id=OLD.version_id AND v.snapshot_sealed_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'published snapshot is immutable'); END;
