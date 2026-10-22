import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import {kinds,type Rules} from './engine'
const labels={ssn:'US Social Security numbers',card:'Payment card numbers',phone:'Phone numbers',email:'Email addresses',credential:'Credential assignments'}
export function RedactionSettings(){
 const [resource,reload]=useOperatorResource<Rules&{canConfigure:boolean}>('/api/operator/settings/redaction'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [preview,setPreview]=useState<{records:number;changes:number;planHash:string}|null>(null)
 return <SectionCard id="evidence-redaction" icon="form" title="Sensitive evidence redaction" description="Deterministic rules mark sensitive wording before operator, email and portal capture is stored. Model detection is not used.">
 <p className="mb-5 text-sm">Binary attachments are not rewritten. Saved-import originals and learning source envelopes are not covered yet. Stored-evidence reapplication below covers wording versions, up to 200 versions; copied transcripts and larger stores remain outside this bounded flow.</p>
 {resource.kind==='ready'&&resource.data.canConfigure?<>
 <form className="space-y-4" key={JSON.stringify(resource.data)} onChange={()=>setPreview(null)} onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setPreview(null);try{await operatorMutation('/api/operator/settings/redaction',{enabled:data.has('enabled'),kinds:data.getAll('kinds'),patterns:String(data.get('patterns')).split(/\r?\n/).filter(Boolean)},'PUT');setMessage('Redaction rules saved for new captures.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save redaction rules.')}finally{setBusy(false)}}}>
 <label className="flex min-h-11 items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={resource.data.enabled}/>Enable redaction for new captures</label>
 <fieldset className="space-y-2"><legend className="font-bold">Default kinds</legend>{kinds.map(kind=><label key={kind} className="flex min-h-11 items-center gap-2"><input name="kinds" value={kind} type="checkbox" defaultChecked={resource.data.kinds.includes(kind)}/>{labels[kind]}</label>)}</fieldset>
 <label className={fieldLabelClass}>Custom patterns<textarea name="patterns" className={fieldClass} rows={3} defaultValue={resource.data.patterns.join('\n')}/></label>
 <p className="text-sm">One pattern per line, at most ten. Use literals, character classes and fixed repetitions such as ACCOUNT-[0-9]{4}. Groups, variable repetition, lookarounds and backreferences are refused. Each capture has a bounded matching budget.</p>
 <button className={buttonClass} disabled={busy}>Save redaction rules</button>
 </form>
 <div className="mt-6 border-t pt-5"><p>Reapplying permanently replaces sensitive text in stored evidence wording versions, including history. It cannot be undone here. Keep originals only in the source system.</p>
 <button className={`${buttonClass} mt-4`} disabled={busy||!resource.data.enabled} onClick={async()=>{setBusy(true);try{setPreview(await operatorMutation('/api/operator/settings/redaction/preview',{}) as {records:number;changes:number;planHash:string});setMessage('Review the counts before confirming irreversible redaction.')}catch(error){setMessage(error instanceof Error?error.message:'Could not preview.')}finally{setBusy(false)}}}>Preview stored evidence redaction</button>
 {preview?<form className="mt-4 space-y-3" onSubmit={async event=>{event.preventDefault();setBusy(true);try{const result=await operatorMutation('/api/operator/settings/redaction/reapply',{planHash:preview.planHash,confirmIrreversible:true}) as {changed:number};setMessage(`Redaction applied to ${result.changed} evidence versions.`);setPreview(null)}catch(error){setMessage(error instanceof Error?error.message:'Could not apply redaction.')}finally{setBusy(false)}}}><p>{preview.records} evidence versions checked; {preview.changes} will change.</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" required/>I understand this permanently removes the matched wording.</label><button className={buttonClass} disabled={busy}>Redact stored evidence permanently</button></form>:null}</div>
 </>:<p>{resource.kind==='loading'?'Loading redaction settings…':'Owner access is required to configure redaction.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
