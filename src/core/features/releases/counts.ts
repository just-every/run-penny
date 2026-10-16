export interface DeliveryCounts {queued:number;sent:number;suppressed:number;failed:number;unknown:number;delivered:number}
export const emptyCounts=():DeliveryCounts=>({queued:0,sent:0,suppressed:0,failed:0,unknown:0,delivered:0})
export function counts(rows:{state:string;n:number}[]):DeliveryCounts {const result=emptyCounts();for(const row of rows){const key=row.state==='sending'?'queued':row.state==='accepted'?'sent':row.state;if(key in result)result[key as keyof DeliveryCounts]+=Number(row.n);if(key==='delivered')result.sent+=Number(row.n)}return result}
export async function releaseDeliveryCounts(db:D1Database,versionId:string){return counts((await db.prepare('SELECT delivery_state AS state,COUNT(*) AS n FROM notification_outbox WHERE subject_id=? AND release_snapshot_id IS NOT NULL GROUP BY delivery_state').bind(versionId).all<{state:string;n:number}>()).results)}
export interface RequestVersionDeliveryRow {requestId:string;versionId:string;title:string;publicStatus:string;publishedAt:string;state:string;delivered:number;requesterId:string|null}
// The scope is repository-owned SQL; values remain bound by each caller.
export const requestVersionDeliverySql=(requestIdsSql:string)=>`SELECT h.request_id AS requestId,v.id AS versionId,v.title,v.public_status AS publicStatus,v.published_at AS publishedAt,
 COALESCE(facts.state,b.state,'queued') AS state,CASE WHEN facts.state='delivered' THEN 1 ELSE 0 END AS delivered,i.requester_id AS requesterId
 FROM roadmap_update_histories h JOIN roadmap_update_versions v ON v.id=h.version_id
 LEFT JOIN roadmap_update_contexts c ON c.version_id=v.id AND c.request_id=h.request_id
 LEFT JOIN notification_intents i ON i.requester_id=c.requester_id AND i.event_id IN(SELECT id FROM notification_events WHERE roadmap_update_version_id=v.id)
 LEFT JOIN notification_batches b ON b.id=i.batch_id LEFT JOIN notification_delivery_facts facts ON facts.batch_id=b.id
 WHERE h.request_id IN (${requestIdsSql}) ORDER BY v.created_at,v.id`
export function requestVersionCounts(rows:RequestVersionDeliveryRow[]){
 const versions=new Map<string,{id:string;title:string;publicStatus:string;publishedAt:string;counts:DeliveryCounts;seen:Set<string>}>()
 for(const row of rows){let version=versions.get(row.versionId);if(!version){version={id:row.versionId,title:row.title,publicStatus:row.publicStatus,publishedAt:row.publishedAt,counts:emptyCounts(),seen:new Set()};versions.set(row.versionId,version)}
  if(row.requesterId&&!version.seen.has(row.requesterId)){version.seen.add(row.requesterId);const value=counts([{state:row.delivered?'delivered':row.state,n:1}]);for(const key of Object.keys(value) as (keyof DeliveryCounts)[])version.counts[key]+=value[key]}
 }
 return [...versions.values()].map(({seen,...version})=>{void seen;return version})
}
export async function requestVersionDeliveryCounts(db:D1Database,requestId:string){
 return requestVersionCounts((await db.prepare(requestVersionDeliverySql('?')).bind(requestId).all<RequestVersionDeliveryRow>()).results)
}
export const requestDeliverySql=(requestIdsSql:string)=>`SELECT e.request_id AS requestId,COALESCE(facts.state,b.state,'queued') AS state,COUNT(DISTINCT COALESCE(i.batch_id,'pending:'||i.event_id||':'||i.requester_id)) AS n
 FROM notification_intents i JOIN notification_events e ON e.id=i.event_id LEFT JOIN notification_batches b ON b.id=i.batch_id LEFT JOIN notification_delivery_facts facts ON facts.batch_id=b.id
 WHERE e.roadmap_update_version_id IS NULL AND e.request_id IN (${requestIdsSql}) GROUP BY e.request_id,COALESCE(facts.state,b.state,'queued')`
export async function requestDeliveryCounts(db:D1Database,requestId:string){
 const result=counts((await db.prepare(requestDeliverySql('?')).bind(requestId).all<{state:string;n:number}>()).results)
 for(const version of await requestVersionDeliveryCounts(db,requestId))for(const key of Object.keys(result) as (keyof DeliveryCounts)[])result[key]+=version.counts[key]
 return result
}
