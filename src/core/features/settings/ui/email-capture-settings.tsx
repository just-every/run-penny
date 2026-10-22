import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
export function EmailCaptureSettings(){
 const [resource,reload]=useOperatorResource<{captureAddress:string;domains:string[];refusals:{reason:string;count:number}[]}>('/api/operator/settings/email-capture')
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 return <fieldset className="mt-8 space-y-5 border-t pt-6"><legend className="font-semibold">Capture forwarded email</legend>
  <p>Route a separate address to this Worker using Cloudflare Email Routing. Current operators and the allowed domains below must pass DMARC alignment. Notification replies are refused. No reply is sent.</p>
  {resource.kind==='ready'?<form className="space-y-5" key={JSON.stringify(resource.data)} onSubmit={async event=>{event.preventDefault();const values=new FormData(event.currentTarget);setBusy(true);try{await operatorMutation('/api/operator/settings/email-capture',{captureAddress:String(values.get('captureAddress')),domains:String(values.get('domains')).split(/\r?\n/).map(value=>value.trim()).filter(Boolean)},'PUT');setMessage('Capture settings saved. Hosted routing must be configured separately.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save capture settings.')}finally{setBusy(false)}}}>
   <label className={fieldLabelClass}>Dedicated capture address<input className={fieldClass} name="captureAddress" type="email" required maxLength={254} defaultValue={resource.data.captureAddress}/></label>
   <label className={fieldLabelClass}>Allowed sender domains<textarea className={fieldClass} name="domains" rows={4} defaultValue={resource.data.domains.join('\n')}/></label>
   <p>One exact domain per line. Empty allows only current operators. Direct or BCC copies without a forwarded sender are attributed to the admitted sender and marked not forwarded.</p>
   <button disabled={busy} className={buttonClass}>Save capture settings</button>
   {resource.data.refusals.length?<ul aria-label="Email capture refusal counts">{resource.data.refusals.map(row=><li key={row.reason}>{row.reason.replaceAll('_',' ')}: {row.count}</li>)}</ul>:<p>No refused captures recorded.</p>}
  </form>:<p role="status">{resource.kind==='loading'?'Loading capture settings…':'Capture settings unavailable.'}</p>}
  <p role="status">{message}</p>
 </fieldset>
}
