import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { fieldLabelClass, insetPanelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { SectionCard } from '@/core/ui/app/SectionCard'

interface CustomFieldDefinition {
  readonly id: string
  readonly entityType: string
  readonly name: string
  readonly fieldType: string
}

const entityOptions = [
  { value: 'account', label: 'Account' },
  { value: 'requester', label: 'Requester' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'request', label: 'Request' },
  { value: 'decision', label: 'Decision' },
  { value: 'roadmapItem', label: 'Roadmap item' },
  { value: 'release', label: 'Release' },
] as const
const fieldTypes = ['text', 'number', 'boolean', 'date'] as const

function CustomFieldSettingsContent() {
  const [definitions, reload] = useOperatorResource<CustomFieldDefinition[]>('/api/operator/settings/custom-fields')
  const [entityType, setEntityType] = useState<(typeof entityOptions)[number]['value']>('account')
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const fields = definitions.kind === 'ready' ? definitions.data.filter(field => field.entityType === entityType) : []

  async function act(path: string, body: unknown, method = 'POST'): Promise<boolean> {
    try {
      await operatorMutation(path, body, method)
      setSaved(true)
      setMessage('Custom field saved.')
      reload()
      return true
    } catch (error) {
      setSaved(false)
      setMessage(error instanceof Error ? error.message : 'Custom field could not be saved.')
      return false
    }
  }

  return <div className="space-y-4">
    <label className={fieldLabelClass}>Entity type
      <select aria-label="Custom field entity type" disabled={definitions.kind !== 'ready'} value={entityType} onChange={event => setEntityType(event.target.value as typeof entityType)} className={fieldClass}>
        {entityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {definitions.kind === 'loading' ? <p className="text-sm text-penny-muted">Loading custom fields…</p> : null}
    {definitions.kind === 'session_expired' ? <p role="alert" className="text-sm font-semibold text-penny-danger">Your operator session has expired. Sign in again to manage custom fields.</p> : null}
    {definitions.kind === 'not_found' || definitions.kind === 'error' ? <div className="space-y-2"><p role="alert" className="text-sm font-semibold text-penny-danger">Custom field definitions could not be loaded.</p><button type="button" className={secondaryButtonClass} onClick={reload}>Retry</button></div> : null}
    {definitions.kind === 'ready' ? <>
      {fields.length === 0 ? <p className="text-sm text-penny-muted">No custom fields are defined for this entity yet.</p> : <div className="space-y-3">{fields.map(field => <form key={`${field.id}:${field.name}:${field.fieldType}`} className={`${insetPanelClass} space-y-3 p-4`} onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        void act(`/api/operator/settings/custom-fields/${encodeURIComponent(field.id)}`, {
          name: data.get('name'),
          fieldType: data.get('fieldType'),
        }, 'PATCH')
      }}>
        <label className={fieldLabelClass}>Field name<input name="name" required maxLength={160} defaultValue={field.name} className={fieldClass} /></label>
        <label className={fieldLabelClass}>Field type<select name="fieldType" defaultValue={field.fieldType} className={fieldClass}>{fieldTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <button className={secondaryButtonClass}>Save field definition</button>
      </form>)}</div>}
      <form className={`${insetPanelClass} space-y-4 border-dashed p-4`} onSubmit={event => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        void act('/api/operator/settings/custom-fields', {
          entityType,
          name: data.get('name'),
          fieldType: data.get('fieldType'),
        }).then(wasSaved => { if (wasSaved) form.reset() })
      }}>
        <h3 className="text-base font-bold text-penny-ink">Create a field for {entityOptions.find(option => option.value === entityType)?.label.toLowerCase()}</h3>
        <label className={fieldLabelClass}>New field name<input name="name" required maxLength={160} className={fieldClass} /></label>
        <label className={fieldLabelClass}>Field type<select name="fieldType" defaultValue="text" className={fieldClass}>{fieldTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <button className={primaryButtonClass}>Create field</button>
      </form>
    </> : null}
    <p role="status" className={`text-sm font-semibold empty:hidden ${saved ? 'text-penny-moss' : 'text-penny-danger'}`}>{message}</p>
  </div>
}

/** Create and edit operator-only field definitions across every supported entity. */
export function CustomFieldSettings({ embedded = false }: { readonly embedded?: boolean }) {
  const content = <CustomFieldSettingsContent />
  if (embedded) return content
  return <SectionCard id="settings-fields" icon="form" title="Private custom fields">{content}</SectionCard>
}
