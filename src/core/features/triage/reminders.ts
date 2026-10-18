import { agingSql, agingItems } from './candidates'
import type { AgingItem } from './candidates'
export async function drainAging(db:D1Database,now=new Date().toISOString()) {
 // One statement rechecks live state, membership and the maintenance fence.
 // Unique custody survives repeated Cron calls and a worker restart.
 await db.prepare(`INSERT OR IGNORE INTO penny_triage_reminders(id,kind,request_id,evidence_id,comment_id,owner_operator_id,age_origin,age_step,created_at)
 SELECT lower(hex(randomblob(16))),a.kind,a.requestId,a.evidenceId,a.commentId,a.ownerId,a.since||':'||a.days,a.ageStep,?
 FROM (${agingSql}) a JOIN operators p ON p.id=a.ownerId JOIN oa_operators n ON n.email=p.email AND n.status='active'
 WHERE (SELECT phase FROM data_state WHERE singleton=1)='idle'`).bind(now,now).run()
}
export async function agingSummary(db:D1Database,actor:string,now=new Date().toISOString()) {
 const [items,reminders,snoozed]=await Promise.all([
  agingItems(db,now),
  db.prepare('SELECT kind,request_id requestId,evidence_id evidenceId,comment_id commentId,age_origin ageOrigin,age_step ageStep,created_at createdAt FROM penny_triage_reminders WHERE owner_operator_id=? ORDER BY created_at DESC LIMIT 200').bind(actor).all<{kind:AgingItem['kind'];requestId:string|null;evidenceId:string|null;commentId:string|null;ageOrigin:string;ageStep:number;createdAt:string}>(),
  db.prepare(`SELECT z.evidence_id id,z.until_at untilAt,COALESCE((SELECT wording FROM evidence_versions v WHERE v.evidence_id=e.id ORDER BY version_number DESC LIMIT 1),'Evidence') title FROM penny_evidence_snoozes z JOIN evidence_items e ON e.id=z.evidence_id WHERE z.until_at>? AND e.review_state='unreviewed' ORDER BY z.until_at`).bind(now).all<{id:string;untilAt:string;title:string}>(),
 ])
 const key=(item:Pick<AgingItem,'kind'|'requestId'|'evidenceId'|'commentId'>)=>[item.kind,item.requestId,item.evidenceId,item.commentId].join(':')
 return {items,snoozed:snoozed.results,reminders:reminders.results.flatMap(row=>{const item=items.find(item=>key(item)===key(row)&&`${item.since}:${item.days}`===row.ageOrigin&&item.ownerId===actor&&row.ageStep===item.ageStep);return item?[{...item,ageStep:row.ageStep,createdAt:row.createdAt}]:[]}),counts:{inbox:items.filter(i=>i.kind==='inbox').length,comment:items.filter(i=>i.kind==='comment').length,response:items.filter(i=>i.kind==='response').length,stale:items.filter(i=>i.kind==='stale').length}}
}
export type AgingSummary=Awaited<ReturnType<typeof agingSummary>>
