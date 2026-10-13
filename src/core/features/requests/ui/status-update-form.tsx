import { useRef, useState } from 'react'
import { fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, checkRowClass, quietButtonClass, subformClass } from './form-classes'
import { operatorMutation } from './operator-client'

export function StatusUpdateForm({slug,onSaved,onMessage,onReverse}:{slug:string;onSaved:()=>void;onMessage:(message:string)=>void;onReverse?:()=>void}) {
 const action=useRef<{body:string;key:string}|null>(null),sending=useRef(false)
 const [pending,setPending]=useState(false)
 async function publish(form:HTMLFormElement){
  if(sending.current)return
  const data=new FormData(form),input={body:data.get('body'),status:data.get('status'),pinned:data.get('pinned')==='on'},body=JSON.stringify(input)
  if(action.current?.body!==body)action.current={body,key:crypto.randomUUID()}
  sending.current=true;setPending(true)
  try {
   await operatorMutation(`/api/operator/requests/${slug}/status-updates`,{...input,idempotencyKey:action.current.key})
   action.current=null;form.reset();onMessage('Status update published.');onSaved()
  }catch(error){onMessage(error instanceof Error?error.message:'The status update could not be published. Please try again.')}
  finally{sending.current=false;setPending(false)}
 }
 return <form className={`${subformClass} space-y-3`} onSubmit={event=>{event.preventDefault();void publish(event.currentTarget)}}>
  <h3 className="font-bold text-penny-ink">Publish status update</h3>
  <fieldset disabled={pending} className="min-w-0 space-y-3 border-0 p-0">
   <label className={fieldLabelClass}>Status<select name="status" className={fieldClass}><option value="open">Open</option><option value="under_review">Under review</option><option value="declined">Declined</option></select></label>
   <label className={fieldLabelClass}>Public update<textarea required name="body" className={fieldClass}/></label>
   <label className={checkRowClass}><input type="checkbox" name="pinned" className={checkboxClass}/>Pin above comments</label>
   <div className="flex flex-wrap items-center gap-3">
    <button className={primaryButtonClass}>{pending?'Publishing…':'Publish status update'}</button>
    {onReverse ? <button type="button" className={quietButtonClass} onClick={event=>{
     // An explicit reversal ends even an uncertain preceding publication action.
     action.current=null;event.currentTarget.form?.reset();onReverse()
    }}>Reverse decline</button> : null}
   </div>
  </fieldset>
 </form>
}
