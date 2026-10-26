import {personHref} from '../../people/paths'
import {useRef,useState} from 'react'
import {Link,useLocation} from '@tanstack/react-router'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {OperatorResourceFailure,OperatorSessionExpired} from '@/core/app/ui/operator-resource-state'
import {WorkspaceLink} from '../../workspace/ui/workspace-link'
import {roundMutation,roundMutationFailure,type RoundMutationFailure} from './round-mutation'
import {fieldClass} from '../../auth/client-mutations'
import {primaryButtonClass,secondaryButtonClass} from '@/core/ui/app/classes'
/** The directory opens the identity-merge door; the Person page only links here. */
export function RequesterMergeControl({id}:{id:string}){
 const location=useLocation()
 return location.hash===`merge-requesters-${id}`?<MergeIdentity id={id}/>:null
}
function MergeIdentity({id}:{id:string}){
 const [q,setQ]=useState(''),[selected,setSelected]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[failure,setFailure]=useState<RoundMutationFailure|null>(null)
 const writing=useRef(false)
 const [people,reload,request]=useOperatorResource<{items:{id:string;displayName:string;email:string|null}[]}>('/api/operator/requesters?q='+encodeURIComponent(q))
 const options=people.kind==='ready'?people.data.items.filter(p=>p.id!==id):[]
 const survivor=options.find(p=>p.id===selected)
 const merge=async()=>{
  if(!survivor||writing.current||done||request.pending)return
  writing.current=true;setBusy(true);setMessage('');setFailure(null)
  try{await roundMutation(`/api/operator/requesters/${id}/merge`,{targetRequesterId:survivor.id});setDone(true);setMessage('Identities merged.')}
  catch(error){setFailure(roundMutationFailure(error,"Couldn't merge these people."))}
  finally{writing.current=false;setBusy(false)}
 }
 return <section className="mt-4 space-y-3" aria-label="Merge identity"><h4 className="font-semibold">Merge into another person</h4>
  <label className="block text-sm font-semibold">Find the survivor<input className={fieldClass} type="search" value={q} disabled={busy||done} onChange={e=>{setQ(e.target.value);setSelected('');setMessage('');setFailure(null)}} maxLength={200}/></label>
  <label className="block text-sm font-semibold">Surviving person<select aria-label="Surviving person" className={fieldClass} value={survivor?selected:''} disabled={busy||done} onChange={e=>{setSelected(e.target.value);setMessage('');setFailure(null)}}><option value="">Choose a person</option>{options.map(p=><option key={p.id} value={p.id}>{p.displayName}{p.email?' · '+p.email:''}</option>)}</select></label>
  {people.kind==='session_expired'?<OperatorSessionExpired/>:people.kind!=='ready'&&people.kind!=='loading'?<OperatorResourceFailure title="Could not load people." onRetry={reload}/>:null}
  <button type="button" className={primaryButtonClass} disabled={!survivor||busy||done||request.pending} onClick={merge}>{survivor?`Merge into ${survivor.displayName}`:'Merge identities'}</button>
  {message?<p role="status" className="text-sm">{message}</p>:null}
  {failure?<div className="text-sm"><p role="alert">{failure.message}</p>{failure.action==='retry'?<button type="button" className={`${secondaryButtonClass} mt-2`} disabled={!survivor||busy} onClick={merge}>Retry</button>:failure.action==='reload'?<button type="button" className={`${secondaryButtonClass} mt-2`} disabled={request.pending} onClick={()=>{setSelected('');setFailure(null);reload()}}>Reload</button>:failure.action==='sign_in'?<Link to="/signin" className={`${secondaryButtonClass} mt-2`}>Sign in now</Link>:null}</div>:null}
  {done?<WorkspaceLink className="inline-flex min-h-11 items-center underline" href={personHref(selected)}>Open surviving person</WorkspaceLink>:null}
 </section>
}
