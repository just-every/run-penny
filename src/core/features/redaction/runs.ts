import {NativeError,digest} from '../auth/native-tokens'
import {audit} from '../decisions/write-support'
import {redactionFence,redactionSettings} from './settings'
import {countFor,places,quote,type PlaceCount} from './places'
export type RunState='previewing'|'ready'|'running'|'complete'|'failed'
export interface Run {id:string;operator_id:string;operator_version:number;actor_id:string;state:RunState;resume_state:'previewing'|'running';rules_revision:number;content_revision:number;place_index:number;after_row:number;bounds_json:string;counts_json:string;records:number;changes:number;changed:number;scanned:number;step:number;plan_hash:string|null;error:string|null;created_at:string;updated_at:string}
export const readRun=(db:D1Database,id:string)=>db.prepare('SELECT * FROM penny_redaction_runs WHERE id=?').bind(id).first<Run>()
export const latestRun=(db:D1Database)=>db.prepare('SELECT * FROM penny_redaction_runs ORDER BY rowid DESC LIMIT 1').first<Run>()
/** Freshness is a read projection: a stale cursor is kept for its history,
 * but the owner is only offered actions the corresponding route can admit. */
export async function runView(db:D1Database,run:Run){
 const settings=await redactionSettings(db)
 const stale=run.state!=='complete'&&(!settings.enabled||settings.revision!==run.rules_revision||((run.state==='ready'||run.resume_state==='previewing')&&await contentRevision(db)!==run.content_revision))
 return {id:run.id,state:stale?'stale' as const:run.state,canResume:run.state==='failed'&&!stale,records:run.records,changes:run.changes,changed:run.changed,scanned:run.scanned,planHash:stale?null:run.plan_hash,places:JSON.parse(run.counts_json) as PlaceCount[],error:run.error}
}
export const contentRevision=(db:D1Database)=>db.prepare('SELECT revision FROM penny_redaction_content WHERE singleton=1').first<number>('revision')
export function guard(db:D1Database,sql:string,params:unknown[]){const id=crypto.randomUUID();return {before:db.prepare(`INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN ${sql} THEN 1 ELSE 0 END)`).bind(id,...params),after:db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(id)}}
export async function startPreview(db:D1Database,authority:{operatorId:string;version:number;actorId:string}){
 const settings=await redactionSettings(db)
 if(!settings.enabled)throw new NativeError('redaction_disabled',409,'Enable redaction before previewing stored text.')
 const revision=await contentRevision(db),bounds:number[]=[],counts:PlaceCount[]=[]
 for(let offset=0;offset<places.length;offset+=16){
  const group=places.slice(offset,offset+16),rows=await db.batch(group.map(place=>db.prepare(`SELECT COUNT(*) records,COALESCE(MAX(t.rowid),0) last FROM ${quote(place.table)} t${place.where?' WHERE '+place.where:''}`)))
  rows.forEach((result,index)=>{const row=result.results[0] as {records:number;last:number};counts.push(countFor(group[index],row.records));bounds.push(row.last)})
 }
 const id=crypto.randomUUID(),now=new Date().toISOString(),fence=redactionFence(db,settings.revision),fresh=guard(db,'(SELECT revision FROM penny_redaction_content WHERE singleton=1)=?',[revision])
 await db.batch([fence.before,fresh.before,db.prepare(`INSERT INTO penny_redaction_runs(id,operator_id,operator_version,actor_id,state,resume_state,rules_revision,content_revision,bounds_json,counts_json,records,created_at,updated_at) VALUES(?,?,?,?,'previewing','previewing',?,?,?,?,?,?,?)`).bind(id,authority.operatorId,authority.version,authority.actorId,settings.revision,revision,JSON.stringify(bounds),JSON.stringify(counts),counts.reduce((n,p)=>n+p.records,0),now,now),audit(db,authority.actorId,'redaction_run',id,'redaction.preview_requested',now),db.prepare('UPDATE penny_redaction_runs SET content_revision=(SELECT revision FROM penny_redaction_content WHERE singleton=1) WHERE id=?').bind(id),fresh.after,fence.after])
 return (await readRun(db,id))!
}
export async function confirmRun(db:D1Database,planHash:string,authority:{operatorId:string;version:number;actorId:string}){
 const run=await db.prepare('SELECT * FROM penny_redaction_runs WHERE plan_hash=?').bind(planHash).first<Run>()
 if(!run)throw new NativeError('redaction_preview_stale',409,'Preview stored text again before confirming.')
 if(['running','complete'].includes(run.state))return run
 if(run.state!=='ready'||await contentRevision(db)!==run.content_revision||(await redactionSettings(db)).revision!==run.rules_revision)throw new NativeError('redaction_preview_stale',409,'Stored text or rules changed. Preview the counts again before confirming.')
 const fence=redactionFence(db,run.rules_revision),fresh=guard(db,"(SELECT revision FROM penny_redaction_content WHERE singleton=1)=? AND EXISTS(SELECT 1 FROM penny_redaction_runs WHERE id=? AND state='ready' AND step=?)",[run.content_revision,run.id,run.step]),now=new Date().toISOString()
 await db.batch([fence.before,fresh.before,db.prepare("UPDATE penny_redaction_runs SET state='running',resume_state='running',place_index=0,after_row=0,scanned=0,operator_id=?,operator_version=?,actor_id=?,step=step+1,updated_at=? WHERE id=?").bind(authority.operatorId,authority.version,authority.actorId,now,run.id),audit(db,authority.actorId,'redaction_run',run.id,'redaction.confirmed',now,{records:run.records,changes:run.changes,blocked:JSON.parse(run.counts_json).filter((p:PlaceCount)=>p.blocked&&p.records>0).map((p:PlaceCount)=>({table:p.table,records:p.records}))}),fresh.after,fence.after])
 return (await readRun(db,run.id))!
}
export async function resumeRun(db:D1Database,id:string,authority:{operatorId:string;version:number;actorId:string}){
 const run=await readRun(db,id)
 if(!run)throw new NativeError('redaction_run_not_found',404)
 if(run.state!=='failed')return run
 if((await redactionSettings(db)).revision!==run.rules_revision||(run.resume_state==='previewing'&&await contentRevision(db)!==run.content_revision))throw new NativeError('redaction_preview_stale',409,'Stored text or rules changed. Start a fresh preview.')
 await db.batch([db.prepare('UPDATE penny_redaction_runs SET state=resume_state,operator_id=?,operator_version=?,actor_id=?,error=NULL,step=step+1,updated_at=? WHERE id=? AND state=\'failed\'').bind(authority.operatorId,authority.version,authority.actorId,new Date().toISOString(),id),audit(db,authority.actorId,'redaction_run',id,'redaction.resumed',new Date().toISOString())])
 return (await readRun(db,id))!
}
export async function planHash(run:Run,counts:PlaceCount[]){return digest(JSON.stringify({id:run.id,revision:run.rules_revision,contentRevision:run.content_revision,bounds:JSON.parse(run.bounds_json),counts}))}
