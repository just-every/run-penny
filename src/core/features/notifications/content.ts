import { eligibleRecipient,unmailedEvent,visibleEvent } from './eligibility'
export interface NotificationContent {email:string;title:string;slug:string;requestId:string;events:{kind:string;body:string}[]}
const ordinaryContext=`SELECT a.email,r.public_title AS title,r.slug,r.id AS requestId FROM notification_batches n
 JOIN requester_addresses a ON a.id=n.address_id JOIN requests r ON r.id=n.request_id JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id WHERE n.id=? AND ${eligibleRecipient}`
const groupedContext=`SELECT DISTINCT a.email,c.title,c.slug,v.id AS version_id,v.body,c.request_id,c.request_id AS requestId
 FROM notification_batches n JOIN notification_intents i ON i.batch_id=n.id JOIN notification_events e ON e.id=i.event_id
 JOIN roadmap_update_versions v ON v.id=e.roadmap_update_version_id
 JOIN roadmap_update_contexts c ON c.version_id=v.id AND c.requester_id=n.requester_id AND c.address_id=n.address_id
 JOIN requester_addresses a ON a.id=c.address_id JOIN requests r ON r.id=c.request_id JOIN boards b ON b.id=r.board_id
 LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE n.id=? AND v.published_at IS NOT NULL AND ${eligibleRecipient} AND ${unmailedEvent}
 AND EXISTS(SELECT 1 FROM roadmap_publications p JOIN roadmap_request_mappings m ON m.roadmap_item_id=p.roadmap_item_id
 WHERE p.roadmap_item_id=v.roadmap_item_id AND m.request_id=c.request_id AND p.approved_at IS NOT NULL AND p.withdrawn_at IS NULL
 AND m.approved_at IS NOT NULL AND m.withdrawn_at IS NULL)`
/** Used by discovery and final atomic admission. Alternate eligible owned contexts
 * keep a grouped update eligible even when its coalescing anchor is now muted. */
export const notificationPayloadSql=`WITH ordinary AS MATERIALIZED (${ordinaryContext}),
 grouped AS MATERIALIZED (${groupedContext}),
 events AS (
 SELECT e.kind,CASE WHEN e.kind='comment' THEN (SELECT body FROM request_comments WHERE id=e.subject_id)
 ELSE (SELECT body FROM request_status_updates WHERE id=e.subject_id) END AS body,e.created_at,e.id
 FROM notification_batches n JOIN notification_intents i ON i.batch_id=n.id JOIN notification_events e ON e.id=i.event_id
 WHERE n.id=? AND e.roadmap_update_version_id IS NULL AND EXISTS(SELECT 1 FROM ordinary) AND (${visibleEvent}) AND ${unmailedEvent}
 UNION ALL SELECT 'status',body||char(10)||char(10)||'Your requests:'||char(10)||group_concat(title||' (/portal/feedback/'||slug||')',char(10)),version_id,version_id
 FROM (SELECT * FROM grouped ORDER BY request_id) GROUP BY version_id,body),
 recipient AS (SELECT email,title,slug,requestId,0 AS priority FROM ordinary UNION ALL SELECT email,title,slug,requestId,1 AS priority FROM grouped)
 SELECT email,title,slug,requestId,(SELECT json_group_array(json_object('kind',kind,'body',body)) FROM (SELECT * FROM events ORDER BY created_at,id)) AS events
 FROM recipient WHERE EXISTS(SELECT 1 FROM events) ORDER BY priority,slug LIMIT 1`
export async function notificationContent(db:D1Database,batchId:string):Promise<NotificationContent|null>{
 const row=await db.prepare(notificationPayloadSql).bind(batchId,batchId,batchId).first<{email:string;title:string;slug:string;requestId:string;events:string}>()
 return row?{...row,events:JSON.parse(row.events)}:null
}
