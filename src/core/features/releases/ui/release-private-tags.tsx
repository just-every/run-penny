import { useState } from 'react'
import { choicePillClass, fieldLabelClass, inputClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'

type Tag = { id: string; name: string }

export function ReleasePrivateTags({ tags, selected = [] }: { tags: Tag[]; selected?: readonly string[] }) {
  const [created, setCreated] = useState<Tag[]>([]), [name, setName] = useState('')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function create() {
    if (busy || !name.trim()) return
    setBusy(true); setMessage('')
    try {
      const result = await operatorMutation('/api/operator/catalog/tags', { name: name.trim() }) as { id: string }
      setCreated(current => [...current, { id: result.id, name: name.trim() }])
      setName(''); setMessage('Private tag created and selected. Your release draft is still here.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create tag.') }
    finally { setBusy(false) }
  }
  const choices = [...tags, ...created.filter(tag => !tags.some(existing => existing.id === tag.id))]
  return <fieldset className="min-w-0">
    <legend className={fieldLabelClass}>Private tags (choose at least one; customers never see them)</legend>
    {choices.length ? <div className="mt-1.5 flex flex-wrap gap-2">{choices.map(tag => <label key={tag.id} className={choicePillClass}><input className="size-4 shrink-0 accent-penny-ink" type="checkbox" name="tagIds" value={tag.id} defaultChecked={selected.includes(tag.id) || created.some(item => item.id === tag.id)} />{tag.name}</label>)}</div> : null}
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className={`${fieldLabelClass} min-w-0 flex-1`}>New private tag<input className={`${inputClass} mt-2`} value={name} maxLength={160} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void create() } }} /></label>
      <button type="button" className={secondaryButtonClass} disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? 'Creating…' : 'Create private tag'}</button>
    </div>
    {message ? <p role="status" className="mt-2 text-sm text-penny-muted">{message}</p> : null}
  </fieldset>
}
