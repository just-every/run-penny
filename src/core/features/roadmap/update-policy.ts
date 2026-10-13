import { visibleRequestIds } from '../releases/publication-policy'
export const validRoadmapUpdateDraft=`EXISTS(SELECT 1 FROM roadmap_publications p WHERE p.id=v.approval_id AND p.roadmap_item_id=v.roadmap_item_id
 AND p.approved_at=v.approval_at AND p.updated_at=v.approval_updated_at AND p.withdrawn_at IS NULL
 AND p.public_title=v.title AND p.public_summary=v.problem AND p.public_slug=v.public_slug)
 AND NOT EXISTS(SELECT 1 FROM roadmap_update_targets t LEFT JOIN roadmap_request_mappings m ON m.roadmap_item_id=v.roadmap_item_id AND m.request_id=t.request_id
 WHERE t.version_id=v.id AND (m.request_id IS NULL OR m.approved_at IS NOT t.approval_at OR m.updated_at IS NOT t.approval_updated_at OR m.withdrawn_at IS NOT NULL OR t.request_id NOT IN(${visibleRequestIds})))
 AND NOT EXISTS(SELECT 1 FROM roadmap_request_mappings m WHERE m.roadmap_item_id=v.roadmap_item_id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM roadmap_update_targets t WHERE t.version_id=v.id AND t.request_id=m.request_id))`
