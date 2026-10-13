import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { controlClass } from '@/core/app/ui/loop-form'
import { fieldLabelClass } from '@/core/ui/app/classes'
import type { RequestSuggestion } from '../types'
export function EvidenceSuggestions(){
 const [title,setTitle]=useState('')
 return <div className="space-y-3"><label className={fieldLabelClass}>Find related requests<input className={controlClass} value={title} onChange={event=>setTitle(event.target.value)}/></label>{title.trim()?<SuggestionList title={title}/>:null}</div>
}
function SuggestionList({title}:{title:string}){
 const [suggestions,reload]=useOperatorResource<RequestSuggestion[]>(`/api/operator/requests/suggestions?title=${encodeURIComponent(title)}`)
 return <><OperatorOptionsState state={suggestions} loading="Finding similar requests…" failure="Could not find similar requests." reload={reload}/>{suggestions.kind==='ready'?<fieldset><legend className="text-sm font-bold text-penny-ink">Suggested request links (choose explicitly)</legend>{suggestions.data.length?suggestions.data.map(request=><label key={request.id} className="flex min-h-11 items-start gap-3 py-2 text-sm"><input className="mt-1 size-4 shrink-0 accent-penny-ink" type="checkbox" name="suggestedRequestIds" value={request.id}/><span className="min-w-0 break-words">{request.title}<span className="block text-penny-muted">Matched: {request.matchedTerms.join(', ')}</span></span></label>):<p className="mt-2 text-sm text-penny-muted">No matching requests.</p>}</fieldset>:null}</>
}
