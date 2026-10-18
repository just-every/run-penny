export interface AgingItem {
 kind:'inbox'|'comment'|'response'|'stale'; id:string; requestId:string|null; evidenceId:string|null; commentId:string|null
 title:string; slug:string|null; status:string|null; since:string; days:number; ageStep:number; ownerId:string|null; ownerName:string|null
}
// The same live projection feeds flags and durable reminders, so a response,
// review, status transition, block or snooze clears attention without a sweep.
export const agingSql = `WITH clock AS (SELECT ? AS now), settings AS (SELECT * FROM penny_triage_settings WHERE singleton=1), candidates AS (
 SELECT 'inbox' kind,e.id,NULL requestId,e.id evidenceId,NULL commentId,
 COALESCE((SELECT wording FROM evidence_versions WHERE evidence_id=e.id ORDER BY version_number DESC LIMIT 1),'Evidence') title,
 NULL slug,NULL status,e.created_at since,s.inbox_days days,o.operator_id ownerId,p.display_name ownerName
 FROM evidence_items e CROSS JOIN settings s LEFT JOIN penny_evidence_owners o ON o.evidence_id=e.id LEFT JOIN operators p ON p.id=o.operator_id
 WHERE e.review_state='unreviewed' AND NOT EXISTS(SELECT 1 FROM penny_evidence_snoozes z,clock WHERE z.evidence_id=e.id AND z.until_at>clock.now)
 UNION ALL
 SELECT 'comment',c.id,r.id,NULL,c.id,r.title,r.slug,NULL,c.created_at,s.comment_days,o.operator_id,p.display_name
 FROM request_comments c JOIN requests r ON r.id=c.request_id JOIN boards b ON b.id=r.board_id JOIN requesters customer ON customer.id=c.requester_id
 CROSS JOIN settings s LEFT JOIN penny_request_owners o ON o.request_id=r.id LEFT JOIN operators p ON p.id=o.operator_id
 WHERE c.moderation_state!='rejected' AND customer.blocked_at IS NULL AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND r.moderation_state!='rejected' AND b.archived_at IS NULL
 AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters a WHERE a.id=r.author_requester_id AND a.blocked_at IS NULL))
 AND NOT EXISTS(SELECT 1 FROM request_comments reply WHERE reply.request_id=r.id AND reply.operator_id IS NOT NULL AND reply.moderation_state='approved' AND reply.published_at IS NOT NULL AND reply.created_at>=c.created_at)
 UNION ALL
 SELECT 'response',r.id,r.id,NULL,NULL,r.title,r.slug,ps.status,r.published_at,s.response_days,o.operator_id,p.display_name
 FROM requests r JOIN boards b ON b.id=r.board_id JOIN penny_request_status ps ON ps.request_id=r.id JOIN penny_triage_status_clock sc ON sc.request_id=r.id CROSS JOIN settings s
 LEFT JOIN penny_request_owners o ON o.request_id=r.id LEFT JOIN operators p ON p.id=o.operator_id
 WHERE r.published_at IS NOT NULL AND r.moderation_state='approved' AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.archived_at IS NULL AND ps.status NOT IN ('shipped','declined','withdrawn')
 AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters a WHERE a.id=r.author_requester_id AND a.blocked_at IS NULL))
 AND NOT EXISTS(SELECT 1 FROM request_comments c WHERE c.request_id=r.id AND c.operator_id IS NOT NULL AND c.moderation_state='approved' AND c.published_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM request_status_updates u WHERE u.request_id=r.id AND u.published_at IS NOT NULL)
 UNION ALL
 SELECT 'stale',r.id,r.id,NULL,NULL,r.title,r.slug,ps.status,sc.since_at,
 CASE ps.status WHEN 'under_review' THEN s.under_review_days WHEN 'planned' THEN s.planned_days ELSE s.in_progress_days END,o.operator_id,p.display_name
 FROM requests r JOIN boards b ON b.id=r.board_id JOIN penny_request_status ps ON ps.request_id=r.id JOIN penny_triage_status_clock sc ON sc.request_id=r.id CROSS JOIN settings s
 LEFT JOIN penny_request_owners o ON o.request_id=r.id LEFT JOIN operators p ON p.id=o.operator_id
 WHERE ps.status IN ('under_review','planned','in_progress') AND r.published_at IS NOT NULL AND r.moderation_state='approved' AND r.withdrawn_at IS NULL AND r.merged_into_request_id IS NULL AND b.archived_at IS NULL
 AND (r.author_requester_id IS NULL OR EXISTS(SELECT 1 FROM requesters a WHERE a.id=r.author_requester_id AND a.blocked_at IS NULL))
), aged AS (SELECT candidates.*,CAST((julianday(clock.now)-julianday(since))/days AS INTEGER) ageStep FROM candidates,clock WHERE julianday(clock.now)-julianday(since)>=days)
SELECT * FROM aged`
export async function agingItems(db:D1Database,now=new Date().toISOString()):Promise<AgingItem[]> {
 return (await db.prepare(`${agingSql} ORDER BY since,kind,id`).bind(now).all<AgingItem>()).results
}
