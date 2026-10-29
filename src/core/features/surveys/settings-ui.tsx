import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import type {Mapping,Provider} from './model'
interface Form {id:string;provider:Provider;form_id:string;mapping:Mapping;response_url:string;enabled:number;purge_days:number;configured:boolean;owner_name:string|null;state:string;due_at:string;failure:string|null;attempts:number}
interface Status {canConfigure:boolean;forms:Form[];jobs:{id:string;form_id:string;response_id:string;state:string;failure:string|null;attempts:number}[]}
const path='/api/operator/integrations/surveys'
export function SurveySettings(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Form|null>(null)
 async function save(body:unknown,suffix='',method='PUT'){
  setBusy(true);try{await operatorMutation(path+suffix,body,method);setMessage('Survey settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Survey settings could not be saved.')}finally{setBusy(false)}
 }
 return <SectionCard id="survey-capture" icon="evidence" title="Survey capture" description="Bring selected responses into the private feedback inbox. Map only the answers your team needs.">
 {resource.kind==='ready'&&resource.data.canConfigure?<div className="space-y-6">
  <p>Typeform and SurveyMonkey use signed webhooks. Google Forms is read hourly. Pencil uses signed response events and the selected form’s ledger. Configure installation credentials before enabling a form.</p>
  <p className="text-sm text-penny-muted">Capture grants no verified identity or email permission. Private attributes stay in the operator inbox. Unmapped answers are discarded before storage.</p>
  <form key={editing?.id??'new'} className="space-y-5" onSubmit={event=>{
   event.preventDefault();const values=new FormData(event.currentTarget),split=(key:string)=>String(values.get(key)).split(/\s+/).filter(Boolean)
   const attributes=String(values.get('attributes')).split(/\n/).filter(line=>line.trim()).map(line=>{const [question,...key]=line.split('=');return {question:question.trim(),key:key.join('=').trim()}})
   void save({id:String(values.get('id')),provider:String(values.get('provider')),formId:String(values.get('formId')),mapping:{evidence:split('evidence'),attributes,email:String(values.get('email'))||null,account:String(values.get('account'))||null},responseUrl:String(values.get('responseUrl')),enabled:values.get('enabled')==='on',purgeDays:Number(values.get('purgeDays'))})
  }}>
   <h3 className="font-semibold">{editing?'Edit selected form':'Select a form'}</h3>
   <div className="grid gap-5 sm:grid-cols-2">
    <label className={fieldLabelClass}>Connection name<input required className={fieldClass} name="id" pattern="[A-Za-z0-9_-]+" defaultValue={editing?.id} readOnly={Boolean(editing)} placeholder="customer-survey"/></label>
    <label className={fieldLabelClass}>Survey provider<select className={fieldClass} name="provider" defaultValue={editing?.provider??'typeform'} disabled={false}>{Object.entries({typeform:'Typeform',surveymonkey:'SurveyMonkey',google:'Google Forms',pencil:'Pencil'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   <label className={fieldLabelClass}>Selected form ID<input required className={fieldClass} name="formId" pattern="[A-Za-z0-9_-]+" defaultValue={editing?.form_id} readOnly={Boolean(editing)}/></label>
   <label className={fieldLabelClass}>Open-text question IDs<textarea required className={fieldClass} name="evidence" rows={2} defaultValue={editing?.mapping.evidence.join('\n')}/></label>
   <label className={fieldLabelClass}>Private attribute mappings<textarea className={fieldClass} name="attributes" rows={3} placeholder={'plan_question=plan\nscore_question=satisfaction'} defaultValue={editing?.mapping.attributes.map(a=>a.question+'='+a.key).join('\n')} aria-describedby="survey-map-help"/></label>
   <p id="survey-map-help" className="text-sm">One question ID per line for evidence. For attributes, use question ID = private attribute name, one per line. Use hidden.field_name for a selected hidden field.</p>
   <div className="grid gap-5 sm:grid-cols-2">
    <label className={fieldLabelClass}>Respondent email question or hidden field<input className={fieldClass} name="email" defaultValue={editing?.mapping.email??''} placeholder="hidden.email"/></label>
    <label className={fieldLabelClass}>Account question or hidden field<input className={fieldClass} name="account" defaultValue={editing?.mapping.account??''} placeholder="hidden.account"/></label>
   </div>
   <p className="text-sm text-penny-muted">Accounts match existing account IDs or slugs. An email may match an existing requester or create an unverified contact. Redacted email is never used to create identity.</p>
   <label className={fieldLabelClass}>Response link template<input required className={fieldClass} name="responseUrl" defaultValue={editing?.response_url} placeholder="https://your-survey.example/responses/{responseId}"/></label>
   <label className={fieldLabelClass}>Days to retain an excerpt after source removal<input required className={fieldClass} name="purgeDays" type="number" min={0} max={365} defaultValue={editing?.purge_days??0}/></label>
   <label className="flex min-h-11 items-center gap-3"><input name="enabled" type="checkbox" defaultChecked={editing?.enabled===1}/>Enable selected form</label>
   <p className="text-sm text-penny-muted">Saving assigns you as the accountable owner and stops unfinished captures. Review and retry them under the new mapping. Paused forms make no source reads; due purges continue.</p>
   <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy}>Save survey capture</button>{editing?<button type="button" className={buttonClass} onClick={()=>setEditing(null)}>Select another form</button>:null}</div>
  </form>
  <div className="border-t border-penny-line pt-5"><h3 className="font-semibold">Survey progress</h3><button type="button" className={buttonClass+' mt-3'} onClick={reload}>Refresh survey progress</button>
   <ul className="mt-4 space-y-4" aria-label="Selected survey forms">{resource.data.forms.map(form=><li key={form.id} className="rounded-lg border border-penny-line p-4 break-words">
    <h4 className="font-semibold">{form.id} · {form.provider}</h4><p>Accountable owner: {form.owner_name??'Removed owner'}</p><p>{form.configured?'Transport configured':'Transport unavailable'} · {form.state} · {form.attempts} runs</p><p>Next read: {form.due_at}</p>
    {form.failure?<p role="status">Survey work needs attention ({form.failure}). Review credentials, source access and mapping, then retry.</p>:null}
    <p className="text-sm break-all">Webhook: /api/integrations/surveys/{form.id}</p>
    <div className="mt-3 flex flex-wrap gap-3"><button className={buttonClass} onClick={()=>setEditing(form)}>Edit form</button><button className={buttonClass} disabled={busy||!form.enabled} onClick={()=>void save({id:form.id,action:'retry'},'/work','POST')}>Retry survey work</button><button className={buttonClass} disabled={busy} onClick={()=>void save({id:form.id,action:'stop'},'/work','POST')}>Stop survey work</button></div>
    <ul className="mt-4 space-y-2">{resource.data.jobs.filter(job=>job.form_id===form.id).map(job=><li key={job.id}>Response {job.response_id}: {job.state} · {job.attempts} attempts{job.failure?<span> · {job.failure}</span>:null}</li>)}</ul>
   </li>)}</ul>
  </div>
 </div>:<p role="status">{resource.kind==='loading'?'Loading survey capture…':'Owner access is required to configure survey capture.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
