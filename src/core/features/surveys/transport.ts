import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'
import {captureGuard,type Form} from './model'
const secret=z.object({token:z.string().min(1).max(8192).optional(),webhookSecret:z.string().min(16).max(512).optional(),clientId:z.string().min(1).max(200).optional(),origin:z.string().url().optional(),cookie:z.string().min(1).max(8192).optional()}).strict()
export interface SurveyEgress {send(request:{url:string;method:'GET';headers:Record<string,string>;body:string}):Promise<{status:number;headers:Record<string,string>;body:string}>}
export function credential(runtime:PennyRuntime,id:string){
 try{
  const all=z.record(z.string(),secret).parse(JSON.parse(runtime.bindings.PENNY_SURVEYS??'{}')),value=all[id]
  if(!value)throw Error()
  if(value.origin){const url=new URL(value.origin);if(url.protocol!=='https:'||url.origin!==value.origin||url.username||url.password||url.port)throw Error()}
  return value
 }catch{throw new NativeError('survey_credentials_unavailable',503)}
}
export function configured(runtime:PennyRuntime,form:Pick<Form,'id'|'provider'>){
 try{const c=credential(runtime,form.id);return Boolean(runtime.bindings.PENNY_SURVEY_EGRESS&&(form.provider==='pencil'?c.origin&&c.cookie&&c.webhookSecret:form.provider==='google'?c.token:c.token&&c.webhookSecret&&(form.provider!=='surveymonkey'||c.clientId)))}catch{return false}
}
export async function surveyRead(runtime:PennyRuntime,form:Form,responseId?:string,cursor?:string|null){
 const c=credential(runtime,form.id),port=runtime.bindings.PENNY_SURVEY_EGRESS
 if(!port||!configured(runtime,form))throw new NativeError('survey_transport_unconfigured',503)
 const formId=encodeURIComponent(form.form_id),id=responseId?encodeURIComponent(responseId):'',headers:Record<string,string>={Accept:'application/json'}
 let url:string
 if(form.provider==='pencil'){
  url=c.origin+'/api/app/flows/'+formId+'/ledger';headers.Cookie=c.cookie!
 }else{
  headers.Authorization='Bearer '+c.token
  url=form.provider==='typeform'?'https://api.typeform.com/forms/'+formId+'/responses?included_response_ids='+id:
   form.provider==='surveymonkey'?'https://api.surveymonkey.com/v3/surveys/'+formId+'/responses/'+id+'/details':
   'https://forms.googleapis.com/v1/forms/'+formId+'/responses'+(id?'/'+id:'?pageSize=50'+(cursor?'&pageToken='+encodeURIComponent(cursor):''))
 }
 // The deployment service must enforce DNS/IP, TLS, no redirects, timeout and
 // byte bounds. Only fixed provider routes and the configured Pencil origin.
 const state=await runtime.database.binding.prepare("SELECT epoch FROM data_state WHERE singleton=1 AND phase='idle'").first<{epoch:number}>()
 if(!state)throw new NativeError('data_operation_in_progress',409)
 const guard=captureGuard(form,state.epoch)
 async function read(target:string){
  if(!await runtime.database.binding.prepare('SELECT 1 WHERE '+guard.sql).bind(...guard.params).first())throw new NativeError('integration_authority_changed',401)
  const result=await port!.send({url:target,method:'GET',headers,body:''})
  if(!Number.isInteger(result.status)||typeof result.body!=='string'||new TextEncoder().encode(result.body).length>262144)throw new NativeError('survey_response_invalid',503)
  return result
 }
 if(form.provider!=='pencil')return read(url)
 // Pencil's native ledger is paged by offset. Follow bounded pages of this
 // selected form, never mistake a non-first-page response for a deletion.
 let offset=0
 for(let page=0;page<100;page++){
  const result=await read(url+(offset?'?offset='+offset:''))
  if(result.status!==200)return result
  const body=z.object({flow:z.object({id:z.string()}),total:z.number().int().nonnegative(),responses:z.array(z.object({id:z.string()}).passthrough()).max(2000)}).parse(JSON.parse(result.body))
  if(body.flow.id!==form.form_id)throw new NativeError('survey_scope_mismatch',403)
  const item=body.responses.find(item=>item.id===responseId)
  if(item)return {...result,body:JSON.stringify({...body,responses:[item]})}
  offset+=body.responses.length
  if(offset>=body.total)return {...result,status:404,body:''}
  if(!body.responses.length)throw new NativeError('survey_page_invalid',503)
 }
 throw new NativeError('survey_page_limit',503)
}
