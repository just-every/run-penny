import { useState } from 'react'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { controlClass,Field,LoopForm } from '@/core/app/ui/loop-form'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import type { OperatorPage } from '@/core/features/workspace/list-query'
import { fieldLabelClass,secondaryButtonClass } from '@/core/ui/app/classes'

export function BetEvidenceForm({betId,onSaved}:{betId:string;onSaved:()=>void}){
 const [page,setPage]=useState(1),[selected,setSelected]=useState('')
 const path=page===1?'/api/operator/evidence':`/api/operator/evidence?page=${page}`
 const [evidence,reload]=useOperatorResource<OperatorPage<OperatorEvidenceCard>>(path)
 const results=evidence.kind==='ready'?evidence.data:null
 const pageCount=results?Math.max(1,Math.ceil(results.total/results.pageSize)):1
 return <LoopForm title="Link evidence" action={`/api/operator/evidence/${selected}/links`} method="PUT" onSaved={onSaved} disabled={!results?.items.length} transform={data=>({target:'bet',targetId:betId,stance:data.get('stance')})}>
  {results?<>
   {results.items.length?<label className={fieldLabelClass}>Evidence<select required className={controlClass} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose evidence…</option>{results.items.map(item=><option key={item.id} value={item.id}>{item.wording.slice(0,100)}</option>)}</select></label>:<p className="text-sm text-penny-muted">{results.total?'No evidence is available on this page.':'No evidence has been recorded.'}</p>}
   {results.total>results.pageSize||results.page>1?<nav aria-label="Evidence pages" className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-penny-muted">{results.total} results · Page {results.page} of {pageCount}</p>{results.page>1?<button type="button" className={secondaryButtonClass} onClick={()=>{setPage(results.page-1);setSelected('')}}>Previous evidence</button>:null}{results.page*results.pageSize<results.total?<button type="button" className={secondaryButtonClass} onClick={()=>{setPage(results.page+1);setSelected('')}}>Next evidence</button>:null}</nav>:null}
  </>:<OperatorOptionsState state={evidence} loading="Loading linked evidence…" failure="Could not load linked evidence" reload={reload}/>}
  <Field name="stance" label="Stance" value="supporting" choices={[{id:'supporting',label:'Supports'},{id:'contradicting',label:'Contradicts'}]}/>
 </LoopForm>
}
