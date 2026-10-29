import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {SectionCard} from '@/core/ui/app/SectionCard'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
type Status={ownerName:string|null;canConfigure:boolean;transport:boolean;credentialStored:boolean;connection:null|{mailbox_id:number;tag:string;sidebar_user_id:number;enabled:number;purge_days:number;last_success?:string;failure?:string};jobs:{conversation_id:number;state:string;attempts:number;failure:string|null;source_state:string}[]}
const path='/api/operator/integrations/helpscout'
export function HelpScoutSettings(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function act(body:unknown,suffix='',method='POST',form?:HTMLFormElement){setBusy(true);try{await operatorMutation(path+suffix,body,method);form?.reset();setMessage(method==='DELETE'?'Disconnected. Delete the OAuth application in Help Scout to revoke provider access.':'Help Scout settings saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Help Scout could not save.')}finally{setBusy(false)}}
 const data=resource.kind==='ready'?resource.data:null,row=data?.connection
 return <SectionCard id="helpscout-capture" icon="evidence" title="Help Scout capture" description="Link conversations to requests, capture tagged feedback and prepare replies in the Help Scout sidebar.">
 {data?.canConfigure?<div className="space-y-5">
  <p>{row?.enabled?'Connected':data.credentialStored?'Paused':'Disconnected'} · {data.transport?'Transport configured':'Configure an enforcing provider transport before connecting.'}</p>
  <p>Accountable owner: {data.ownerName??'Not connected'}</p>
  <p>Choose one mailbox and an automatic capture tag. Your Help Scout user may also capture a conversation explicitly in that mailbox. You are accountable for this delegated sidebar and background work. Other users cannot use it.</p>
  <form className="space-y-4" onSubmit={event=>{event.preventDefault();const form=event.currentTarget,values=new FormData(form);void act({mailboxId:Number(values.get('mailboxId')),tag:String(values.get('tag')),sidebarUserId:Number(values.get('sidebarUserId')),purgeDays:Number(values.get('purgeDays')),clientId:String(values.get('clientId')),clientSecret:String(values.get('clientSecret')),appSecret:String(values.get('appSecret')),webhookSecret:String(values.get('webhookSecret'))},'','POST',form)}}>
   <div className="grid gap-4 sm:grid-cols-2">{[['mailboxId','Help Scout mailbox ID',row?.mailbox_id],['sidebarUserId','Your Help Scout user ID',row?.sidebar_user_id]].map(([name,label,value])=><label className={fieldLabelClass} key={name}>{label}<input name={String(name)} type="number" min={1} required className={fieldClass} defaultValue={value??''}/></label>)}</div>
   <label className={fieldLabelClass}>Automatic capture tag<input className={fieldClass} name="tag" required maxLength={100} defaultValue={row?.tag??'feedback'}/></label>
   <label className={fieldLabelClass}>Days to retain an excerpt after source removal<input className={fieldClass} name="purgeDays" type="number" min={0} max={365} required defaultValue={row?.purge_days??0}/></label>
   <details><summary className="cursor-pointer py-3 font-semibold">Connect or replace credentials</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">{[['clientId','OAuth application ID'],['clientSecret','OAuth application secret'],['appSecret','Dynamic App secret'],['webhookSecret','Webhook secret']].map(([name,label])=><label className={fieldLabelClass} key={name}>{label}<input name={name} type="password" autoComplete="new-password" required minLength={16} maxLength={name==='appSecret'||name==='webhookSecret'?40:4096} className={fieldClass}/></label>)}</div><p className="mt-3 text-sm">Secrets are stored only on this installation and never shown again or exported. Reconnecting replaces all credentials and invalidates sidebar access.</p></details>
   <p>Capture stores one customer excerpt, source links and attribution, after redaction. Attachments and private notes are omitted. Contacts remain unverified and receive no email permission.</p>
   <button className={buttonClass} disabled={busy||!data.transport}>Connect Help Scout</button>
  </form>
  {data.credentialStored?<div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy} onClick={()=>void act({action:row?.enabled?'pause':'resume'},'/control')}>{row?.enabled?'Pause Help Scout':'Resume Help Scout'}</button><button className={buttonClass} disabled={busy} onClick={()=>void act(undefined,'','DELETE')}>Disconnect Help Scout</button></div>:null}
  <p>Last successful capture: {row?.last_success??'None yet'}. {row?.failure?'Provider work failed. Check credentials and scope, then retry the affected conversation.':''}</p>
  <div><h3 className="font-semibold">Capture progress</h3><button className={buttonClass+' mt-3'} onClick={reload}>Refresh Help Scout progress</button><ul className="mt-4 space-y-3">{data.jobs.map(job=><li className="rounded-lg border border-penny-line p-4" key={job.conversation_id}><p>Conversation {job.conversation_id} · {job.state} · source {job.source_state} · {job.attempts} attempts</p>{job.failure?<p role="status">Capture needs attention. Check source access or reconnect, then retry.</p>:null}{['failed','held','stopped'].includes(job.state)?<button className={buttonClass} disabled={busy||!row?.enabled} onClick={()=>void act({action:'retry',conversationId:job.conversation_id},'/control')}>Retry conversation {job.conversation_id}</button>:null}</li>)}</ul></div>
  <p className="text-sm">In Help Scout, set the Dynamic App callback to /api/integrations/helpscout/sidebar and signed conversation webhooks to /api/integrations/helpscout/webhook on this installation. The Help Scout guide describes the full URLs and recovery steps.</p>
 </div>:<p role="status">{resource.kind==='loading'?'Loading Help Scout…':'Owner access is required to configure Help Scout.'}</p>}
 <p role="status" className="mt-4">{message}</p>
 </SectionCard>
}
