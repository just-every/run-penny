-- Direct status remains separate from the latest approved roadmap projection.
CREATE TABLE request_internal_statuses (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, public_status TEXT NOT NULL CHECK(public_status IN ('open','under_review','planned','in_progress','shipped','declined')),
 show_public_label INTEGER NOT NULL DEFAULT 0 CHECK(show_public_label IN (0,1)), position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE request_status_templates (
 public_status TEXT PRIMARY KEY CHECK(public_status IN ('open','under_review','planned','in_progress','shipped','declined')),
 body TEXT NOT NULL, updated_at TEXT NOT NULL
);
ALTER TABLE requests ADD COLUMN internal_status_id TEXT REFERENCES request_internal_statuses(id);
ALTER TABLE requests ADD COLUMN public_eta TEXT;
ALTER TABLE requests ADD COLUMN direct_status_changed_at TEXT;
ALTER TABLE requests ADD COLUMN mapped_status_changed_at TEXT;
ALTER TABLE requests ADD COLUMN latest_status_source TEXT NOT NULL DEFAULT 'direct' CHECK(latest_status_source IN ('direct','roadmap'));
ALTER TABLE request_status_updates ADD COLUMN public_eta TEXT;
ALTER TABLE request_status_updates ADD COLUMN internal_status_id TEXT REFERENCES request_internal_statuses(id);
ALTER TABLE request_status_updates ADD COLUMN previous_status_source TEXT;
ALTER TABLE request_status_updates ADD COLUMN previous_direct_status_changed_at TEXT;
ALTER TABLE request_status_updates ADD COLUMN previous_internal_status_id TEXT REFERENCES request_internal_statuses(id);
UPDATE requests SET direct_status_changed_at=COALESCE((SELECT MAX(published_at) FROM request_status_updates WHERE request_id=requests.id),published_at);
UPDATE requests SET latest_status_source='roadmap',mapped_status_changed_at=(
 SELECT MAX(m.approved_at,p.approved_at,COALESCE((SELECT MAX(created_at) FROM roadmap_transitions WHERE roadmap_item_id=i.id),p.approved_at))
 FROM roadmap_request_mappings m JOIN roadmap_publications p ON p.roadmap_item_id=m.roadmap_item_id JOIN roadmap_items i ON i.id=m.roadmap_item_id
 WHERE m.request_id=requests.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL AND i.status!='dropped'
) WHERE EXISTS(SELECT 1 FROM roadmap_request_mappings m JOIN roadmap_publications p ON p.roadmap_item_id=m.roadmap_item_id
 WHERE m.request_id=requests.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL);

CREATE VIEW penny_request_status AS
 WITH mapped AS (
 SELECT r.id AS request_id,r.public_state,r.latest_status_source,r.direct_status_changed_at,r.mapped_status_changed_at,
  i.status AS roadmap_status,s.name AS internal_name,s.show_public_label,s.public_status AS internal_public_status
 FROM requests r LEFT JOIN request_internal_statuses s ON s.id=r.internal_status_id
 LEFT JOIN roadmap_request_mappings m ON m.request_id=r.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL
 LEFT JOIN roadmap_publications p ON p.roadmap_item_id=m.roadmap_item_id AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL
  AND (p.board_id IS NULL OR EXISTS(SELECT 1 FROM boards b WHERE b.id=p.board_id AND b.visibility='public' AND b.archived_at IS NULL))
 LEFT JOIN roadmap_items i ON i.id=p.roadmap_item_id AND i.status!='dropped'
 ), resolved AS (
 SELECT *,CASE WHEN public_state!='declined' AND latest_status_source='roadmap' AND roadmap_status IS NOT NULL THEN 'roadmap' ELSE 'direct' END AS source FROM mapped
 )
 SELECT request_id,source,
 CASE WHEN source='roadmap' THEN CASE WHEN roadmap_status='exploring' THEN 'under_review' ELSE roadmap_status END ELSE public_state END AS status,
 CASE WHEN source='roadmap' THEN mapped_status_changed_at ELSE direct_status_changed_at END AS changed_at,
 CASE WHEN source='direct' AND show_public_label=1 AND internal_public_status=public_state THEN internal_name END AS public_label
 FROM resolved;

-- The source marker orders changes even when two actions share a millisecond.
CREATE TRIGGER request_status_mapping_insert AFTER INSERT ON roadmap_request_mappings
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.approved_at IS NOT NULL AND NEW.withdrawn_at IS NULL BEGIN
 UPDATE requests SET latest_status_source='roadmap',mapped_status_changed_at=NEW.approved_at WHERE id=NEW.request_id;
END;
CREATE TRIGGER request_status_mapping_update AFTER UPDATE OF approved_at,withdrawn_at ON roadmap_request_mappings
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.approved_at IS NOT NULL AND NEW.withdrawn_at IS NULL AND (NEW.approved_at IS NOT OLD.approved_at OR OLD.withdrawn_at IS NOT NULL) BEGIN
 UPDATE requests SET latest_status_source='roadmap',mapped_status_changed_at=NEW.approved_at WHERE id=NEW.request_id;
END;
CREATE TRIGGER request_status_roadmap_approval AFTER UPDATE OF approved_at,withdrawn_at ON roadmap_publications
WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.approved_at IS NOT NULL AND NEW.withdrawn_at IS NULL AND (NEW.approved_at IS NOT OLD.approved_at OR OLD.withdrawn_at IS NOT NULL) BEGIN
 UPDATE requests SET latest_status_source='roadmap',mapped_status_changed_at=NEW.approved_at WHERE id IN
 (SELECT request_id FROM roadmap_request_mappings WHERE roadmap_item_id=NEW.roadmap_item_id AND approved_at IS NOT NULL AND withdrawn_at IS NULL);
END;
CREATE TRIGGER request_status_roadmap_transition AFTER UPDATE OF status ON roadmap_items WHEN (SELECT phase FROM data_state WHERE singleton=1)='idle' AND NEW.status IS NOT OLD.status BEGIN
 UPDATE requests SET latest_status_source='roadmap',mapped_status_changed_at=NEW.updated_at WHERE id IN
 (SELECT m.request_id FROM roadmap_request_mappings m JOIN roadmap_publications p ON p.roadmap_item_id=m.roadmap_item_id
 WHERE m.roadmap_item_id=NEW.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL);
END;
CREATE TRIGGER data_guard_request_internal_statuses_insert BEFORE INSERT ON request_internal_statuses
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_internal_statuses_update BEFORE UPDATE ON request_internal_statuses
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_internal_statuses_delete BEFORE DELETE ON request_internal_statuses
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_status_templates_insert BEFORE INSERT ON request_status_templates
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_status_templates_update BEFORE UPDATE ON request_status_templates
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
CREATE TRIGGER data_guard_request_status_templates_delete BEFORE DELETE ON request_status_templates
WHEN (SELECT phase FROM data_state WHERE singleton=1)='locked' BEGIN SELECT RAISE(ABORT,'data maintenance in progress'); END;
