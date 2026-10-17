-- Retained withdrawn/unpublished lifecycle states outrank an old mapping.
DROP VIEW penny_request_status;
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
 SELECT *,CASE WHEN public_state NOT IN ('declined','withdrawn','unpublished') AND latest_status_source='roadmap' AND roadmap_status IS NOT NULL THEN 'roadmap' ELSE 'direct' END AS source FROM mapped
 )
 SELECT request_id,source,
 CASE WHEN source='roadmap' THEN CASE WHEN roadmap_status='exploring' THEN 'under_review' ELSE roadmap_status END ELSE public_state END AS status,
 CASE WHEN source='roadmap' THEN mapped_status_changed_at ELSE direct_status_changed_at END AS changed_at,
 CASE WHEN source='direct' AND show_public_label=1 AND internal_public_status=public_state THEN internal_name END AS public_label
 FROM resolved;

