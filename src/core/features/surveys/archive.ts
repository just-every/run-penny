import {z} from 'zod'
import type {Row} from '../data/archive'
import {NativeError} from '../auth/native-tokens'
import {formInput,type Form} from './model'
import {responseDigest} from './intake'
export async function validateSurveyArchive(data:Record<string,Row[]>){
 try{
  const forms=data.penny_survey_forms??[],jobs=data.penny_survey_jobs??[],sources=data.penny_survey_sources??[],receipts=new Set((data.penny_survey_receipts??[]).map(row=>{
   if(typeof row.source_digest!=='string'||!/^[a-f0-9]{64}$/.test(row.source_digest))throw Error()
   return row.source_digest
  }))
  for(const form of forms){
   formInput.parse({id:form.id,provider:form.provider,formId:form.form_id,mapping:JSON.parse(String(form.mapping_json)),responseUrl:form.response_url,enabled:form.enabled===1,purgeDays:form.purge_days})
   if(![0,1].includes(Number(form.enabled))||!['idle','running','failed','stopped','held'].includes(String(form.state))||!Number.isSafeInteger(form.revision)||Number(form.revision)<1||!Number.isSafeInteger(form.owner_version)||typeof form.owner_id!=='string'||typeof form.actor_id!=='string')throw Error()
  }
  for(const job of jobs){
   const form=forms.find(f=>f.id===job.form_id)
   if(!form||typeof job.id!=='string'||!receipts.has(await responseDigest(form as unknown as Form,String(job.response_id)))||!['pending','running','failed','done','stopped','held'].includes(String(job.state)))throw Error()
   if(job.selected_json!==null){
    const value=z.object({id:z.string(),time:z.iso.datetime({offset:true}),wording:z.string(),attributes:z.record(z.string(),z.string()),email:z.string().nullable(),account:z.string().nullable(),speaker:z.string().nullable().optional()}).strict().parse(JSON.parse(String(job.selected_json)))
    if(value.id!==job.response_id)throw Error()
   }
   if(job.state==='done'&&(!job.evidence_id||!sources.some(s=>s.job_id===job.id&&s.evidence_id===job.evidence_id)))throw Error()
  }
  for(const source of sources){
   const job=jobs.find(j=>j.id===source.job_id),evidence=data.evidence_items?.find(e=>e.id===source.evidence_id)
   if(!job||job.evidence_id!==source.evidence_id||evidence?.source_type!=='survey'||!receipts.has(await responseDigest(forms.find(f=>f.id===job.form_id) as unknown as Form,String(job.response_id))))throw Error()
   const url=new URL(String(source.response_url));if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error()
   z.record(z.string(),z.string()).parse(JSON.parse(String(source.attributes_json)))
   if(!['current','changed','removed','purged'].includes(String(source.source_state))||!/^[a-f0-9]{64}$/.test(String(source.source_hash)))throw Error()
  }
 }catch{throw new NativeError('survey_archive_invalid',409)}
}
