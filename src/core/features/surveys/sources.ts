import type {PennyRuntime} from '@/core/app/runtime'
import {createUlid} from '@/core/shared/ulid'
import {NativeError,digest} from '../auth/native-tokens'
import {selectResponse,type Form} from './model'
import {surveyRead} from './transport'
import {responseRecord} from './providers'
import {safeSelection} from './intake'
import {requireRead} from './work'
export async function refreshSurveySources(runtime:PennyRuntime,form:Form,db:D1Database,clock:number){
 const rows=(await db.prepare("SELECT s.evidence_id,s.source_hash,j.response_id FROM penny_survey_sources s JOIN penny_survey_jobs j ON j.id=s.job_id WHERE j.form_id=? AND s.source_state IN('current','changed') ORDER BY j.updated_at,j.id LIMIT 10").bind(form.id).all<{evidence_id:string;source_hash:string;response_id:string}>()).results
 for(const row of rows){
  // The form claim fences every completion against pause, restart and restore.
  const result=await surveyRead(runtime,form,row.response_id),now=new Date(clock).toISOString()
  let removed=[401,403,404,410].includes(result.status),fingerprint:string|null=null
  if(!removed){
   requireRead(result.status)
   try{
    const value=await safeSelection(db,selectResponse(form,responseRecord(form.provider,JSON.parse(result.body),form.form_id,row.response_id)))
    fingerprint=await digest(JSON.stringify(value.value))
   }catch(error){if(error instanceof NativeError&&error.code==='survey_source_removed')removed=true;else throw error}
  }
  if(removed){
   await db.prepare("UPDATE penny_survey_sources SET source_state='removed',removed_at=?,purge_at=? WHERE (evidence_id=? OR (?=1 AND job_id IN(SELECT id FROM penny_survey_jobs WHERE form_id=?))) AND source_state IN('current','changed')").bind(now,new Date(clock+form.purge_days*86400000).toISOString(),row.evidence_id,[401,403].includes(result.status)?1:0,form.id).run()
   if(result.status===401||result.status===403)requireRead(result.status)
  }else{
   await db.prepare("UPDATE penny_survey_sources SET source_state=CASE WHEN source_hash<>? THEN 'changed' ELSE source_state END WHERE evidence_id=? AND source_state IN('current','changed')").bind(fingerprint,row.evidence_id).run()
  }
  await db.prepare('UPDATE penny_survey_jobs SET updated_at=? WHERE evidence_id=?').bind(now,row.evidence_id).run()
 }
}
export async function purgeSurveySources(db:D1Database,now:string){
 const rows=(await db.prepare("SELECT evidence_id FROM penny_survey_sources WHERE source_state='removed' AND purge_at<=? LIMIT 50").bind(now).all<{evidence_id:string}>()).results
 for(const row of rows)try{await db.batch([
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'system','survey-capture','survey.source_purged','evidence',?,?,?,? WHERE EXISTS(SELECT 1 FROM penny_survey_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(createUlid(),row.evidence_id,now,now,now,row.evidence_id,now),
  db.prepare("UPDATE evidence_versions SET wording='[Source removed]',updated_at=? WHERE evidence_id=? AND EXISTS(SELECT 1 FROM penny_survey_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,row.evidence_id,row.evidence_id,now),
  db.prepare("UPDATE evidence_items SET named_speaker=NULL,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM penny_survey_sources WHERE evidence_id=? AND source_state='removed' AND purge_at<=?)").bind(now,row.evidence_id,row.evidence_id,now),
  db.prepare("UPDATE penny_survey_sources SET attributes_json='{}',source_email=NULL,source_state='purged' WHERE evidence_id=? AND source_state='removed' AND purge_at<=?").bind(row.evidence_id,now),
 ])}catch{
  // Keep the failure visible until the owner acknowledges recovery. Purges
  // themselves keep running while capture is paused or failed.
  await db.prepare("UPDATE penny_survey_forms SET state='failed',claim=NULL,failure='survey_purge_failed',updated_at=? WHERE id IN(SELECT j.form_id FROM penny_survey_jobs j JOIN penny_survey_sources s ON s.job_id=j.id WHERE s.evidence_id=? AND s.source_state='removed')").bind(now,row.evidence_id).run()
 }
}
