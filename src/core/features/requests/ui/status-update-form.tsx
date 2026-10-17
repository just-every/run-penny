import { useRef, useState } from 'react'
import { fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import type { RequestStatusSettingsData } from '@/core/features/settings/request-statuses'
import { publicStatuses, statusLabel } from '../status-sql'
import { checkboxClass, checkRowClass, quietButtonClass, subformClass } from './form-classes'
import { operatorMutation } from './operator-client'

export interface RequestStatusDetails {status:string;statusSource:'direct'|'roadmap';publicEta:string|null;internalStatusId:string|null;internalStatusName:string|null}
export function StatusUpdateForm({slug,current,onSaved,onMessage,onReverse}:{slug:string;current:RequestStatusDetails;onSaved:()=>void;onMessage:(message:string)=>void;onReverse?:()=>void}) {
 const action=useRef<{body:string;key:string}|null>(null),sending=useRef(false)
 const [pending,setPending]=useState(false),[selection,setSelection]=useState(current.statusSource==='direct'&&current.internalStatusId?`internal:${current.internalStatusId}`:current.status)
 const [body,setBody]=useState(''),[settings]=usePublicResource<RequestStatusSettingsData>('/api/operator/settings/request-statuses')
 const statuses=settings.kind==='ready'?settings.data.statuses:[]
 const selectedInternal=statuses.find(item=>`internal:${item.id}`===selection)
 const status=selectedInternal?.publicStatus??selection
 function change(value:string){
  setSelection(value)
  const mapped=statuses.find(item=>`internal:${item.id}`===value)?.publicStatus??value
  setBody(settings.kind==='ready'?settings.data.templates[mapped as keyof typeof settings.data.templates]??'':'')
 }
 async function publish(form:HTMLFormElement){
  if(sending.current)return
  const data=new FormData(form),input={body,status,internalStatusId:selectedInternal?.id??null,publicEta:String(data.get('publicEta')??'').trim()||null,pinned:data.get('pinned')==='on'},serialized=JSON.stringify(input)
  if(action.current?.body!==serialized)action.current={body:serialized,key:crypto.randomUUID()}
  sending.current=true;setPending(true)
  try {
   await operatorMutation(`/api/operator/requests/${slug}/status-updates`,{...input,idempotencyKey:action.current.key})
   action.current=null;setBody('');onMessage('Status update published.');onSaved()
  }catch(error){onMessage(error instanceof Error?error.message:'The status update could not be published. Please try again.')}
  finally{sending.current=false;setPending(false)}
 }
 return <form className={`${subformClass} space-y-3`} onSubmit={event=>{event.preventDefault();void publish(event.currentTarget)}}>
  <h3 className="font-bold text-penny-ink">Publish status update</h3>
  <p className="text-sm text-penny-muted">Current public status: {statusLabel(current.status)} · {current.statusSource==='roadmap'?'Approved roadmap':'Direct status'}{current.internalStatusName&&current.statusSource==='direct'?` · ${current.internalStatusName}`:''}</p>
  <fieldset disabled={pending} className="min-w-0 space-y-3 border-0 p-0">
   <label className={fieldLabelClass}>Status<select name="status" value={selection} onChange={event=>change(event.target.value)} className={fieldClass}>
    {publicStatuses.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}
    {statuses.length?<optgroup label="Internal statuses">{statuses.map(item=><option key={item.id} value={`internal:${item.id}`}>{item.name} → {statusLabel(item.publicStatus)}</option>)}</optgroup>:null}
   </select></label>
   <label className={fieldLabelClass}>Public update<textarea name="body" required={status==='declined'} value={body} onChange={event=>setBody(event.target.value)} className={fieldClass}/><span className="text-sm font-normal text-penny-muted">Optional, except when declining. Only this wording is public.</span></label>
   <label className={fieldLabelClass}>Public ETA<input name="publicEta" defaultValue={current.publicEta??''} placeholder="2027-03 or 2027-Q1" pattern="[0-9]{4}-(0[1-9]|1[0-2]|Q[1-4])" className={fieldClass}/><span className="text-sm font-normal text-penny-muted">Month or quarter. Leave blank to clear it.</span></label>
   <label className={checkRowClass}><input type="checkbox" name="pinned" className={checkboxClass}/>Pin above comments</label>
   <div className="flex flex-wrap items-center gap-3">
    <button className={primaryButtonClass}>{pending?'Publishing…':'Publish status update'}</button>
    {onReverse?<button type="button" className={quietButtonClass} onClick={()=>{action.current=null;onReverse()}}>Reverse decline</button>:null}
   </div>
  </fieldset>
 </form>
}
