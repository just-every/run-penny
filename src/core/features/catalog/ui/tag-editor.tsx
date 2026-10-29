import { useState } from 'react'
import { Chip } from '@/core/ui/app/Chip'
import { fieldLabelClass, secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'

interface Tag { readonly id: string; readonly name: string }

/** The private tags on one evidence item or request: shown as chips, applied from the catalog, removed one by one. */
export function TagEditor({ label, tagNames, apply, remove, onChanged }: {
  readonly label: string
  readonly tagNames: readonly string[]
  readonly apply: (tagId: string) => Promise<unknown>
  readonly remove: (tagId: string) => Promise<unknown>
  readonly onChanged: () => void
}) {
  const [catalog] = usePublicResource<{ tags: Tag[] }>('/api/operator/catalog/settings')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const tags = catalog.kind === 'ready' ? catalog.data.tags : []
  const applied = tagNames.map(name => tags.find(tag => tag.name === name) ?? { id: '', name })
  const available = tags.filter(tag => !tagNames.includes(tag.name))
  async function change(work: () => Promise<unknown>, done: string) {
    setBusy(true); setMessage('')
    try { await work(); setMessage(done); onChanged() } catch (error) { setMessage(error instanceof Error ? error.message : 'The tag could not be changed.') } finally { setBusy(false) }
  }
  return <div className="space-y-3">
    {applied.length ? <ul className="flex list-none flex-wrap gap-2 p-0" aria-label={label}>{applied.map(tag => <li key={tag.name} className="flex items-center gap-1"><Chip tone="sand">{tag.name}</Chip>{tag.id ? <button type="button" disabled={busy} className={`min-h-11 px-1 text-sm ${textLinkClass}`} aria-label={`Remove tag ${tag.name}`} onClick={() => void change(() => remove(tag.id), `Tag ${tag.name} removed.`)}>Remove</button> : null}</li>)}</ul> : <p className="text-sm text-penny-muted">No tags yet.</p>}
    {catalog.kind === 'ready' && tags.length === 0 ? <p className="text-sm text-penny-muted">Create tags in <a className={textLinkClass} href="/app/settings#settings-tags">Feedback settings → Private tags</a> first.</p> : null}
    {available.length ? <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault()
      const tag = tags.find(item => item.id === String(new FormData(event.currentTarget).get('tag') ?? ''))
      if (tag) void change(() => apply(tag.id), `Tag ${tag.name} applied.`)
    }}>
      <label className={`${fieldLabelClass} min-w-0 flex-1 basis-full sm:basis-0`}>Add tag<select name="tag" className={fieldClass} required defaultValue=""><option value="" disabled>Choose a tag</option>{available.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
      <button className={secondaryButtonClass} disabled={busy}>Apply tag</button>
    </form> : null}
    <p className="text-sm font-semibold text-penny-ink empty:hidden" role="status">{message}</p>
  </div>
}

export const evidenceTagApi = (evidenceId: string) => ({
  apply: (tagId: string) => operatorMutation(`/api/operator/evidence/${encodeURIComponent(evidenceId)}/tag`, { tagId }, 'PUT'),
  remove: (tagId: string) => operatorMutation(`/api/operator/evidence/${encodeURIComponent(evidenceId)}/tag`, { tagId }, 'DELETE'),
})

export const requestTagApi = (requestId: string) => ({
  apply: (tagId: string) => operatorMutation(`/api/operator/catalog/requests/${encodeURIComponent(requestId)}/tags/${encodeURIComponent(tagId)}`, {}, 'PUT'),
  remove: (tagId: string) => operatorMutation(`/api/operator/catalog/requests/${encodeURIComponent(requestId)}/tags/${encodeURIComponent(tagId)}`, {}, 'DELETE'),
})
