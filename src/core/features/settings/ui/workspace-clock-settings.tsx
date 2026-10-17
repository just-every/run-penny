import {useEffect,useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass,textLinkClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {workspaceClockInput,type WorkspaceClock} from '../workspace-clock'

export function WorkspaceClockSettings(){
 const [resource,reload]=useOperatorResource<WorkspaceClock&{owner:boolean;canConfigure:boolean}>('/api/operator/settings/workspace-clock')
 return <SectionCard id="workspace-clock" icon="form" title="Workspace time and customer email" className="[&_h2]:scroll-mt-24" description="Choose the timezone used by decision reviews and the hours when requester email waits.">
  {resource.kind==='ready'?resource.data.canConfigure?<ClockForm key={JSON.stringify(resource.data)} clock={resource.data} reload={reload}/>:<p>Ask the installation owner or an Admin to change the workspace timezone or quiet hours.</p>:resource.kind==='loading'?<p>Loading workspace time…</p>:<><p role="alert">Workspace time could not be loaded.</p><button className={textLinkClass} onClick={reload}>Retry</button></>}
 </SectionCard>
}
function ClockForm({clock,reload}:{clock:WorkspaceClock;reload:()=>void}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[enabled,setEnabled]=useState(clock.quietEnabled)
 return <form className="space-y-5" onSubmit={async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),input=workspaceClockInput.safeParse({timezone:String(data.get('timezone')),quietEnabled:enabled,quietStart:Number(data.get('quietStart')),quietEnd:Number(data.get('quietEnd'))});if(!input.success){setMessage(input.error.issues[0].message);return}setBusy(true)
  try{await operatorMutation('/api/operator/settings/workspace-clock',input.data,'PUT');setMessage('Workspace time saved.');window.dispatchEvent(new Event('penny-workspace-clock-changed'));reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save workspace time.')}finally{setBusy(false)}
 }}>
  <label className={fieldLabelClass}>Workspace timezone<input name="timezone" className={fieldClass} required maxLength={100} defaultValue={clock.timezone} list="workspace-timezones"/></label>
  <datalist id="workspace-timezones">{Intl.supportedValuesOf('timeZone').map(timezone=><option key={timezone} value={timezone}/>)}</datalist>
  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>Use requester quiet hours</label>
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
   <label className={fieldLabelClass}>Quiet hours start (0–23)<input type="number" name="quietStart" min={0} max={23} required className={fieldClass} defaultValue={clock.quietStart}/></label>
   <label className={fieldLabelClass}>Quiet hours end (0–23)<input type="number" name="quietEnd" min={0} max={23} required className={fieldClass} defaultValue={clock.quietEnd}/></label>
  </div>
  <p className="text-sm">{enabled?'Customer email waits from the start hour until the end hour in your workspace timezone.':'Quiet hours are off. Queued customer email becomes eligible immediately after its normal coalescing window.'} Operator decision-review email always sends without quiet hours.</p>
  <button className={buttonClass} disabled={busy}>{busy?'Saving…':'Save workspace time'}</button><p role="status">{message}</p>
 </form>
}
export function WorkspaceClockPrompt(){
 const [resource,reload]=useOperatorResource<WorkspaceClock&{owner:boolean;canConfigure:boolean}>('/api/operator/settings/workspace-clock')
 useEffect(()=>{window.addEventListener('penny-workspace-clock-changed',reload);return()=>window.removeEventListener('penny-workspace-clock-changed',reload)},[reload])
 return resource.kind==='ready'&&resource.data.owner&&!resource.data.confirmed?<aside aria-label="Confirm workspace time" className="my-5 rounded-xl border border-penny-line bg-penny-card p-5"><h2 className="text-lg font-bold">Confirm your workspace time</h2><p className="mt-2">Your workspace currently uses {resource.data.timezone}, with requester quiet hours from 20:00 to 08:00. <a className={textLinkClass} href="/app/settings#workspace-clock">Confirm or change the timezone and quiet hours.</a></p></aside>:null
}
