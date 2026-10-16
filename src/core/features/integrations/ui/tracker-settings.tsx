import {useEffect,useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../../auth/client-mutations'
import {fieldLabelClass,insetPanelClass,textLinkClass} from '@/core/ui/app/classes'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {outboundRelayRequired} from '../relay'
import {Help,JiraIdHelp,JiraSecretHelp,JiraTokenHelp,LinearSecretHelp,WebhookUrl} from './tracker-help'
import {LinearTeamPicker} from './linear-team-picker'
export interface TrackerSnapshot {transport:string;connections:{id:string;name:string;provider:string;revoked_at:number|null}[];commands:{id:string;request_id:string|null;decision_id:string|null;connection_id:string;link_id:string|null;held:number;state:string|null;attempts:number|null}[]}
const randomSecret=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),byte=>byte.toString(16).padStart(2,'0')).join('')
export function TrackerSettings(){
 const [resource,reload]=useOperatorResource<TrackerSnapshot>('/api/operator/integrations/trackers'),[provider,setProvider]=useState('linear'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 // The connection id is chosen here so its webhook URL can be set in Linear or Jira before saving.
 const [connectionId,setConnectionId]=useState(''),[site,setSite]=useState(''),[jiraSecret,setJiraSecret]=useState(''),[linearReady,setLinearReady]=useState(false)
 useEffect(()=>{setConnectionId(crypto.randomUUID());setJiraSecret(randomSecret())},[])
 const relay=resource.kind==='ready'&&resource.data.transport==='configured'
 function save(form:HTMLFormElement){
  const values=new FormData(form);setBusy(true);setMessage('')
  void operatorMutation('/api/operator/integrations/trackers/connections',{...(connectionId?{id:connectionId}:{}),provider,...Object.fromEntries(['name','projectIdentity','organizationIdentity','siteOrigin','issueType','apiToken','apiEmail','signingKey'].map(name=>[name,String(values.get(name)??'')]))})
   .then(()=>{form.reset();setLinearReady(false);setConnectionId(crypto.randomUUID());setJiraSecret(randomSecret());reload();setMessage('Tracker connection saved. Secrets cannot be read back.')})
   .catch(error=>setMessage(error instanceof Error&&error.message.includes('relay')?error.message:'The tracker connection could not be saved. Check its fields and your session.')).finally(()=>setBusy(false))
 }
 return <SectionCard id="tracker-settings-heading" icon="plug" title="Tracker connections" description="Link Linear or Jira issues to requests and decisions, and receive their status as private evidence. An operator still chooses Penny’s public status."><div className="space-y-4">
 {resource.kind==='ready'?<>{relay?null:<p className="rounded-lg border border-penny-line bg-penny-paper p-4 text-base text-penny-ink">Creating issues from Penny: {outboundRelayRequired} Linking known issues and receiving their status work now.</p>}
 <form aria-label="New tracker connection" className="space-y-5" onSubmit={event=>{event.preventDefault();save(event.currentTarget)}}>
 <label className={fieldLabelClass}>Tracker name<input name="name" required maxLength={128} className={fieldClass}/></label><label className={fieldLabelClass}>Tracker provider<select value={provider} onChange={event=>setProvider(event.target.value)} className={fieldClass}><option value="linear">Linear</option><option value="jira">Jira Cloud</option></select></label>
 <WebhookUrl id={connectionId}/>
 {provider==='linear'?<LinearTeamPicker key={connectionId} relay={relay} onReady={setLinearReady}/>
  :<><label className={fieldLabelClass}>Jira site origin<input name="siteOrigin" type="url" required placeholder="https://your-site.atlassian.net" value={site} onChange={event=>setSite(event.target.value)} className={fieldClass}/></label><JiraIdHelp site={site}/><label className={fieldLabelClass}>Jira project ID<input name="projectIdentity" required maxLength={128} inputMode="numeric" className={fieldClass} aria-describedby="jira-id-help"/></label><label className={fieldLabelClass}>Jira issue type ID<input name="issueType" required inputMode="numeric" className={fieldClass} aria-describedby="jira-id-help"/></label></>}
 {relay&&provider==='jira'?<><JiraTokenHelp/><label className={fieldLabelClass}>Jira API email<input name="apiEmail" type="email" className={fieldClass}/></label><label className={fieldLabelClass}>Optional tracker API token<input name="apiToken" type="password" data-rer-private="" maxLength={4096} className={fieldClass}/></label></>:null}
 {provider==='linear'?<LinearSecretHelp/>:<JiraSecretHelp site={site}/>}
 <label className={fieldLabelClass}>Tracker webhook signing secret<input key={provider+jiraSecret} name="signingKey" type="password" data-rer-private="" required minLength={32} maxLength={4096} defaultValue={provider==='jira'?jiraSecret:''} className={fieldClass} aria-describedby="tracker-secret-help"/></label>
 {provider==='jira'?<Help>Penny filled in a new random secret. <button type="button" className={`min-h-11 ${textLinkClass}`} onClick={()=>void navigator.clipboard?.writeText(jiraSecret).then(()=>setMessage('Secret copied. Paste it into the Jira webhook’s Secret field.'))}>Copy secret</button></Help>:null}
 <button disabled={busy||(provider==='linear'&&!linearReady)} className={buttonClass}>Save tracker connection</button></form>
 <ul className="space-y-3">{resource.data.connections.map(connection=><li className={`${insetPanelClass} break-words p-4`} key={connection.id}>{connection.name} · {connection.provider==='jira'?'Jira Cloud':'Linear'} · {connection.revoked_at?'revoked':'active'}<p className="text-sm">Webhook URL: {typeof location==='undefined'?'':location.origin}/api/integrations/trackers/{connection.id}</p>{!connection.revoked_at?<button className={`min-h-11 ${textLinkClass}`} disabled={busy} onClick={()=>{void operatorMutation('/api/operator/integrations/trackers/connections/'+connection.id,{},'DELETE').then(()=>{reload();setMessage('Tracker connection revoked.')}).catch(()=>setMessage('Revocation failed. Check your session.'))}}>Revoke {connection.name}</button>:null}</li>)}</ul>
 </>:resource.kind==='loading'?<p>Loading tracker connections…</p>:<><p role="alert">Tracker connections could not be loaded.</p><button className={`min-h-11 ${textLinkClass}`} onClick={reload}>Retry tracker connections</button></>}{message?<p role="status">{message}</p>:null}</div></SectionCard>
}
