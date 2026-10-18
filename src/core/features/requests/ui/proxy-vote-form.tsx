import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { useLoopOptions } from '@/core/app/ui/loop-form'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { disclosureSummaryClass,fieldLabelClass,secondaryButtonClass,inputClass } from '@/core/ui/app/classes'
import { operatorMutation } from './operator-client'

interface Contact {id:string;displayName:string;email:string|null}
export function ProxyVoteForm({slug,evidenceId,requesterId,onSaved}:{slug?:string;evidenceId?:string;requesterId?:string;onSaved:()=>void}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[isNew,setNew]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [contacts,reload]=useOperatorResource<Contact[]>(`/api/operator/proxy-votes/contacts?q=${encodeURIComponent(query)}`),options=useLoopOptions()
 const [selectedRequest,setSelectedRequest]=useState('')
 const currentSlug=slug??(selectedRequest||(options.kind==='ready'?options.data.requests[0]?.slug??'':''))
 const [importanceOptions,importanceReload]=useOperatorResource<{enabled:boolean;labels:readonly string[]}>(currentSlug?`/api/operator/requests/${currentSlug}/vote-importance-options`:null)
 const field=`mt-2 ${inputClass}`
 return <details className="group mt-4 border-t border-penny-line pt-1"><summary className={disclosureSummaryClass}>Record a customer’s vote</summary>
 <p className="mt-2 text-sm leading-6 text-penny-muted">Record the source that justifies the vote. This does not verify the customer or subscribe them to email.</p>
 <div className="mt-3 flex flex-wrap items-end gap-2"><label className={`${fieldLabelClass} min-w-0 flex-1`}>Find an existing customer<input value={search} onChange={e=>setSearch(e.target.value)} className={field}/></label><button type="button" className={secondaryButtonClass} onClick={()=>setQuery(search)}>Find customer</button></div>
 <form className="mt-3 max-w-3xl space-y-3" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');const form=event.currentTarget,data=new FormData(form),selectedSlug=slug??String(data.get('requestSlug'))
  try{const result=await operatorMutation(`/api/operator/requests/${selectedSlug}/proxy-votes`,{
   ...(isNew?{contact:{displayName:String(data.get('displayName')),...(data.get('email')?{email:String(data.get('email'))}:{})}}:{requesterId:String(data.get('requesterId'))}),
   source:data.get('source'),...(data.get('importance')?{importance:Number(data.get('importance'))}:{}),...(data.get('sourceUrl')?{sourceUrl:data.get('sourceUrl')}:{}),...(evidenceId?{evidenceId}:{}),
  }) as {created:boolean}
   setMessage(result.created?'Customer vote recorded. No email permission was created.':'This customer already supports this request. No second vote was added.');if(isNew){form.reset();setNew(false)}reload();onSaved()
  }catch(error){setMessage(error instanceof Error?error.message:'Could not record the vote.')}finally{setBusy(false)}
 }}>
 {!slug?<label className={fieldLabelClass}>Request<select name="requestSlug" required className={field} onChange={event=>setSelectedRequest(event.target.value)}>{options.kind==='ready'?(options.data.requests.length?options.data.requests.map(item=><option key={item.id} value={item.slug}>{item.label}</option>):<option value="">No requests yet</option>):<option value="">Loading requests…</option>}</select></label>:null}
 <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={isNew} onChange={e=>setNew(e.target.checked)}/>Create a new unverified contact</label>
 {isNew?<><label className={fieldLabelClass}>Customer display name<input required name="displayName" maxLength={160} className={field}/></label><label className={fieldLabelClass}>Customer email (optional, remains unverified)<input type="email" name="email" maxLength={254} className={field}/></label></>:contacts.kind==='ready'?<label className={fieldLabelClass}>Existing customer<select key={query} name="requesterId" required defaultValue={requesterId} className={field}><option value="">Choose a customer</option>{contacts.data.map(person=><option key={person.id} value={person.id}>{person.displayName}{person.email?` · ${person.email}`:''}</option>)}</select></label>:<OperatorOptionsState state={contacts} loading="Loading customers…" failure="Could not load customers" reload={reload}/>}
 {importanceOptions.kind==='ready'&&importanceOptions.data.enabled?<label className={fieldLabelClass}>Customer’s stated importance (optional)<select name="importance" className={field}><option value="">No importance stated</option>{importanceOptions.data.labels.map((label,index)=><option key={index} value={index+1}>{label}</option>)}</select></label>:null}
 {currentSlug&&importanceOptions.kind!=='ready'?<OperatorOptionsState state={importanceOptions} loading="Loading importance choices…" failure="Could not load importance choices" reload={importanceReload}/>:null}
 <label className={fieldLabelClass}>Source justifying this vote<textarea name="source" required maxLength={2000} rows={2} className={field}/></label>
 <label className={fieldLabelClass}>Original source URL (optional)<input type="url" name="sourceUrl" className={field}/></label>
 <button disabled={busy||(!isNew&&contacts.kind!=='ready')||importanceOptions.kind!=='ready'} className={secondaryButtonClass}>{busy?'Recording…':'Record proxy vote'}</button>
 {message?<p role="status" className="break-words text-sm leading-6 text-penny-ink">{message}</p>:null}
 </form></details>
}
