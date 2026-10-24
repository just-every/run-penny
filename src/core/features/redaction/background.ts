import type {AppBindings} from '@/core/shared/bindings'
import {NativeError} from '../auth/native-tokens'
import {audit} from '../decisions/write-support'
import {guardedDatabase} from '../integrations/guarded-database'
import {withoutLiveEffects} from '../integrations/effect-suppression'
import {redact} from './engine'
import {redactionFence,redactionSettings} from './settings'
import {places,quote,type PlaceCount} from './places'
import {contentRevision,guard,planHash,readRun,type Run} from './runs'

export const REDACTION_WORK={kind:'redaction.advance'} as const
export const isRedactionWork=(body:unknown)=>!!body&&typeof body==='object'&&(body as {kind?:unknown}).kind===REDACTION_WORK.kind
export const wakeRedaction=(jobs:Queue)=>jobs.send(REDACTION_WORK)
const PAGE_ROWS=10
/** A cursor and its text changes commit together. A competing worker cannot
 * commit the same page; a killed worker leaves either the old or new cursor. */
async function step(raw:D1Database,run:Run){
 const settings=await redactionSettings(raw)
 if(!settings.enabled||settings.revision!==run.rules_revision)throw new NativeError('redaction_rules_changed',409)
 if(run.state==='previewing'&&await contentRevision(raw)!==run.content_revision)throw new NativeError('redaction_preview_stale',409)
 const db=guardedDatabase(withoutLiveEffects(raw),{sql:"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND role='owner' AND status='active') AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')",params:[run.operator_id,run.operator_version]})
 const counts=JSON.parse(run.counts_json) as PlaceCount[],bounds=JSON.parse(run.bounds_json) as number[]
 let index=run.place_index,after=run.after_row,scanned=run.scanned,changes=run.changes,changed=run.changed
 const statements:D1PreparedStatement[]=[],now=new Date().toISOString()
 while(index<places.length&&(places[index].reason||bounds[index]===0)){scanned+=counts[index].records;index++;after=0}
 if(index<places.length){
  const place=places[index],rows=(await raw.prepare('SELECT t.rowid AS scan_row,'+place.columns.map(quote).join(',')+' FROM '+quote(place.table)+' t WHERE t.rowid>? AND t.rowid<=?'+(place.where?' AND '+place.where:'')+' ORDER BY t.rowid LIMIT ?').bind(after,bounds[index],PAGE_ROWS).all<Record<string,string|number|null>>()).results
  for(const row of rows){
   const updated:Record<string,string>={}
   for(const column of place.columns)if(typeof row[column]==='string'){
    const value=redact(row[column] as string,settings);if(value!==row[column])updated[column]=value
   }
   if(Object.keys(updated).length){
    if(run.state==='previewing'){counts[index].changes!++;changes++}
    else{
     const columns=Object.keys(updated),same=guard(db,'EXISTS(SELECT 1 FROM '+quote(place.table)+' WHERE rowid=? AND '+columns.map(column=>quote(column)+' IS ?').join(' AND ')+')',[row.scan_row,...columns.map(column=>row[column])])
     statements.push(same.before,db.prepare('UPDATE '+quote(place.table)+' SET '+columns.map(column=>quote(column)+'=?').join(',')+' WHERE rowid=?').bind(...Object.values(updated),row.scan_row),same.after);changed++
    }
   }
   scanned++;after=Number(row.scan_row)
  }
  if(rows.length<PAGE_ROWS||after>=bounds[index]){index++;after=0}
 }
 while(index<places.length&&(places[index].reason||bounds[index]===0)){scanned+=counts[index].records;index++;after=0}
 const finished=index===places.length,state=finished?(run.state==='previewing'?'ready':'complete'):run.state
 const fence=redactionFence(db,run.rules_revision),current=guard(db,"EXISTS(SELECT 1 FROM penny_redaction_runs WHERE id=? AND state=? AND step=?)"+(run.state==='previewing'?' AND (SELECT revision FROM penny_redaction_content WHERE singleton=1)=?':''),[run.id,run.state,run.step,...(run.state==='previewing'?[run.content_revision]:[])])
 await db.batch([fence.before,current.before,...statements,
  db.prepare('UPDATE penny_redaction_runs SET state=?,place_index=?,after_row=?,counts_json=?,changes=?,changed=?,scanned=?,plan_hash=?,step=step+1,updated_at=? WHERE id=?').bind(state,index,after,JSON.stringify(counts),changes,changed,scanned,state==='ready'?await planHash(run,counts):run.plan_hash,now,run.id),
  ...(state==='complete'?[audit(db,run.actor_id,'redaction_run',run.id,'redaction.reapplied',now,{changed,places:counts.map(p=>({table:p.table,records:p.records,changes:p.changes,blocked:p.blocked}))})]:[]),current.after,fence.after])
}
/** Queue and minute Cron share bounded pages. No capture, publication, votes,
 * notification or provider port is invoked by this worker. */
export async function advanceRedactionWork(bindings:AppBindings){
 const raw=bindings.DB
 const runs=(await raw.prepare("SELECT * FROM penny_redaction_runs WHERE state IN ('previewing','running') ORDER BY rowid LIMIT 1").all<Run>()).results
 for(let run of runs){
  for(let page=0;page<4&&['previewing','running'].includes(run.state);page++){
   try{await step(raw,run)}catch(error){
    const latest=await readRun(raw,run.id)
    // A second delivery won the cursor; its transaction owns the progress.
    if(!latest||latest.step!==run.step||latest.state!==run.state)break
    const code=error instanceof NativeError?error.code:'redaction_page_failed'
    await raw.batch([raw.prepare("UPDATE penny_redaction_runs SET state='failed',resume_state=?,error=?,step=step+1,updated_at=? WHERE id=? AND state=? AND step=?").bind(run.state,code,new Date().toISOString(),run.id,run.state,run.step),audit(raw,run.actor_id,'redaction_run',run.id,'redaction.failed',new Date().toISOString(),{code})])
    break
   }
   run=(await readRun(raw,run.id))!
  }
 }
 if(await raw.prepare("SELECT 1 FROM penny_redaction_runs WHERE state IN ('previewing','running') LIMIT 1").first())await wakeRedaction(bindings.JOBS)
}
export async function runRedactionQueue(batch:MessageBatch<unknown>,bindings:AppBindings){await advanceRedactionWork(bindings);batch.ackAll()}
