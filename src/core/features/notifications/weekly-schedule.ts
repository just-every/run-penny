import type {PennyRuntime} from '@/core/app/runtime'
import {weeklyAudience} from './weekly-content'
/** Fixed UTC weeks end on Monday; quiet hours still use the workspace's IANA zone. */
export function completedWeek(now:number){
 const week=7*86400000,end=Math.floor((now-4*86400000)/week)*week+4*86400000
 return {start:new Date(end-week).toISOString(),end:new Date(end).toISOString()}
}
export async function prepareWeekly(runtime:PennyRuntime,now:number){
 const db=runtime.database.binding,period=completedWeek(now),at=new Date(now).toISOString()
 const rows=await db.prepare(`SELECT requester_id,MIN(address_id) AS address_id FROM (${weeklyAudience}) audience
 WHERE EXISTS(SELECT 1 FROM penny_weekly_summary WHERE singleton=1 AND enabled=1 AND enabled_at<?)
 AND NOT EXISTS(SELECT 1 FROM notification_outbox n WHERE n.dedupe_key='weekly:'||?||':'||audience.requester_id)
 AND (SELECT phase FROM data_state WHERE singleton=1)='idle' GROUP BY requester_id ORDER BY requester_id LIMIT 50`).bind(period.end,period.end).all<{requester_id:string;address_id:string}>()
 for(const person of rows.results){
  const id=`weekly:${period.end}:${person.requester_id}`
  await db.prepare(`INSERT OR IGNORE INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,address_id,created_at,updated_at)
  SELECT ?,'weekly_digest',?,1,?,?,?,'queued',?,?,?,? WHERE (SELECT phase FROM data_state WHERE singleton=1)='idle'`).bind(id,period.end,person.requester_id,id,JSON.stringify(period),at,person.address_id,at,at).run()
 }
}
