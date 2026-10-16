import { useLocation } from '@tanstack/react-router'
import { ListControls } from '@/core/features/workspace/ui/list-controls'
import type { OperatorPage } from '@/core/features/workspace/list-query'
import type { StatusDraft } from '@/core/features/workspace/update-list'
import { useEffect, useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { paperCardClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'

/** `generation` counts roadmap saves: each one may prepare a draft, so the list refetches rather than reusing the page's loader snapshot. */
export function StatusDrafts({ generation = 0 }: { generation?: number }) {
 const params=new URLSearchParams(useLocation().searchStr),query=new URLSearchParams({status:'pending'});for(const key of ['q','tag','sort','page']){const value=params.get(`updates${key[0].toUpperCase()}${key.slice(1)}`);if(value)query.set(key,value)}
 const [resource, refresh] = useOperatorResource<OperatorPage<StatusDraft>>(`/api/operator/roadmap-updates?${query}`)
 const [message, setMessage] = useState(''), [busy, setBusy] = useState<string | null>(null)
 useEffect(() => { if (generation > 0) refresh() }, [generation, refresh])
 const drafts = resource.kind === 'ready' ? resource.data.items : []
 async function act(draft: StatusDraft) {
  setBusy(draft.id)
  try {
   await operatorMutation(`/api/operator/roadmap-updates/${draft.id}/${draft.publicationState === 'stale' ? 'discard' : 'publish'}`, {})
   setMessage(draft.publicationState === 'stale' ? 'Stale draft discarded. Review the current approval before the next roadmap move prepares a new draft.' : 'Status update published.')
   refresh()
  } catch (error) { setMessage(error instanceof Error ? error.message : 'Status update could not be saved.') }
  finally { setBusy(null) }
 }
 return <section className="mt-8" aria-label="Pending status updates">
  <h2 className="text-xl font-bold tracking-[-0.02em] text-penny-ink">Pending status updates</h2>
  <p className="mt-2 text-sm leading-6 text-penny-muted">Review the approved public wording, then publish to the mapped requests and their eligible followers.</p>
  <ListControls entity="updates" prefix="updates" page={resource.kind==='ready'?resource.data:null}/>
  {message ? <p role="status" className="mt-3 text-sm font-semibold text-penny-ink">{message}</p> : null}
  {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading status updates…"/> : null}
  {resource.kind === 'session_expired' ? <OperatorSessionExpired/> : null}
  {resource.kind === 'error' ? <OperatorResourceFailure title="We could not load status updates." status={resource.status} message={resource.message} onRetry={refresh}/> : null}
  {resource.kind === 'ready' && !drafts.length ? <p className="mt-3 text-sm text-penny-muted">No status updates awaiting publication.</p> : null}
  {drafts.map(draft => <article key={draft.id} className={`${paperCardClass} mt-4 p-5`}>
   <h3 className="font-bold text-penny-ink">{draft.title}</h3><p className="mt-3 whitespace-pre-wrap leading-7 text-penny-ink">{draft.body}</p>
   {draft.publicationState === 'stale' ? <p className="mt-3 text-sm text-penny-muted">Approval, mappings or request visibility changed. This draft cannot be published. Discard it, review the current roadmap approval, then make the next status move to prepare a new draft.</p> : null}
   <button type="button" disabled={busy !== null} className={`${draft.publicationState === 'stale' ? secondaryButtonClass : primaryButtonClass} mt-4`} onClick={() => act(draft)}>{draft.publicationState === 'stale' ? 'Discard stale draft' : 'Publish status update'}</button>
  </article>)}
 </section>
}
