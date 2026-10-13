import type { ReactNode } from 'react'
import type { IconName } from '@/core/ui/app/Icon'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { fieldLabelClass, insetPanelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { quietButtonClass } from './form-classes'
import type { SettingsAct } from './settings-boards'

export interface Tag { id: string; name: string }
export interface CustomField { id: string; name: string; entity_type: string; field_type: string }

const input = fieldClass

/** A settings section's own card: a sand icon disc, its heading, a hairline and its forms. */
export function SettingsSection({ id, icon, title, children }: { id: string; icon: IconName; title: string; children: ReactNode }) {
  return <SectionCard id={id} icon={icon} title={title}>{children}</SectionCard>
}

/** One record or create form inside a settings section; a create form's edge is dashed. */
export const settingsPanelClass = `${insetPanelClass} p-5`

export function TagCard({ tag: t, tags, act }: { tag: Tag; tags: Tag[]; act: SettingsAct }) {
  return (
    <div className={settingsPanelClass}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void act(`/api/operator/catalog/tags/${t.id}`, { name: new FormData(e.currentTarget).get('name') }, 'PATCH') }}>
        <label className={fieldLabelClass}>Tag name<input name="name" defaultValue={t.name} required className={input} /></label>
        <label className={fieldLabelClass}>Merge into<select className={input} defaultValue="" onChange={(e) => { if (e.target.value) void act(`/api/operator/catalog/tags/${t.id}/merge`, { targetId: e.target.value }) }}><option value="">Select tag</option>{tags.filter((other) => other.id !== t.id).map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-3"><button className={secondaryButtonClass}>Rename</button><button type="button" className={quietButtonClass} onClick={() => void act(`/api/operator/catalog/tags/${t.id}`, {}, 'DELETE')}>Delete</button></div>
      </form>
    </div>
  )
}

export function CreateTagCard({ act }: { act: SettingsAct }) {
  return (
    <div className={`${settingsPanelClass} border-dashed`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void act('/api/operator/catalog/tags', { name: new FormData(e.currentTarget).get('name') }) }}>
        <label className={fieldLabelClass}>New tag<input name="name" required className={input} /></label>
        <button className={primaryButtonClass}>Create tag</button>
      </form>
    </div>
  )
}

export function FieldList({ fields }: { fields: CustomField[] }) {
  if (fields.length === 0) return null
  return <div className={`${insetPanelClass} mb-4`}><ul className="m-0 list-none divide-y divide-penny-line p-0">{fields.map((f) => <li key={f.id} className="px-5 py-3 text-base text-penny-ink">{f.name} · {f.entity_type} · {f.field_type}</li>)}</ul></div>
}

export function CreateFieldCard({ act }: { act: SettingsAct }) {
  return (
    <div className={`${settingsPanelClass} border-dashed`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); void act('/api/operator/settings/custom-fields', { name: d.get('name'), entityType: 'request', fieldType: d.get('fieldType') }) }}>
        <label className={fieldLabelClass}>Request field name<input name="name" required className={input} /></label>
        <label className={fieldLabelClass}>Type<select name="fieldType" className={input}>{['text', 'number', 'boolean', 'date'].map((type) => <option key={type}>{type}</option>)}</select></label>
        <button className={primaryButtonClass}>Create field</button>
      </form>
    </div>
  )
}
