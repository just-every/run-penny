import {useState} from 'react'
import {fieldLabelClass,secondaryButtonClass} from '@/core/ui/app/classes'
import {fieldClass} from '../../auth/client-mutations'
import {operatorMutation} from '../../requests/ui/operator-client'
import {External,Help} from './tracker-help'

type Project={id:string;key:string;name:string;issueTypes:{id:string;name:string}[]}
// Whatever Jira page is pasted, Penny keeps only the site's address.
const siteAddress=(text:string)=>{try{return new URL(/^https?:\/\//.test(text.trim())?text.trim():'https://'+text.trim()).origin}catch{return ''}}

/** Jira setup in plain steps: the site address, the email you sign in with and
 * an API token; Penny lists the projects and issue types by name on the server. */
export function JiraProjectPicker({relay,site,onSite,onReady}:{relay:boolean;site:string;onSite:(site:string)=>void;onReady:(ready:boolean)=>void}){
 const [address,setAddress]=useState(''),[email,setEmail]=useState(''),[token,setToken]=useState(''),[projects,setProjects]=useState<Project[]|null>(null),[project,setProject]=useState(''),[type,setType]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const changed=()=>{setProjects(null);onReady(false)}
 const chosen=projects?.find(item=>item.id===project)
 const list=()=>{
  setBusy(true);setError('');changed()
  void (operatorMutation('/api/operator/integrations/trackers/jira/projects',{site,email,apiToken:token}) as Promise<{projects:Project[]}>)
   .then(({projects:found})=>{setProjects(found);setProject(found[0]?.id??'');setType(found[0]?.issueTypes.find(item=>item.name==='Task')?.id??found[0]?.issueTypes[0]?.id??'');onReady(found.length>0);if(!found.length)setError('This Jira site has no projects you can see. Create one in Jira, then list again.')})
   .catch(failure=>setError(failure instanceof Error?failure.message:'Penny could not list your Jira projects.')).finally(()=>setBusy(false))
 }
 return <>
  <label className={fieldLabelClass}>Jira site address<input type="text" required placeholder="https://your-team.atlassian.net" value={address} onChange={event=>{setAddress(event.target.value);onSite(siteAddress(event.target.value));changed()}} className={fieldClass} aria-describedby="jira-site-help"/></label>
  <Help id="jira-site-help">The address you open Jira at, such as https://your-team.atlassian.net. You can paste any Jira page’s address; Penny keeps only this first part{site?<>: <strong>{site}</strong></>:null}.</Help>
  <input type="hidden" name="siteOrigin" value={site}/>
  <label className={fieldLabelClass}>Email you sign in to Jira with<input type="email" value={email} onChange={event=>{setEmail(event.target.value);changed()}} className={fieldClass}/></label>
  <label className={fieldLabelClass}>Jira API token<input type="password" data-rer-private="" value={token} onChange={event=>{setToken(event.target.value);changed()}} maxLength={4096} className={fieldClass} aria-describedby="jira-token-help"/></label>
  <Help id="jira-token-help">Make one at <External href="https://id.atlassian.com/manage-profile/security/api-tokens">Atlassian account → Security → API tokens</External> (Create API token), copy it and paste it here. {relay?'Penny keeps it to create issues from Penny.':'Penny uses it only to list your projects and does not keep it.'}</Help>
  <button type="button" className={secondaryButtonClass} disabled={busy||!site||!email.trim()||!token.trim()} onClick={list}>{busy?'Asking Jira…':'List my projects'}</button>
  {projects&&projects.length?<>
   <label className={fieldLabelClass}>Project<select name="projectIdentity" required value={project} onChange={event=>{const next=projects.find(item=>item.id===event.target.value);setProject(event.target.value);setType(next?.issueTypes.find(item=>item.name==='Task')?.id??next?.issueTypes[0]?.id??'')}} className={fieldClass}>{projects.map(item=><option key={item.id} value={item.id}>{item.name} ({item.key})</option>)}</select></label>
   <label className={fieldLabelClass}>Kind of issue Penny creates<select name="issueType" required value={type} onChange={event=>setType(event.target.value)} className={fieldClass}>{chosen?.issueTypes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   {relay?<><input type="hidden" name="apiEmail" value={email}/><input type="hidden" name="apiToken" value={token}/></>:null}
  </>:null}
  {error?<p role="alert" className="text-sm text-penny-danger">{error}</p>:null}
 </>
}
