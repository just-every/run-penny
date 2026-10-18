import { useState, type FormEvent } from 'react'
import { operatorMutation } from './operator-client'
import { subformClass } from './form-classes'
import { fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'

export function MergeRequestForm({slug,onMerged}:{slug:string;onMerged:()=>void}){
 const [target,setTarget]=useState(''),[preview,setPreview]=useState<{recipientCount:number}|null>(null)
 const [notify,setNotify]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('')
  try{
   if(!preview){
    const response=await fetch(`/api/operator/requests/${slug}/merge-preview?${new URLSearchParams({targetSlug:target.trim()})}`)
    const result=await response.json() as {recipientCount:number;message?:string}
    if(!response.ok)throw new Error(result.message??'Could not review this merge.')
    setPreview(result)
   }else{
    await operatorMutation(`/api/operator/requests/${slug}/merge`,{targetSlug:target.trim(),notifySubscribers:notify})
    setMessage('Requests merged.');onMerged()
   }
  }catch(error){setMessage(error instanceof Error?error.message:'Could not merge requests.')}
  finally{setBusy(false)}
 }
 return <form aria-label="Merge duplicate request" className={`${subformClass} space-y-3`} onSubmit={submit}>
  <label className={fieldLabelClass}>Canonical request slug<input name="target" required value={target} onChange={event=>{setTarget(event.target.value);setPreview(null);setMessage('')}} className={fieldClass}/></label>
  {preview?<><p className="text-sm text-penny-muted">{preview.recipientCount} eligible {preview.recipientCount===1?'subscriber':'subscribers'} from this duplicate can be notified. People already following the canonical request are excluded.</p><label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-penny-ink"><input name="notifySubscribers" type="checkbox" checked={notify} onChange={event=>setNotify(event.target.checked)} className="size-4 accent-penny-ink"/>Notify subscribers about this merge</label><p className="text-sm text-penny-muted">The notice names and links the canonical request. If it is private, delivery waits until it is published on a public board. Current consent, mutes, quiet hours and unsubscribe still apply.</p></>:null}
  <button disabled={busy} className={primaryButtonClass}>{busy?'Saving…':preview?'Merge duplicate':'Review merge'}</button>
  {message?<p role="status" className="text-sm font-semibold text-penny-ink">{message}</p>:null}
 </form>
}
