import { useState, type ReactNode } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import type { OperatorEvidenceCard } from '@/core/shared/api/operator'
import type { OperatorPage } from '@/core/features/workspace/list-query'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { OperatorOptionsState } from '@/core/app/ui/operator-options-state'
// A selection may span many server pages. Hidden values retain the entire explicitly
// selected set; changing a page or a search never drops offscreen links.
export function EvidencePicker({ initialIds, children }: {
 initialIds: readonly string[]
 children: (picker: ReactNode, ready: boolean) => ReactNode
}) {
 const [selected, setSelected] = useState(() => new Set(initialIds))
 const [query, setQuery] = useState('')
 const [page, setPage] = useState(1)
 const [state, retry] = useOperatorResource<OperatorPage<OperatorEvidenceCard>>(`/api/operator/evidence?q=${encodeURIComponent(query)}&page=${page}`)
 const picker = <fieldset className="min-w-0">
  <legend className={fieldLabelClass}>Linked evidence</legend>
  {[...selected].map(id => <input key={id} type="hidden" name="evidenceIds" value={id}/>)}
  <label className={fieldLabelClass}>Find evidence<input value={query} maxLength={200} onChange={event => {
   setQuery(event.target.value)
   setPage(1)
  }} className={fieldClass}/></label>
  {state.kind === 'ready' ? <>
   <div className="my-3 space-y-2">
    {state.data.items.map(e => <label key={e.id} className="flex min-h-11 items-start gap-2 text-sm text-penny-ink">
     <input className="mt-1 size-4 accent-penny-ink" type="checkbox" checked={selected.has(e.id)} onChange={event => setSelected(current => {
      const next = new Set(current)
      if (event.target.checked) next.add(e.id)
      else next.delete(e.id)
      return next
     })}/>
     <span className="min-w-0 break-words [overflow-wrap:anywhere]">{e.wording}</span>
    </label>)}
    {state.data.items.length === 0 ? <p>No evidence matches.</p> : null}
   </div>
   <div className="flex flex-wrap gap-3">
    {page > 1 ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(page - 1)}>Previous evidence</button> : null}
    {page * state.data.pageSize < state.data.total ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(page + 1)}>Next evidence</button> : null}
   </div>
  </> : <OperatorOptionsState state={state} loading="Loading linked evidence…" failure="Could not load linked evidence" reload={retry}/>}
  <p className="mt-2 text-xs text-penny-muted">{selected.size} selected. The linked bet’s evidence is also included.</p>
 </fieldset>
 // The form shares this render's admission, including SSR and page/search changes.
 // Reporting readiness in an effect would leave a window for an unavailable save.
 return children(picker, state.kind === 'ready')
}
