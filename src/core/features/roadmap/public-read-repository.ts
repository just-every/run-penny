import type { PublicRoadmapItem } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'

export class PublicRoadmapReadRepository {
 private readonly connection:DatabaseConnection
 constructor(connection:DatabaseConnection){this.connection=connection}
 async list():Promise<readonly PublicRoadmapItem[]>{
  // Admission, safe wording, status, board and request witnesses are one SQLite
  // snapshot. A withdrawal/private-board race cannot mix separately read data.
  const rows=await this.connection.binding.prepare(`SELECT rp.public_slug AS slug,rp.public_title AS title,rp.public_summary AS summary,
   CASE WHEN ri.status='exploring' THEN 'under_review' ELSE ri.status END AS status,
   b.slug AS boardSlug,b.name AS boardName,
   (SELECT json_group_array(json_object('slug',safe.slug,'title',safe.public_title)) FROM (
    SELECT r.slug,r.public_title FROM roadmap_request_mappings m JOIN requests r ON r.id=m.request_id JOIN boards rb ON rb.id=r.board_id LEFT JOIN requesters a ON a.id=r.author_requester_id
    WHERE m.roadmap_item_id=ri.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL
     AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
     AND rb.visibility='public' AND (a.id IS NULL OR a.blocked_at IS NULL) ORDER BY r.slug
   ) safe) AS requests
   FROM roadmap_items ri JOIN roadmap_publications rp ON rp.roadmap_item_id=ri.id
   LEFT JOIN boards b ON b.id=rp.board_id
   WHERE rp.approved_at IS NOT NULL AND rp.withdrawn_at IS NULL AND rp.public_slug IS NOT NULL
    AND (rp.board_id IS NULL OR (b.visibility='public' AND b.archived_at IS NULL))
    AND ri.status IN ('exploring','planned','in_progress','shipped')
   ORDER BY CASE ri.status WHEN 'exploring' THEN 1 WHEN 'planned' THEN 2 WHEN 'in_progress' THEN 3 ELSE 4 END,rp.public_slug`).all<{slug:string;title:string;summary:string;status:PublicRoadmapItem['status'];boardSlug:string|null;boardName:string|null;requests:string}>()
  return rows.results.map(({requests,boardSlug,boardName,...safe})=>({...safe,...(boardSlug?{board:{slug:boardSlug,name:boardName!}}:{}),requests:JSON.parse(requests)}))
 }
 async find(slug:string){return (await this.list()).find(item=>item.slug===slug)??null}
}
