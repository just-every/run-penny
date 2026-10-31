import {z} from 'zod'
import {NativeError} from '../auth/native-tokens'
import {sourceId,type ResponseRecord,type Provider} from './model'
const text=z.string().max(20000),time=z.iso.datetime({offset:true})
const scalar=z.union([text,z.number().finite(),z.boolean()])
const typeform=z.object({token:sourceId,form_id:sourceId,submitted_at:time,answers:z.array(z.object({field:z.object({id:sourceId,type:z.string().optional()}),type:z.string(),text:text.optional(),email:text.optional(),number:z.number().optional(),boolean:z.boolean().optional(),choice:z.object({label:text}).optional(),choices:z.object({labels:z.array(text)}).optional()})).max(300),hidden:z.record(z.string(),scalar).optional()})
export function typeformResponse(value:unknown,formId:string):ResponseRecord{
 const r=typeform.parse(value);if(r.form_id!==formId)throw new NativeError('survey_scope_mismatch',403)
 return {id:r.token,time:r.submitted_at,answers:Object.fromEntries([...r.answers.map(a=>[a.field.id,a.text??a.email??a.choice?.label??a.choices?.labels.join(', ')??String(a.number??a.boolean??'')]),...Object.entries(r.hidden??{}).map(([key,value])=>['hidden.'+key,String(value)])]),textQuestions:r.answers.filter(a=>a.type==='text').map(a=>a.field.id)}
}
const sm=z.object({id:sourceId,survey_id:sourceId,date_created:time,date_modified:time.optional(),pages:z.array(z.object({questions:z.array(z.object({id:sourceId,answers:z.array(z.object({text:text.optional(),choice_id:sourceId.optional(),row_id:sourceId.optional()})).max(100)})).max(300)})).max(100),custom_variables:z.record(z.string(),scalar).optional()})
const google=z.object({responseId:sourceId,createTime:time,lastSubmittedTime:time.optional(),respondentEmail:text.optional(),answers:z.record(z.string(),z.object({questionId:sourceId,textAnswers:z.object({answers:z.array(z.object({value:text})).max(100)}).optional()})).optional()})
const pencil=z.object({id:sourceId,completedAt:time,state:z.literal('released'),answers:z.array(z.object({stepId:sourceId,questionType:z.string(),displayValue:text})).max(300),hiddenFields:z.array(z.object({name:z.string(),value:scalar})).optional(),participant:z.object({email:text.nullable().optional()}).optional()})
export function responseRecord(provider:Provider,value:unknown,formId:string,id:string):ResponseRecord {
 let result:ResponseRecord
 if(provider==='typeform'){
  const envelope=z.object({items:z.array(z.unknown()).max(1000)}).parse(value)
  const item=envelope.items.find(item=>typeof item==='object'&&item!==null&&'token' in item&&item.token===id)
  if(!item||typeof item!=='object')throw new NativeError('survey_source_removed',503)
  result=typeformResponse({...item,form_id:formId},formId)
 }else if(provider==='surveymonkey'){
  const r=sm.parse(value);if(r.survey_id!==formId)throw new NativeError('survey_scope_mismatch',403)
  const questions=r.pages.flatMap(p=>p.questions)
  result={id:r.id,time:r.date_created,answers:Object.fromEntries([...questions.map(q=>[q.id,q.answers.map(a=>a.text??a.choice_id??'').join(', ')]),...Object.entries(r.custom_variables??{}).map(([k,v])=>['hidden.'+k,String(v)])]),textQuestions:questions.filter(q=>q.answers.some(a=>a.text!==undefined)).map(q=>q.id)}
 }else if(provider==='google'){
  const r=google.parse(value),answers=Object.values(r.answers??{})
  result={id:r.responseId,time:r.createTime,answers:Object.fromEntries([...answers.map(a=>[a.questionId,a.textAnswers?.answers.map(v=>v.value).join(', ')??'']),...(r.respondentEmail?[['hidden.email',r.respondentEmail]]:[])]),textQuestions:answers.filter(a=>a.textAnswers).map(a=>a.questionId)}
 }else{
  const page=z.object({flow:z.object({id:sourceId}),responses:z.array(z.unknown()).max(2000)}).parse(value)
  if(page.flow.id!==formId)throw new NativeError('survey_scope_mismatch',403)
  const r=pencil.parse(page.responses.find(row=>typeof row==='object'&&row!==null&&'id' in row&&row.id===id))
  result={id:r.id,time:r.completedAt,answers:Object.fromEntries([...r.answers.map(a=>[a.stepId,a.displayValue]),...(r.hiddenFields??[]).map(a=>['hidden.'+a.name,String(a.value)]),...(r.participant?.email?[['hidden.email',r.participant.email]]:[])]),textQuestions:r.answers.filter(a=>['short_text','long_text'].includes(a.questionType)).map(a=>a.stepId)}
 }
 if(result.id!==id)throw new NativeError('survey_response_mismatch',503)
 return result
}
export function googlePage(value:unknown){
 return z.object({responses:z.array(google).max(50).default([]),nextPageToken:z.string().max(2048).optional()}).parse(value)
}
