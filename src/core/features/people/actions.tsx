import {useState} from 'react'
import {Field,LoopForm,controlClass} from '@/core/app/ui/loop-form'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {OperatorResourceFailure} from '@/core/app/ui/operator-resource-state'
import {RequesterBlockControl} from '../requests/ui/requester-block-control'
import {WorkspaceLink} from '../workspace/ui/workspace-link'
import {disclosureSummaryClass,secondaryButtonClass,textLinkClass} from '@/core/ui/app/classes'
import type {OperatorRequesterCard} from '../workspace/paged-service'
import type {PersonProfile} from './types'
export function PersonActions({person,onSaved}:{person:PersonProfile;onSaved:()=>void}){
 const [query,setQuery]=useState(''),[results,retry]=useOperatorResource<{items:OperatorRequesterCard[]}>(`/api/operator/requesters?q=${encodeURIComponent(query)}`)
 return <section className="space-y-4" aria-label="Person actions"><h2 className="text-xl font-bold">Manage this person</h2><RequesterBlockControl requester={person} onSaved={onSaved}/>
 <details className="group"><summary className={disclosureSummaryClass}>Merge person</summary><p className="my-3 text-sm text-penny-muted">Choose the identity to keep. This person’s addresses and activity join it through the existing requester merge.</p>
 <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="Find merge destination" onSubmit={event=>{event.preventDefault();setQuery(String(new FormData(event.currentTarget).get('q')??''))}}><label className="min-w-0 grow text-sm font-semibold">Find a person<input className={controlClass} name="q" maxLength={200}/></label><button className={secondaryButtonClass}>Search people</button></form>
 {results.kind==='error'?<OperatorResourceFailure title="Could not find people." onRetry={retry}/>:null}
 <LoopForm title="Merge this identity" action={`/api/operator/requesters/${person.id}/merge`} submit="Confirm merge person" disabled={results.kind!=='ready'} transform={data=>({targetRequesterId:data.get('targetRequesterId')})} onSaved={onSaved}><Field name="targetRequesterId" label="Identity to keep" choices={results.kind==='ready'?results.data.items.filter(p=>p.id!==person.id).map(p=>({id:p.id,label:`${p.displayName}${p.email?` · ${p.email}`:''}`})):[]} required/><label className="flex min-h-11 items-start gap-3 text-sm"><input className="mt-1" type="checkbox" required/>I confirm that these records belong to the same person.</label></LoopForm></details>
 <p className="text-sm"><WorkspaceLink className={textLinkClass} href="/app/data">Export data or review erasure</WorkspaceLink></p><p className="text-sm text-penny-muted">Exports contain workspace data. In Data, choose this person by name to review their erasure before confirming.</p></section>
}
