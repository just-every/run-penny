import {discordFailureHint} from './failure-hint'
import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
interface Settings {guildId:string;channelIds:string[];emoji:string;enabled:boolean;purgeDays:number}
interface Status {canConfigure:boolean;configured:boolean;applicationId:string|null;owner:string|null;settings:Settings|null;counts:{state:string;count:number}[];jobs:{id:string;ownerName:string|null;message_id:string;channel_id:string;guild_id:string;trigger_kind:string;state:string;attempts:number;failure:string|null;updated_at:string}[]}
const path='/api/operator/integrations/discord'
export function DiscordSettings(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function save(body:unknown,suffix='',method='PUT'){setBusy(true);try{await operatorMutation(path+suffix,body,method);setMessage('Discord settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Discord settings could not be saved.')}finally{setBusy(false)}}
 return <SectionCard id="discord-capture" icon="evidence" title="Discord capture" description="Capture a community message with Send to Penny or a selected reaction. Only selected channels are read.">
 {resource.kind==='ready'&&resource.data.canConfigure?<div className="space-y-5">
  <p>{resource.data.configured?'Discord transport configured.':'Discord is unavailable. Configure the application secret and enforcing transport before enabling capture.'}</p>
  <p>Captured authors remain unverified source people. Capture grants no sign-in or email permission. Attachments, embeds and surrounding messages are omitted.</p>
  <form className="space-y-5" key={JSON.stringify(resource.data.settings)} onSubmit={event=>{event.preventDefault();const values=new FormData(event.currentTarget);void save({guildId:String(values.get('guildId')),channelIds:String(values.get('channelIds')).split(/\s+/).filter(Boolean),emoji:String(values.get('emoji')),purgeDays:Number(values.get('purgeDays')),enabled:values.get('enabled')==='on'})}}>
   <div className="grid gap-5 sm:grid-cols-2">
    <label className={fieldLabelClass}>Discord server ID<input required className={fieldClass} name="guildId" inputMode="numeric" pattern="[0-9]{17,20}" defaultValue={resource.data.settings?.guildId}/></label>
    <label className={fieldLabelClass}>Reaction emoji or custom emoji ID<input required className={fieldClass} name="emoji" maxLength={100} defaultValue={resource.data.settings?.emoji??'📌'}/></label>
   </div>
   <label className={fieldLabelClass}>Selected channel IDs<textarea required className={fieldClass} name="channelIds" rows={3} aria-describedby="discord-channel-help" defaultValue={resource.data.settings?.channelIds.join('\n')}/></label><p id="discord-channel-help" className="text-sm">One ID per line. Discord Developer Mode exposes Copy ID. Threads must be selected by their own IDs.</p>
   <label className={fieldLabelClass}>Days to retain an excerpt after source removal<input required className={fieldClass} name="purgeDays" type="number" min={0} max={365} defaultValue={resource.data.settings?.purgeDays??0}/></label>
   <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={resource.data.settings?.enabled??false} disabled={!resource.data.configured}/>Enable Discord capture</label>
   <p className="text-sm text-penny-muted">Saving assigns you as the accountable owner and stops unfinished work. Retry selected jobs after reviewing the new scope. Pausing stops capture; due excerpt purges continue.</p>
   <button className={buttonClass} disabled={busy}>Save Discord capture</button>
  </form>
  <div className="border-t border-penny-line pt-5"><h3 className="font-semibold">Capture progress</h3><p className="mt-2">{resource.data.counts.map(row=>`${row.count} ${row.state}`).join(' · ')||'No captures yet.'}</p><button type="button" className={buttonClass+' mt-3'} onClick={reload}>Refresh Discord progress</button>
   <ul className="mt-4 space-y-4" aria-label="Discord capture jobs">{resource.data.jobs.map(job=><li className="rounded-lg border border-penny-line p-4" key={job.id}><a className="inline-flex min-h-11 items-center underline" href={`https://discord.com/channels/${job.guild_id}/${job.channel_id}/${job.message_id}`} target="_blank" rel="noreferrer">Open Discord message</a><p>Accountable owner: {job.ownerName??'Removed owner'}</p><p>{job.trigger_kind} · {job.state} · {job.attempts} attempts</p>{job.failure?<p role="status">{discordFailureHint(job.failure)}</p>:null}{job.state!=='done'?<div className="mt-3 flex flex-wrap gap-3">{['failed','stopped','held'].includes(job.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'retry'},'/jobs','POST')}>Retry capture</button>:null}<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'stop'},'/jobs','POST')}>Stop capture</button>{['failed','stopped','held'].includes(job.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:job.id,action:'forget'},'/jobs','POST')}>Forget capture</button>:null}</div>:null}</li>)}</ul>
  </div>
 </div>:<p role="status">{resource.kind==='loading'?'Loading Discord capture…':'Owner access is required to configure Discord capture.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
