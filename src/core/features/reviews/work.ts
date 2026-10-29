import type {PennyRuntime} from '@/core/app/runtime'
import {guardedDatabase} from '../integrations/guarded-database'
import {readPage,sourcePresent} from './adapters'
import {capture,errorCode} from './capture'
import {workGuard,type Connection} from './configuration'
import {extractReviews} from './extraction'
export async function drainReviews(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,now=new Date(clock).toISOString(),state=await raw.prepare('SELECT phase,epoch FROM data_state WHERE singleton=1').first<{phase:string;epoch:number}>()
 if(!state||state.phase!=='idle')return
 const idle=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]})
 await idle.prepare("UPDATE penny_review_connections SET state='failed',failure='reviews_interrupted_retry_required',claim=NULL WHERE state='running' AND started_at<=?").bind(new Date(clock-300000).toISOString()).run()
 const connections=(await idle.prepare("SELECT * FROM penny_review_connections WHERE state='scheduled' AND next_due<=? ORDER BY next_due,id LIMIT 10").bind(now).all<Connection>()).results
 for(const c of connections){
  const claim=crypto.randomUUID(),admitted=await idle.prepare("UPDATE penny_review_connections SET state='running',claim=?,started_at=?,attempts=attempts+1 WHERE id=? AND revision=? AND state='scheduled' AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND role='owner' AND status='active') RETURNING id").bind(claim,now,c.id,c.revision,c.owner_id,c.owner_version).all()
  if(!admitted.results.length){await idle.prepare("UPDATE penny_review_connections SET state='failed',failure='reviews_owner_unavailable' WHERE id=? AND state='scheduled'").bind(c.id).run();continue}
  c.claim=claim;c.state='running';const db=guardedDatabase(raw,workGuard(c,state.epoch))
  try{
   const page=await readPage(runtime,c)
   if(page.reviews.length>100)throw Error('bounded_page')
   for(const r of page.reviews)await capture(runtime,c,state.epoch,r,clock)
   if(page.next===c.cursor&&page.next!==null)throw Error('cursor_did_not_advance')
   await db.prepare("UPDATE penny_review_connections SET state='scheduled',claim=NULL,cursor=?,next_due=?,last_success=CASE WHEN ? IS NULL THEN ? ELSE last_success END,failure=NULL,updated_at=? WHERE id=?").bind(page.next,page.next?now:new Date(clock+c.interval_hours*3600000).toISOString(),page.next,now,now,c.id).run()
  }catch(error){
   if(['reviews_access_revoked','reviews_listing_removed'].includes(errorCode(error))){
    try{await db.prepare("UPDATE penny_review_sources SET source_state='removed',removed_at=?,purge_at=?,check_claim=NULL,ai_claim=NULL,ai_state='stopped' WHERE connection_id=? AND source_state IN('current','changed')").bind(now,new Date(clock+c.purge_days*86400000).toISOString(),c.id).run()}catch{/* A newer owner/scope or erasure wins. */}
   }
   await idle.prepare("UPDATE penny_review_connections SET state='failed',claim=NULL,failure=?,updated_at=? WHERE id=? AND claim=? AND state='running'").bind(errorCode(error),now,c.id,claim).run()}
 }
 await checkSources(runtime,state.epoch,clock)
 await extractReviews(runtime,state.epoch,clock)
}
async function checkSources(runtime:PennyRuntime,epoch:number,clock:number){
 const raw=runtime.database.binding,now=new Date(clock).toISOString(),db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[epoch]})
 await db.prepare("UPDATE penny_review_sources SET check_claim=NULL,check_failure='reviews_interrupted_check_retry_required' WHERE check_claim IS NOT NULL AND check_started_at<=?").bind(new Date(clock-300000).toISOString()).run()
 const sources=(await db.prepare("SELECT s.evidence_id,s.review_id,s.review_url,c.* FROM penny_review_sources s JOIN penny_review_connections c ON c.id=s.connection_id JOIN oa_operators o ON o.id=c.owner_id WHERE s.source_state IN('current','changed') AND s.check_claim IS NULL AND s.check_failure IS NULL AND s.next_check<=? AND c.state='scheduled' AND o.status='active' AND o.role='owner' AND o.version=c.owner_version ORDER BY s.next_check LIMIT 10").bind(now).all<Connection&{evidence_id:string;review_id:string;review_url:string}>()).results
 for(const c of sources){
  const claim=crypto.randomUUID(),claimed=await db.prepare("UPDATE penny_review_sources SET check_claim=?,check_started_at=? WHERE evidence_id=? AND check_claim IS NULL AND check_failure IS NULL AND source_state IN('current','changed') RETURNING evidence_id").bind(claim,now,c.evidence_id).all();if(!claimed.results.length)continue
  const guarded=guardedDatabase(raw,{sql:`EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_review_connections c JOIN oa_operators o ON o.id=c.owner_id WHERE c.id=? AND c.revision=? AND c.state='scheduled' AND o.role='owner' AND o.status='active' AND o.version=c.owner_version) AND EXISTS(SELECT 1 FROM penny_review_sources WHERE evidence_id=? AND check_claim=?)`,params:[epoch,c.id,c.revision,c.evidence_id,claim]})
  try{const present=await sourcePresent(runtime,c,c.review_id,c.review_url)
   await guarded.prepare("UPDATE penny_review_sources SET source_state=CASE WHEN ? THEN source_state ELSE 'removed' END,removed_at=CASE WHEN ? THEN removed_at ELSE ? END,purge_at=CASE WHEN ? THEN purge_at ELSE ? END,next_check=?,check_claim=NULL,check_failure=NULL,ai_state=CASE WHEN ? THEN ai_state ELSE 'stopped' END,ai_claim=CASE WHEN ? THEN ai_claim ELSE NULL END WHERE evidence_id=?").bind(present?1:0,present?1:0,now,present?1:0,new Date(clock+c.purge_days*86400000).toISOString(),new Date(clock+86400000).toISOString(),present?1:0,present?1:0,c.evidence_id).run()
  }catch(error){await db.prepare('UPDATE penny_review_sources SET check_failure=?,check_claim=NULL WHERE evidence_id=? AND check_claim=?').bind(errorCode(error),c.evidence_id,claim).run()}
 }
 await purgeReviews(runtime,epoch,clock)
}
export async function purgeReviews(runtime:PennyRuntime,epoch:number,clock:number){
 const now=new Date(clock).toISOString(),raw=runtime.database.binding
 const sources=(await raw.prepare("SELECT evidence_id FROM penny_review_sources WHERE source_state='removed' AND purge_at<=? LIMIT 50").bind(now).all<{evidence_id:string}>()).results
 for(const s of sources){
  const db=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_review_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)",params:[epoch,s.evidence_id,now]})
  try{await db.batch([
   db.prepare("UPDATE evidence_versions SET wording='[Source removed]' WHERE evidence_id=?").bind(s.evidence_id),
   db.prepare('DELETE FROM penny_review_proposals WHERE evidence_id=?').bind(s.evidence_id),
   db.prepare('UPDATE evidence_items SET named_speaker=NULL WHERE id=?').bind(s.evidence_id),
   db.prepare("UPDATE penny_review_sources SET title=NULL,app_version=NULL,country=NULL,source_state='purged',ai_state='stopped',ai_claim=NULL,check_claim=NULL,check_failure=NULL WHERE evidence_id=?").bind(s.evidence_id),
   db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'system','review-capture','review.source_purged','evidence',?,?,?,?)").bind(crypto.randomUUID(),s.evidence_id,now,now,now),
  ])}catch{await raw.prepare("UPDATE penny_review_sources SET check_failure='reviews_purge_failed' WHERE evidence_id=? AND source_state='removed' AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)").bind(s.evidence_id,epoch).run()}
 }
}
