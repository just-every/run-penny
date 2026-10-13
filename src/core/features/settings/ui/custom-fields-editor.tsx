import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { checkboxClass, checkRowClass } from '@/core/features/requests/ui/form-classes'
import { fieldLabelClass, secondaryButtonClass } from '@/core/ui/app/classes'
import type { CustomFieldEntityType } from '../custom-field-types'

interface CustomFieldValue {
  readonly id: string
  readonly entityType: string
  readonly name: string
  readonly fieldType: 'text' | 'number' | 'boolean' | 'date'
  readonly hasValue: boolean
  readonly value: string | number | boolean | null
}

function currentInputValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Operator-only custom field values for one existing entity record. */
export function CustomFieldsEditor({ entityType, entityId }: { readonly entityType: CustomFieldEntityType; readonly entityId: string }) {
  const path = `/api/operator/custom-fields/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`
  const [fields, reload] = useOperatorResource<CustomFieldValue[]>(path)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (fields.kind === 'ready') setValues(Object.fromEntries(fields.data.map(field => [field.id, field.value])))
  }, [fields])

  async function save(field: CustomFieldValue, value: unknown): Promise<void> {
    setMessage('Saving…')
    try {
      await operatorMutation(`/api/operator/custom-fields/${encodeURIComponent(entityType)}/${encodeURIComponent(field.id)}/${encodeURIComponent(entityId)}`, { value }, 'PUT')
      setValues(previous => ({ ...previous, [field.id]: value }))
      setSaved(true)
      setMessage(`${field.name} saved.`)
      reload()
    } catch (error) {
      setSaved(false)
      setMessage(error instanceof Error ? error.message : `${field.name} could not be saved.`)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>, field: CustomFieldValue): void {
    event.preventDefault()
    const current = Object.hasOwn(values, field.id) ? values[field.id] : field.value
    if (field.fieldType === 'boolean') {
      void save(field, current === true)
      return
    }
    const raw = currentInputValue(current)
    if (field.fieldType === 'number') {
      if (raw === '') { void save(field, null); return }
      const number = Number(raw)
      if (!Number.isFinite(number)) { setSaved(false); setMessage(`${field.name} must be a finite number.`); return }
      void save(field, number)
      return
    }
    if (field.fieldType === 'date' && raw === '') { void save(field, null); return }
    void save(field, raw)
  }

  return <section className="mt-5 space-y-3 border-t border-penny-line pt-4" aria-label="Private custom fields">
    <h3 className="text-base font-bold text-penny-ink">Private custom fields</h3>
    {fields.kind === 'loading' ? <p className="text-sm text-penny-muted">Loading custom fields…</p> : null}
    {fields.kind === 'session_expired' ? <p role="alert" className="text-sm font-semibold text-penny-danger">Your operator session has expired. Sign in again to edit custom fields.</p> : null}
    {fields.kind === 'not_found' ? <p role="alert" className="text-sm font-semibold text-penny-danger">This record is no longer available for custom field editing.</p> : null}
    {fields.kind === 'error' ? <div className="space-y-2"><p role="alert" className="text-sm font-semibold text-penny-danger">Custom field values could not be loaded.</p><button type="button" className={secondaryButtonClass} onClick={reload}>Retry custom fields</button></div> : null}
    {fields.kind === 'ready' && fields.data.length === 0 ? <p className="text-sm text-penny-muted">No custom fields are defined for this record.</p> : null}
    {fields.kind === 'ready' ? <div className="space-y-3">{fields.data.map(field => {
      const current = Object.hasOwn(values, field.id) ? values[field.id] : field.value
      return <form key={field.id} className="space-y-3" onSubmit={event => submit(event, field)}>
        {field.fieldType === 'boolean' ? <label className={checkRowClass}><input name={field.id} type="checkbox" checked={current === true} onChange={event => setValues(previous => ({ ...previous, [field.id]: event.target.checked }))} className={checkboxClass} />{field.name}</label> : <label className={fieldLabelClass}>{field.name}<input name={field.id} type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'} step={field.fieldType === 'number' ? 'any' : undefined} maxLength={field.fieldType === 'text' ? 20_000 : undefined} value={currentInputValue(current)} onChange={event => setValues(previous => ({ ...previous, [field.id]: event.target.value }))} className={fieldClass} /></label>}
        {field.hasValue && current === null ? <p className="text-xs text-penny-muted">Value cleared.</p> : null}
        {!field.hasValue ? <p className="text-xs text-penny-muted">No value saved.</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className={secondaryButtonClass}>Save field</button>
          <button type="button" className={secondaryButtonClass} aria-label={`Clear ${field.name}`} onClick={() => void save(field, null)}>Clear field</button>
        </div>
      </form>
    })}</div> : null}
    <p role="status" className={`text-sm font-semibold empty:hidden ${saved ? 'text-penny-moss' : 'text-penny-danger'}`}>{message}</p>
  </section>
}
