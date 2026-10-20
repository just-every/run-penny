import { currentModerationRequest } from '../requests/moderation-claim'
import { requestStatusExpression } from '../requests/status-sql'
import { readPlanning } from '../planning/repository'
import { windowEnd } from '../planning/risk'
import { PAGE_SIZE } from './list-query'
import type { LoopHealth,LoopHealthMetric,LoopHealthPage,LoopHealthRecord } from './loop-health-types'

/** Both figures and drilldowns use these same cohorts. Published timestamps,
 * rather than comment capture timestamps, measure when a response became public. */
const cohorts=`WITH public_responses AS (
 SELECT request_id,published_at AS response_at FROM request_comments WHERE moderation_state='approved' AND published_at IS NOT NULL
 UNION ALL SELECT request_id,published_at FROM request_status_updates
 UNION ALL SELECT h.request_id,v.published_at FROM roadmap_update_histories h JOIN roadmap_update_versions v ON v.id=h.version_id WHERE v.published_at IS NOT NULL
), delivered_snapshots AS (
 SELECT c.request_id,s.release_version_id FROM release_recipient_contexts c JOIN release_recipient_snapshots s ON s.id=c.snapshot_id
 JOIN release_versions v ON v.id=s.release_version_id JOIN releases published ON published.id=v.release_id AND published.state='published'
 GROUP BY c.request_id,s.release_version_id
 HAVING COUNT(DISTINCT s.id)=COUNT(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM notification_outbox n WHERE n.release_snapshot_id=s.id AND n.delivery_state='delivered') THEN s.id END)
), current_requests AS (
 SELECT r.id,r.slug,r.title,r.created_at,o.operator_id AS owner_operator_id,owner.display_name AS owner_name,${requestStatusExpression} AS status,
 (SELECT MIN(response_at) FROM public_responses p WHERE p.request_id=r.id AND julianday(p.response_at)>=julianday(r.created_at)) AS first_response,
 EXISTS(SELECT 1 FROM delivered_snapshots d WHERE d.request_id=r.id) AS notified
 FROM requests r LEFT JOIN penny_request_owners o ON o.request_id=r.id LEFT JOIN operators owner ON owner.id=o.operator_id
 WHERE ${currentModerationRequest('r')}
), measured AS (
 SELECT *,ROUND((julianday(first_response)-julianday(created_at))*86400,3) AS response_seconds FROM current_requests
), responses AS (
 SELECT *,ROW_NUMBER() OVER(ORDER BY response_seconds,id) AS position,COUNT(*) OVER() AS population FROM measured WHERE first_response IS NOT NULL
)`

async function promiseRecords(db:D1Database,today:string):Promise<LoopHealthRecord[]>{
 const planning=await readPlanning(db,today)
 return planning.items.flatMap(item=>{
  if(item.status==='shipped'||item.status==='dropped')return []
  const end=windowEnd(item.publicEta),reasons=[...(end&&end<today?[`Approved public ETA ${item.publicEta} is past due`]:[]),...item.risks.map(risk=>`${risk.title}: ${risk.reason}`)]
  return reasons.length?[{id:item.id,title:item.title,href:`/app/roadmap#roadmap-item-${encodeURIComponent(item.id)}`,detail:reasons.join('; ')}]:[]
 })
}

export async function loopHealthRead(db:D1Database,today:string):Promise<LoopHealth>{
 const [row,promises]=await Promise.all([
  db.prepare(`${cohorts} SELECT COUNT(*) AS total,COALESCE(SUM(owner_operator_id IS NOT NULL),0) AS owned,
   COALESCE(SUM(status='shipped'),0) AS shipped,COALESCE(SUM(status='shipped' AND notified=1),0) AS notified,
   (SELECT COUNT(*) FROM responses) AS responded,(SELECT AVG(response_seconds) FROM responses WHERE position IN ((population+1)/2,(population+2)/2)) AS medianSeconds FROM measured`).first<{total:number;owned:number;shipped:number;notified:number;responded:number;medianSeconds:number|null}>(),
  promiseRecords(db,today),
 ])
 const total=Number(row!.total),owned=Number(row!.owned),shipped=Number(row!.shipped),notified=Number(row!.notified)
 return {ownership:{owned,total,share:total?owned/total:0},firstResponse:{medianSeconds:row!.medianSeconds,responded:Number(row!.responded),total},notified:{notified,total:shipped,share:shipped?notified/shipped:0},promises:{atRisk:promises.length}}
}

export async function loopHealthRecords(db:D1Database,today:string,metric:LoopHealthMetric,page:number):Promise<LoopHealthPage>{
 if(metric==='promises'){
  const records=await promiseRecords(db,today)
  return {metric,page,pageSize:PAGE_SIZE,total:records.length,items:records.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)}
 }
 const where=metric==='response'?'WHERE first_response IS NOT NULL':metric==='notified'?"WHERE status='shipped'":''
 const detail=metric==='ownership'?"CASE WHEN owner_operator_id IS NULL THEN 'Unassigned' ELSE 'Owner: '||owner_name END":metric==='response'?"'First public response after '||printf('%.0f',response_seconds)||' seconds'":"CASE WHEN notified=1 THEN 'Fully delivered recipient snapshot' ELSE 'No fully delivered recipient snapshot' END"
 const [count,rows]=await db.batch([
  db.prepare(`${cohorts} SELECT COUNT(*) AS total FROM measured ${where}`),
  db.prepare(`${cohorts} SELECT id,title,slug,${detail} AS detail FROM measured ${where} ORDER BY title COLLATE NOCASE,id LIMIT ? OFFSET ?`).bind(PAGE_SIZE,(page-1)*PAGE_SIZE),
 ])
 return {metric,page,pageSize:PAGE_SIZE,total:Number((count.results[0] as {total:number}).total),items:(rows.results as {id:string;title:string;slug:string;detail:string}[]).map(row=>({id:row.id,title:row.title,href:`/app/moderation?item=${encodeURIComponent(row.id)}`,detail:row.detail}))}
}
