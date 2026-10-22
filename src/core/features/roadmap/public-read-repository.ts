import type { PublicCategoryReference } from '@/core/shared/api/public'
import type { PublicRoadmapItem } from '@/core/shared/api/public'
import type { DatabaseConnection } from '@/core/platform/database'
import { requestStatusExpression, requestStatusChangedAtExpression } from '../requests/status-sql'

interface RoadmapRow {
 slug: string; title: string; summary: string; status: PublicRoadmapItem['status']
 boardSlug: string | null; boardName: string | null; requests: string; releases: string
 category:string|null; source: 'requests' | null; voteCount: number | null; publicEta: string | null; statusLabel: string | null
}

export class PublicRoadmapReadRepository {
 private readonly connection:DatabaseConnection
 constructor(connection:DatabaseConnection){this.connection=connection}
 async list():Promise<readonly PublicRoadmapItem[]>{
  // Source, admission, status, headings and counts share one SQLite snapshot.
  // Request mappings are correlated inside the effective status expression,
  // so a mapped request still contributes exactly one card.
  const rows=await this.connection.binding.prepare(`WITH settings AS (
   SELECT * FROM penny_status_roadmap_settings WHERE singleton=1
  ), status_requests AS (
   SELECT r.slug,r.public_title AS title,r.public_description AS summary,
    ${requestStatusExpression} AS status,${requestStatusChangedAtExpression} AS statusChangedAt,
    b.slug AS boardSlug,b.name AS boardName,r.public_eta AS publicEta,
    CASE WHEN c.id IS NULL THEN NULL ELSE json_object('id',c.id,'name',c.name,'parent',CASE WHEN parent.id IS NULL THEN NULL ELSE json_object('id',parent.id,'name',parent.name) END) END AS category,
    CASE WHEN b.show_vote_counts=1 THEN (SELECT COUNT(*) FROM request_votes rv JOIN requesters voter ON voter.id=rv.requester_id AND voter.blocked_at IS NULL WHERE rv.request_id=r.id) END AS voteCount
   FROM requests r JOIN boards b ON b.id=r.board_id
   LEFT JOIN requesters author ON author.id=r.author_requester_id
   LEFT JOIN request_categories c ON c.id=r.category_id LEFT JOIN request_categories parent ON parent.id=c.parent_id
   CROSS JOIN settings s
   WHERE s.source='request_statuses' AND b.visibility='public' AND b.archived_at IS NULL
    AND r.moderation_state='approved' AND r.published_at IS NOT NULL
    AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
    AND (author.id IS NULL OR author.blocked_at IS NULL)
    AND (json_array_length(s.board_slugs_json)=0 OR b.slug IN (SELECT value FROM json_each(s.board_slugs_json)))
  ), cards AS (
   SELECT rp.public_slug AS slug,rp.public_title AS title,rp.public_summary AS summary,
   CASE WHEN ri.status='exploring' THEN 'under_review' ELSE ri.status END AS status,
   b.slug AS boardSlug,b.name AS boardName,
   (SELECT json_group_array(json_object('slug',safe.slug,'title',safe.public_title)) FROM (
    SELECT r.slug,r.public_title FROM roadmap_request_mappings m JOIN requests r ON r.id=m.request_id JOIN boards rb ON rb.id=r.board_id LEFT JOIN requesters a ON a.id=r.author_requester_id
    WHERE m.roadmap_item_id=ri.id AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL
     AND r.moderation_state='approved' AND r.published_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL
     AND rb.visibility='public' AND rb.archived_at IS NULL AND (a.id IS NULL OR a.blocked_at IS NULL) ORDER BY r.slug
   ) safe) AS requests,
   (SELECT json_group_array(json_object('slug',published.slug,'title',published.title)) FROM (
    SELECT r.slug,v.title FROM release_targets t JOIN releases r ON r.id=t.release_id
    JOIN release_versions v ON v.id=r.current_version_id AND v.is_portal_current=1
    WHERE t.roadmap_item_id=ri.id AND r.state='published' AND r.published_at IS NOT NULL AND v.publication_date IS NOT NULL
    ORDER BY v.publication_date DESC,r.slug
   ) published) AS releases,NULL AS category,NULL AS source,NULL AS voteCount,rp.public_eta AS publicEta,NULL AS statusLabel
   FROM roadmap_items ri JOIN roadmap_publications rp ON rp.roadmap_item_id=ri.id
   LEFT JOIN boards b ON b.id=rp.board_id
   CROSS JOIN settings s
   WHERE s.source='approved_items' AND rp.approved_at IS NOT NULL AND rp.withdrawn_at IS NULL AND rp.public_slug IS NOT NULL
    AND (rp.board_id IS NULL OR (b.visibility='public' AND b.archived_at IS NULL))
    AND ri.status IN ('exploring','planned','in_progress','shipped')
   UNION ALL
   SELECT r.slug,r.title,r.summary,r.status,r.boardSlug,r.boardName,
    json_array(json_object('slug',r.slug,'title',r.title)) AS requests,'[]' AS releases,r.category,'requests' AS source,r.voteCount,r.publicEta,
    json_extract(col.value,'$.label') AS statusLabel
   FROM status_requests r CROSS JOIN settings s JOIN json_each(s.columns_json) AS col
    ON json_extract(col.value,'$.status')=r.status AND json_extract(col.value,'$.visible')=1
   WHERE r.status IN ('under_review','planned','in_progress','shipped')
    AND (r.status<>'shipped' OR s.shipped_days IS NULL OR julianday(r.statusChangedAt)>=julianday('now')-s.shipped_days)
  ) SELECT * FROM cards
   ORDER BY CASE status WHEN 'under_review' THEN 1 WHEN 'planned' THEN 2 WHEN 'in_progress' THEN 3 ELSE 4 END,slug`).all<RoadmapRow>()
  return rows.results.map(({requests,releases,boardSlug,boardName,source,voteCount,publicEta,statusLabel,category,...safe})=>({
   ...safe,publicEta,...(boardSlug?{board:{slug:boardSlug,name:boardName!}}:{}),requests:JSON.parse(requests),releases:JSON.parse(releases),
   ...(source==='requests'?{source,category:category?JSON.parse(category) as PublicCategoryReference:null,...(voteCount===null?{}:{voteCount:Number(voteCount)}),publicEta,...(statusLabel?{statusLabel}:{})}:{}),
  }))
 }
 async find(slug:string){return (await this.list()).find(item=>item.slug===slug)??null}
}
