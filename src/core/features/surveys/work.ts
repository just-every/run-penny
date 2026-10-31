import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {captureGuard,selectResponse,type Form,type SelectedResponse} from './model'
import {responseRecord,googlePage} from './providers'
import {surveyRead} from './transport'
import {enqueueSurvey} from './intake'
import {captureResponse} from './capture'
import {refreshSurveySources,purgeSurveySources} from './sources'
export const surveyFailure=(error:unknown)=>error instanceof NativeError?error.code:'survey_read_failed'
export async function drainSurveys(runtime:PennyRuntime,clock=Date.now()){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)return
 const now=new Date(clock).toISOString(),stale=new Date(clock-300000).toISOString()
 const idle=guardedDatabase(raw,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?)",params:[state.epoch]})
 await idle.batch([
  idle.prepare("UPDATE penny_survey_forms SET state='failed',claim=NULL,failure='survey_interrupted_retry_required' WHERE state='running' AND started_at<=?").bind(stale),
  idle.prepare("UPDATE penny_survey_jobs SET state='failed',claim=NULL,failure='survey_interrupted_retry_required' WHERE state='running' AND started_at<=?").bind(stale),
  idle.prepare("UPDATE penny_survey_forms SET state='failed',claim=NULL,failure='survey_owner_unavailable' WHERE enabled=1 AND state='idle' AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=owner_id AND o.version=owner_version AND o.role='owner' AND o.status='active')"),
 ])
 await purgeSurveySources(idle,now)
 const forms=(await idle.prepare("SELECT * FROM penny_survey_forms WHERE enabled=1 AND state='idle' AND due_at<=? ORDER BY due_at,id LIMIT 10").bind(now).all<Form>()).results
 for(const form of forms){
  const guard=captureGuard(form,state.epoch),claim=crypto.randomUUID()
  const db=guardedDatabase(raw,guard)
  try{
   const started=await db.prepare("UPDATE penny_survey_forms SET state='running',claim=?,started_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND state='idle' RETURNING id").bind(claim,now,now,form.id).all()
   if(!started.results.length)continue
   guard.sql+=" AND EXISTS(SELECT 1 FROM penny_survey_forms WHERE id=? AND claim=? AND state='running')";guard.params.push(form.id,claim)
   const commit=guardedDatabase(raw,guard)
   let cursor:string|null=null
   if(form.provider==='google'){
    const response=await surveyRead(runtime,form,undefined,form.cursor)
    requireRead(response.status);const page=googlePage(JSON.parse(response.body))
    for(const item of page.responses)await enqueueSurvey(runtime,form,item.responseId,responseRecord('google',item,form.form_id,item.responseId))
    cursor=page.nextPageToken??null
   }
   const jobs=(await commit.prepare("SELECT id,response_id,selected_json FROM penny_survey_jobs WHERE form_id=? AND revision=? AND state='pending' ORDER BY created_at,id LIMIT 50").bind(form.id,form.revision).all<{id:string;response_id:string;selected_json:string|null}>()).results
   for(const job of jobs){
    const jobClaim=crypto.randomUUID(),started=await commit.prepare("UPDATE penny_survey_jobs SET state='running',claim=?,started_at=?,attempts=attempts+1 WHERE id=? AND state='pending' RETURNING id").bind(jobClaim,now,job.id).all()
    if(!started.results.length)continue
    try{
     let selected:SelectedResponse
     if(job.selected_json)selected=JSON.parse(job.selected_json)
     else{const response=await surveyRead(runtime,form,job.response_id);requireRead(response.status);selected=selectResponse(form,responseRecord(form.provider,JSON.parse(response.body),form.form_id,job.response_id))}
     await captureResponse(runtime,form,state.epoch,job.id,jobClaim,selected,now)
    }catch(error){
     await idle.prepare("UPDATE penny_survey_jobs SET state='failed',claim=NULL,failure=?,updated_at=? WHERE id=? AND claim=? AND state='running'").bind(surveyFailure(error),now,job.id,jobClaim).run()
    }
   }
   await refreshSurveySources(runtime,form,commit,clock)
   const failed=await commit.prepare("SELECT 1 FROM penny_survey_jobs WHERE form_id=? AND state='failed' LIMIT 1").bind(form.id).first()
   const pending=await commit.prepare("SELECT 1 FROM penny_survey_jobs WHERE form_id=? AND state='pending' LIMIT 1").bind(form.id).first()
   await commit.prepare("UPDATE penny_survey_forms SET state=?,failure=?,cursor=?,due_at=?,claim=NULL,updated_at=? WHERE id=?").bind(failed?'failed':'idle',failed?'survey_capture_failed':null,cursor,new Date(clock+(cursor||pending?0:3600000)).toISOString(),now,form.id).run()
  }catch(error){
   if(error instanceof NativeError&&error.code==='survey_access_revoked'){
    await idle.prepare("UPDATE penny_survey_sources SET source_state='removed',removed_at=?,purge_at=? WHERE job_id IN(SELECT id FROM penny_survey_jobs WHERE form_id=?) AND source_state IN('current','changed') AND EXISTS(SELECT 1 FROM penny_survey_forms WHERE id=? AND revision=?)").bind(now,new Date(clock+form.purge_days*86400000).toISOString(),form.id,form.id,form.revision).run()
   }
   await idle.prepare("UPDATE penny_survey_forms SET state='failed',claim=NULL,failure=?,updated_at=? WHERE id=? AND claim=? AND state='running'").bind(surveyFailure(error),now,form.id,claim).run()
  }
 }
}
export function requireRead(status:number){
 if(status!==200)throw new NativeError(status===401||status===403?'survey_access_revoked':status===429?'survey_rate_limited':status===404||status===410?'survey_source_removed':'survey_provider_unavailable',503)
}
