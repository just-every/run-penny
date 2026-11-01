import {useState} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {operatorMutation} from '../requests/ui/operator-client'
import {buttonClass,fieldClass} from '../auth/client-mutations'
import {fieldLabelClass} from '@/core/ui/app/classes'
const labels={inbox:'New inbox item on my boards',mention:'Mention',assignment:'Assignment',aging:'Aging reminder',review:'Decision review due',failure:'Connector failure',release:'Release published',demand:'Demand threshold reached'}
interface Status {configured:boolean;settings:{enabled:boolean;demandThreshold:number;events:Record<string,string>};deliveries:{id:string;state:string;failure:string|null;event_count:number}[]}
const path='/api/operator/integrations/teams/notifications'
export function TeamsNotifications(){
 const [resource,reload]=useOperatorResource<Status>(path),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function save(body:unknown,suffix='',method='PUT'){setBusy(true);try{await operatorMutation(path+suffix,body,method);setMessage('Teams notification preferences saved.');reload()}catch(error){setMessage(error instanceof Error?error.message:'Could not save preferences.')}finally{setBusy(false)}}
 if(resource.kind==='loading')return <p>Loading Teams notification preferences…</p>
 if(resource.kind!=='ready')return <p role="status">Could not load Teams notifications. Refresh the page or sign in again.</p>
 const data=resource.data
 return <div className="mt-6 space-y-4 border-t border-penny-line pt-5">
 <h3 className="text-lg font-medium">Your Teams notifications</h3>
 <p>The owner configures the destination channel. Messages contain event counts and a sign-in link only. Daily and weekly digests use the workspace timezone. Mentions, assignments and reviews are the only events selected initially. Existing in-app mention notices stay on.</p>
 {!data.configured?<p>Teams notifications need an owner-configured Workflow endpoint and enforcing transport.</p>:null}
 <form key={JSON.stringify(data.settings)} className="space-y-4" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);void save({enabled:form.get('enabled')==='on',demandThreshold:Number(form.get('threshold')),events:Object.fromEntries(Object.keys(labels).map(key=>[key,String(form.get(key))]))})}}>
 <div className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key,label])=><label key={key} className={fieldLabelClass}>{label}<select className={fieldClass} name={key} defaultValue={data.settings.events[key]}>{['off','immediate','daily','weekly'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}</div>
 <label className={fieldLabelClass}>Demand threshold (votes)<input className={fieldClass} type="number" min={1} max={1000000} name="threshold" defaultValue={data.settings.demandThreshold}/></label>
 <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="enabled" defaultChecked={data.settings.enabled}/>Send my selected events to the configured Teams channel</label>
 <button className={buttonClass} disabled={busy||!data.configured}>Save Teams notifications</button>
 </form>
 <p role="status">{message}</p>
 <button className={buttonClass} disabled={busy} onClick={reload}>Refresh Teams notifications</button>
 <ul className="space-y-3" aria-label="Teams notification deliveries">{data.deliveries.map(item=><li key={item.id} className="break-words"><p>{item.event_count} events · {item.state}</p>{item.failure?<p role="status">{item.failure==='demo_send_suppressed'?'Demo notifications are suppressed.':item.failure==='interrupted_send_review_required'?'The send was interrupted. Check Teams before marking it resolved; Penny will not send it again.':'The send needs review. Check the Workflow connection and destination; Penny will not replay an uncertain send.'}</p>:null}{item.state==='failed'?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:item.id,action:'retry'},'/resolve','POST')}>Retry Teams notification</button>:null}{['pending','failed','unknown'].includes(item.state)?<button className={buttonClass} disabled={busy} onClick={()=>void save({id:item.id},'/resolve','POST')}>Mark Teams delivery resolved</button>:null}</li>)}</ul>
 </div>
}
