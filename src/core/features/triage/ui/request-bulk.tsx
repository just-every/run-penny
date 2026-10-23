import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'

interface BulkOptions {
  canManage: boolean
  tags: { id: string; name: string }[]
  operators: { id: string; displayName: string }[]
}
interface BatchResult {
  id: string
  selected: number
  changed: number
  tagName: string | null
  ownerName: string | null
}
interface UndoResult { id: string; restored: number; skipped: number; undone: true }
interface Selection {
  canSelect: boolean
  busy: boolean
  revision: string
  selected: ReadonlySet<string>
  toggle: (id: string) => void
}

export function RequestBulk({ requests, ready, refresh, children }: {
  requests: readonly { id: string; title: string }[]
  ready: boolean
  refresh: () => void
  children: (selection: Selection) => ReactNode
}) {
  const [options, retry] = useOperatorResource<BulkOptions>('/api/operator/triage/batches/options')
  const router = useRouter()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [tagId, setTagId] = useState(''), [operatorId, setOperatorId] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [batch, setBatch] = useState<(BatchResult & { assignmentChanged: boolean }) | null>(null)
  const [undo, setUndo] = useState<UndoResult | null>(null)
  const canManage = options.kind === 'ready' && options.data.canManage
  const onPage = requests.filter(request => selected.has(request.id)).length

  function toggle(id: string) {
    if (busy || !canManage) return
    setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function selectPage(include: boolean) {
    setSelected(current => { const next = new Set(current); for (const request of requests) { if (include) next.add(request.id); else next.delete(request.id) } return next })
  }
  function refreshLists() {
    refresh()
    window.dispatchEvent(new Event('penny-ownership-changed'))
    void router.invalidate().catch(() => setError('Changes saved, but request details could not refresh. Refresh this page to see them.'))
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !canManage || !selected.size || (!tagId && !operatorId)) return
    setBusy(true); setError('')
    try {
      const result = await operatorMutation('/api/operator/triage/batches', {
        requestIds: [...selected], ...(tagId ? { tagId } : {}),
        ...(operatorId ? { operatorId: operatorId === 'unassigned' ? null : operatorId } : {}),
      }) as BatchResult
      setBatch({ ...result, assignmentChanged: operatorId !== '' }); setUndo(null)
      setSelected(new Set()); refreshLists()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not apply this batch.') }
    finally { setBusy(false) }
  }
  async function undoBatch() {
    if (busy || !canManage || !batch || undo) return
    setBusy(true); setError('')
    try {
      setUndo(await operatorMutation(`/api/operator/triage/batches/${batch.id}/undo`, {}) as UndoResult)
      refreshLists()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not undo this batch.') }
    finally { setBusy(false) }
  }

  return <>
    <OperatorCard as="section" aria-label="Bulk request actions" className="my-6 p-5 sm:p-6">
      <h2 className="text-xl font-bold text-penny-ink">Bulk request actions</h2>
      {options.kind === 'loading' ? <p role="status" className="mt-3 text-sm">Loading bulk actions…</p> : options.kind !== 'ready' ? <div className="mt-3"><p role="alert">Could not load bulk actions. Refresh or sign in again.</p><button type="button" className={`${secondaryButtonClass} mt-3`} onClick={retry}>Retry bulk actions</button></div> : !canManage ? <p className="mt-3 text-sm text-penny-muted">Owners and Admins can tag and assign requests in bulk.</p> : <>
        <p className="mt-2 text-sm text-penny-muted">Select requests, review the changes, then apply one batch. Undo restores changes that have not been edited since.</p>
        <p role="status" className="mt-3 font-semibold text-penny-ink">{selected.size} selected · {onPage} on this page</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={secondaryButtonClass} disabled={busy || !ready || !requests.length || onPage === requests.length} onClick={() => selectPage(true)}>Select current page</button>
          <button type="button" className={secondaryButtonClass} disabled={busy || !ready || !onPage} onClick={() => selectPage(false)}>Clear current page</button>
          <button type="button" className={secondaryButtonClass} disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>Clear all selected</button>
        </div>
        {ready && !requests.length ? <p className="mt-3 text-sm text-penny-muted">No requests on this page to select.</p> : null}
        <form aria-label="Apply bulk request changes" onSubmit={apply} className="mt-5 space-y-4 border-t border-penny-line pt-5">
          <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className="sr-only">Batch changes</legend>
            <label className={fieldLabelClass}>Add tag (optional)<select aria-label="Add tag (optional)" className={fieldClass} value={tagId} onChange={event => setTagId(event.target.value)}><option value="">Keep existing tags</option>{options.data.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
            <label className={fieldLabelClass}>Assign owner (optional)<select aria-label="Assign owner (optional)" className={fieldClass} value={operatorId} onChange={event => setOperatorId(event.target.value)}><option value="">Keep existing owners</option><option value="unassigned">Unassigned</option>{options.data.operators.map(operator => <option key={operator.id} value={operator.id}>{operator.displayName}</option>)}</select></label>
          </fieldset>
          {!options.data.tags.length ? <p className="text-sm text-penny-muted">No tags available. Create a tag in Feedback before adding one here.</p> : null}
          {!options.data.operators.length ? <p className="text-sm text-penny-muted">No active operators are available to assign. You can keep existing owners or choose Unassigned.</p> : null}
          <p className="text-sm text-penny-ink">Review: {selected.size} requests. {tagId ? `Add tag “${options.data.tags.find(tag => tag.id === tagId)?.name}”.` : 'Keep existing tags.'} {operatorId ? `Assign to ${operatorId === 'unassigned' ? 'Unassigned' : options.data.operators.find(operator => operator.id === operatorId)?.displayName}.` : 'Keep existing owners.'}</p>
          <button className={primaryButtonClass} disabled={busy || !ready || !selected.size || (!tagId && !operatorId)}>{busy ? 'Saving batch…' : 'Apply batch'}</button>
        </form>
      </>}
      {batch ? <div className="mt-5 space-y-3 border-t border-penny-line pt-5">
        <p role="status" className="font-semibold text-penny-ink">Batch changed {batch.changed} of {batch.selected} selected requests.{batch.tagName ? ` Tag: ${batch.tagName}.` : ''}{batch.assignmentChanged ? ` Owner: ${batch.ownerName ?? 'Unassigned'}.` : ''}</p>
        {undo ? <p role="status">Undo complete: {undo.restored} restored; {undo.skipped} skipped. Skipped requests retain later edits.</p> : canManage ? <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => void undoBatch()}>{busy ? 'Saving batch…' : 'Undo batch'}</button> : null}
      </div> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-penny-danger">{error}</p> : null}
    </OperatorCard>
    {children({ canSelect: canManage, busy, revision: `${batch?.id ?? ''}:${undo?.id ?? ''}`, selected, toggle })}
  </>
}
