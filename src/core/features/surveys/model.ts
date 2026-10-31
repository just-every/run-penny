import {z} from 'zod'
export const provider=z.enum(['typeform','surveymonkey','google','pencil'])
export type Provider=z.infer<typeof provider>
export const sourceId=z.string().regex(/^[A-Za-z0-9_-]{1,200}$/)
const question=z.string().regex(/^(?:hidden\.)?[A-Za-z0-9_-]{1,200}$/)
export const mapping=z.object({
 evidence:z.array(question).min(1).max(30),
 attributes:z.array(z.object({question,key:z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)}).strict()).max(30),
 email:question.nullable(),account:question.nullable(),
}).strict().refine(m=>new Set(m.evidence).size===m.evidence.length&&new Set(m.attributes.map(a=>a.key)).size===m.attributes.length)
export const formInput=z.object({
 id:sourceId,provider,formId:sourceId,mapping,
 responseUrl:z.string().max(2000).refine(value=>{
  try{const u=new URL(value.replace('{responseId}','response'));return value.split('{responseId}').length===2&&u.protocol==='https:'&&!u.username&&!u.password&&!u.port}catch{return false}
 },'Use an HTTPS response link containing {responseId}, without credentials or port.'),
 enabled:z.boolean(),purgeDays:z.number().int().min(0).max(365),
}).strict()
export type Mapping=z.infer<typeof mapping>
export interface Form {id:string;provider:Provider;form_id:string;mapping_json:string;response_url:string;owner_id:string;owner_version:number;actor_id:string;enabled:number;revision:number;purge_days:number;state:string;due_at:string;cursor:string|null;claim:string|null;started_at:string|null;failure:string|null;attempts:number;updated_at:string}
export const readForm=(db:D1Database,id:string)=>db.prepare('SELECT * FROM penny_survey_forms WHERE id=?').bind(id).first<Form>()
export function captureGuard(form:Form,epoch:number){return {sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle' AND epoch=?) AND EXISTS(SELECT 1 FROM penny_survey_forms f JOIN oa_operators o ON o.id=f.owner_id WHERE f.id=? AND f.revision=? AND f.enabled=1 AND o.status='active' AND o.role='owner' AND o.version=f.owner_version)",params:[epoch,form.id,form.revision] as (string|number|null)[]}}
export interface ResponseRecord {id:string;time:string;answers:Record<string,string>;textQuestions:string[]}
export interface SelectedResponse {id:string;time:string;wording:string;attributes:Record<string,string>;email:string|null;account:string|null}
export function selectResponse(form:Form,response:ResponseRecord):SelectedResponse {
 const m=mapping.parse(JSON.parse(form.mapping_json))
 const get=(key:string|null)=>key?response.answers[key]??null:null
 return {id:response.id,time:response.time,wording:m.evidence.filter(q=>response.textQuestions.includes(q)).map(q=>get(q)).filter(Boolean).join('\n\n'),
 attributes:Object.fromEntries(m.attributes.flatMap(a=>get(a.question)===null?[]:[[a.key,get(a.question)!]])),email:get(m.email),account:get(m.account)}
}
