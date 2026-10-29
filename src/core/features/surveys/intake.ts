import {createUlid} from '@/core/shared/ulid'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError,digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {redactCaptured,redactionFence} from '../redaction/settings'
import {captureGuard,selectResponse,type Form,type ResponseRecord,type SelectedResponse} from './model'
export const responseDigest=(form:Form,id:string)=>digest(form.provider+'/'+form.form_id+'/'+id)
export async function safeSelection(db:D1Database,value:SelectedResponse){
 if(new TextEncoder().encode(JSON.stringify(value)).length>65536)throw new NativeError('survey_selection_limit',413)
 const fields:Record<string,string|null>={wording:value.wording,email:value.email,account:value.account,speaker:value.speaker??null,...Object.fromEntries(Object.entries(value.attributes).map(([k,v])=>['attribute:'+k,v]))}
 const safe=await redactCaptured(db,fields,Object.keys(fields))
 return {revision:safe.revision,value:{...value,wording:safe.input.wording!,email:safe.input.email===value.email?value.email:null,account:safe.input.account===value.account?value.account:null,...(safe.input.speaker?{speaker:safe.input.speaker}:{}),attributes:Object.fromEntries(Object.keys(value.attributes).map(k=>[k,String(safe.input['attribute:'+k])]))}}
}
export async function enqueueSurvey(runtime:PennyRuntime,form:Form,id:string,response?:ResponseRecord){
 const raw=runtime.database.binding,state=await raw.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)throw new NativeError('data_operation_in_progress',409)
 const db=guardedDatabase(raw,captureGuard(form,state.epoch)),key=await responseDigest(form,id),now=new Date().toISOString()
 if(await db.prepare('SELECT 1 FROM penny_survey_receipts WHERE source_digest=?').bind(key).first())return {accepted:true,duplicate:true}
 const safe=response?await safeSelection(raw,selectResponse(form,response)):null
 const fence=safe?redactionFence(db,safe.revision):null
 const result=await db.batch([
  ...(fence?[fence.before,fence.after]:[]),
  db.prepare("INSERT INTO penny_survey_jobs(id,form_id,response_id,revision,selected_json,state,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?) ON CONFLICT DO NOTHING RETURNING id").bind(createUlid(),form.id,id,form.revision,safe?JSON.stringify(safe.value):null,now,now),
  db.prepare('INSERT INTO penny_survey_receipts(source_digest,created_at) VALUES(?,?) ON CONFLICT DO NOTHING').bind(key,now),
  db.prepare("UPDATE penny_survey_forms SET due_at=? WHERE id=? AND state='idle'").bind(now,form.id),
 ])
 return {accepted:true,duplicate:result[fence?2:0].results.length===0}
}
