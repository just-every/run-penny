import {personHref} from '../../people/paths'
import {useState} from 'react'
import {useLocation} from '@tanstack/react-router'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {WorkspaceLink} from '../../workspace/ui/workspace-link'
import {operatorMutation} from './operator-client'
import {fieldClass} from '../../auth/client-mutations'
import {primaryButtonClass} from '@/core/ui/app/classes'
/** The directory opens the existing identity-merge door; the Person page only links here. */
export function RequesterMergeControl({id}:{id:string}){
 const location=useLocation()
 return location.hash===`merge-requesters-${id}`?<MergeIdentity id={id}/>:null
}
function MergeIdentity({id}:{id:string}){
 const [q,setQ]=useState(''),[selected,setSelected]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false)
 const [people]=useOperatorResource<{items:{id:string;displayName:string;email:string|null}[]}>('/api/operator/requesters?q='+encodeURIComponent(q))
 return <section className="mt-4 space-y-3" aria-label="Merge identity"><h4 className="font-semibold">Merge into another person</h4><p className="text-sm">Their addresses and activity move to the person you choose. Votes collapse; this grants no new permission.</p><label className="block text-sm font-semibold">Find the survivor<input className={fieldClass} type="search" value={q} onChange={e=>setQ(e.target.value)} maxLength={200}/></label><label className="block text-sm font-semibold">Surviving person<select aria-label="Surviving person" className={fieldClass} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a person</option>{people.kind==='ready'?people.data.items.filter(p=>p.id!==id).map(p=><option key={p.id} value={p.id}>{p.displayName}{p.email?' · '+p.email:''}</option>):null}</select></label><button className={primaryButtonClass} disabled={!selected||busy||done} onClick={async()=>{setBusy(true);try{await operatorMutation(`/api/operator/requesters/${id}/merge`,{targetRequesterId:selected});setDone(true);setMessage('Identities merged.')}catch(error){setMessage(error instanceof Error?error.message:'Could not merge identities.')}finally{setBusy(false)}}}>Confirm identity merge</button>{message?<p role="status" className="text-sm">{message}</p>:null}{done?<WorkspaceLink className="inline-flex min-h-11 items-center underline" href={personHref(selected)}>Open surviving person</WorkspaceLink>:null}</section>
}
