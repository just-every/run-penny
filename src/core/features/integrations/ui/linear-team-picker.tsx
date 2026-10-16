import {useState} from 'react'
import {fieldLabelClass,secondaryButtonClass} from '@/core/ui/app/classes'
import {fieldClass} from '../../auth/client-mutations'
import {operatorMutation} from '../../requests/ui/operator-client'
import {Help} from './tracker-help'

type Workspace={organization:{id:string;name:string};teams:{id:string;name:string}[]}
/** Linear setup needs only a personal API key: Penny asks Linear for the
 * workspace's teams on the server, and the owner picks one by name. */
export function LinearTeamPicker({relay,onReady}:{relay:boolean;onReady:(ready:boolean)=>void}){
 const [key,setKey]=useState(''),[workspace,setWorkspace]=useState<Workspace|null>(null),[team,setTeam]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const list=()=>{
  setBusy(true);setError('');setWorkspace(null);onReady(false)
  void (operatorMutation('/api/operator/integrations/trackers/linear/teams',{apiKey:key}) as Promise<Workspace>)
   .then(found=>{setWorkspace(found);setTeam(found.teams[0]?.id??'');onReady(found.teams.length>0);if(!found.teams.length)setError('This Linear workspace has no teams yet. Create one in Linear, then list again.')})
   .catch(failure=>setError(failure instanceof Error?failure.message:'Penny could not list your Linear teams.')).finally(()=>setBusy(false))
 }
 return <>
  <Help id="linear-key-help">Paste the key from step 1, then list your teams. {relay?'Penny keeps the key to create issues from Penny.':'Penny uses it only to list your teams and does not keep it.'}</Help>
  <label className={fieldLabelClass}>Linear personal API key<input type="password" data-rer-private="" value={key} onChange={event=>{setKey(event.target.value);setWorkspace(null);onReady(false)}} maxLength={4096} className={fieldClass} aria-describedby="linear-key-help"/></label>
  <button type="button" className={secondaryButtonClass} disabled={busy||!key.trim()} onClick={list}>{busy?'Asking Linear…':'List my teams'}</button>
  {workspace&&workspace.teams.length?<>
   <label className={fieldLabelClass}>Team in {workspace.organization.name}<select name="projectIdentity" required value={team} onChange={event=>setTeam(event.target.value)} className={fieldClass}>{workspace.teams.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <input type="hidden" name="organizationIdentity" value={workspace.organization.id}/>
   {relay?<input type="hidden" name="apiToken" value={key}/>:null}
  </>:null}
  {error?<p role="alert" className="text-sm text-penny-danger">{error}</p>:null}
 </>
}
