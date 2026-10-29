import type {PennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'
import {recordProxyVote} from '../requests/proxy-votes'
import {audit} from '../decisions/write-support'
import {type Capture} from './schema'

/** Manual extension work checkpoints before any automatic step. No source page
 * is fetched by Penny; a source check requires another explicit active-tab grant. */
export async function drainBrowserCaptures(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,epoch=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<number>('epoch')
 if(epoch===null)return
 const now=new Date(clock).toISOString(),maintenance={sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[epoch]}
 const jobs=guardedDatabase(raw,maintenance)
 await jobs.prepare("UPDATE penny_browser_captures SET state='failed',claim=NULL,failure='Capture was interrupted. Review and retry explicitly.',updated_at=? WHERE (state='running' OR state='uploading') AND updated_at<?").bind(now,new Date(clock-300000).toISOString()).run()
 for(const row of (await jobs.prepare("SELECT * FROM penny_browser_captures WHERE state='pending' ORDER BY created_at,id LIMIT 10").all<Capture>()).results){
  const claim=crypto.randomUUID(),claimed=await jobs.prepare("UPDATE penny_browser_captures SET state='running',claim=?,started_at=?,updated_at=? WHERE id=? AND state='pending' RETURNING id").bind(claim,now,now,row.id).all()
  if(!claimed.results.length)continue
  const db=guardedDatabase(raw,{sql:`${maintenance.sql} AND EXISTS(SELECT 1 FROM penny_browser_captures b JOIN penny_browser_authority a ON a.capture_id=b.id JOIN oa_sessions s ON s.id=a.session_id JOIN oa_operators o ON o.id=a.owner_id WHERE b.id=? AND b.state='running' AND b.claim=? AND b.source_state NOT IN('removed','purged') AND s.operator_id=a.owner_id AND s.revoked_at IS NULL AND s.expires_at>unixepoch('subsec')*1000 AND o.status='active' AND o.version=a.owner_version AND s.operator_version=o.version)`,params:[epoch,row.id,claim]})
  try{
   if(row.proxy_vote){
    const source=await db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=? ORDER BY version_number DESC LIMIT 1').bind(row.evidence_id).first<string>('wording')
    await recordProxyVote(db,row.request_id!,{requesterId:row.requester_id!,source:(source??'Browser capture').slice(0,2000),sourceUrl:row.page_url,evidenceId:row.evidence_id},row.actor_id!)
   }
   await db.batch([db.prepare("UPDATE penny_browser_captures SET state='done',claim=NULL,failure=NULL,updated_at=? WHERE id=? AND claim=?").bind(now,row.id,claim),audit(db,row.actor_id!,'evidence',row.evidence_id,'browser.capture_completed',now)])
  }catch{
   await jobs.prepare("UPDATE penny_browser_captures SET state='failed',claim=NULL,failure='Capture could not finish. Check your session, customer and request, then retry explicitly.',updated_at=? WHERE id=? AND claim=?").bind(now,row.id,claim).run()
  }
 }
 // Purge captured wording after the per-source owner policy window. This is
 // monotonic and idempotent; source removal can never be undone by a late check.
 for(const row of (await jobs.prepare("SELECT * FROM penny_browser_captures WHERE source_state='removed' AND purge_at<=? ORDER BY purge_at,id LIMIT 10").bind(now).all<Capture>()).results){
  try{await jobs.batch([
   jobs.prepare("UPDATE penny_proxy_votes SET source='[Source removed]',updated_at=? WHERE evidence_id=?").bind(now,row.evidence_id),
   jobs.prepare("UPDATE evidence_versions SET wording='[Source removed]',updated_at=? WHERE evidence_id=?").bind(now,row.evidence_id),
   jobs.prepare("UPDATE penny_browser_captures SET source_state='purged',state=CASE WHEN state='done' THEN state ELSE 'stopped' END,claim=NULL,failure=NULL,updated_at=? WHERE id=? AND source_state='removed'").bind(now,row.id),
   audit(jobs,row.actor_id??'browser-capture','evidence',row.evidence_id,'browser.source_purged',now),
  ])}catch{await jobs.prepare("UPDATE penny_browser_captures SET failure='The removed source excerpt could not be purged. Check database and audit storage; the next schedule retries.',updated_at=? WHERE id=? AND source_state='removed'").bind(now,row.id).run()}
 }
}
