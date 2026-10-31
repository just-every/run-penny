import {teamsFailureHint} from './failure-hint'
import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
import {TeamsNotifications} from './notification-ui'
interface Settings {teamId:string;channelIds:string[];enabled:boolean;purgeDays:number}
interface Status {canConfigure:boolean;configured:boolean;settings:Settings|null;counts:{state:string;count:number}[];jobs:{id:string;ownerName:string|null;message_id:string;channel_id:string;team_id:string;state:string;attempts:number;failure:string|null}[]}
const path='/api/operator/integrations/teams'
export function TeamsSettings(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function save(body:unknown,suffix='',method='PUT'){setBusy(true);try{await operatorMutation(path+suffix,body,method);setMessage('Teams settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Teams settings could not be saved.')}finally{setBusy(false)}}
 return <SectionCard id="teams-capture" icon="evidence" title="Microsoft Teams" description="Send a selected channel message to Penny. Only configured channels are read.">
 {resource.kind==='ready'&&resource.data.canConfigure?<div className="space-y-5">
  <p>{resource.data.configured?'Teams transport configured.':'Teams is unavailable. Configure the Entra application secret and enforcing transport before enabling capture.'}</p>
  <p>Authors remain unverified source people. Capture grants no sign-in or email permission. Only the selected message text is kept; attachments and surrounding conversation are omitted.</p>
  <form className="space-y-5" key={JSON.stringify(resource.data.settings)} onSubmit={event=>{event.preventDefault();const values=new FormData(event.currentTarget);void save({teamId:String(values.get('teamId')),channelIds:String(values.get('channelIds')).split(/\s+/).filter(Boolean),purgeDays:Number(values.get('purgeDays')),enabled:values.get('enabled')==='on'})}}>
   <label className={fieldLabelClass}>Teams group ID<input required className={fieldClass} name="teamId" defaultValue={resource.data.settings?.teamId}/></label>
   <label className={fieldLabelClass}>Selected Teams channel IDs<textarea required className={fieldClass} name="channelIds" rows={3} aria-describedby="teams-channel-help" defaultValue={resource.data.settings?.channelIds.join('\n')}/></label>
   <p id="teams-channel-help" className="text-sm">Use the team's Entra group UUID and exact channel IDs. See the <a className="underline" href="/docs/teams">Teams capture guide</a> for application installation and permissions.</p>
   <label className={fieldLabelClass}>Purge removed source text after days<input required type="number" min={0} max={365} className={fieldClass} name="purgeDays" defaultValue={resource.data.settings?.purgeDays??30}/></label>
   <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={resource.data.settings?.enabled??false}/>Enable Teams capture</label>
   <button className={buttonClass} disabled={busy||!resource.data.configured}>Save Teams capture</button>
  </form>
  <p>Saving stops queued captures and retries source checks. Disabling stops all provider reads; already removed text still purges on schedule.</p>
  <ul className="space-y-2" aria-label="Teams capture totals">{resource.data.counts.map(row=><li key={row.state}>{row.state}: {row.count}</li>)}</ul>
  <button className={buttonClass} disabled={busy} onClick={reload}>Refresh Teams progress</button>
  <ul className="space-y-4" aria-label="Teams capture jobs">{resource.data.jobs.map(job=><li className="rounded-lg border border-penny-line p-4 break-words" key={job.id}>
   <p>Message {job.message_id}</p><p>Accountable owner: {job.ownerName??'Removed owner'}</p><p>{job.state} · {job.attempts} attempts</p>
   {job.failure?<p role="status">{teamsFailureHint(job.failure)}</p>:null}
   {job.state!=='done'?<div className="mt-3 flex flex-wrap gap-3">{['failed','stopped','held'].includes(job.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'retry'},'/jobs','POST')}>Retry Teams capture</button>:null}<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'stop'},'/jobs','POST')}>Stop Teams capture</button>{['failed','stopped','held'].includes(job.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'forget'},'/jobs','POST')}>Forget Teams capture</button>:null}</div>:null}
  </li>)}</ul>
 </div>:resource.kind==='error'?<p role="status">Teams settings could not be loaded.</p>:resource.kind==='ready'?<p>Only the owner can configure Teams capture.</p>:null}
 <p role="status" className="mt-4">{message}</p>
 <TeamsNotifications/>
 </SectionCard>
}
