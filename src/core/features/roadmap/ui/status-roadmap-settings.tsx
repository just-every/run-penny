import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { fieldLabelClass, primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { checkboxClass, checkRowClass } from '@/core/features/requests/ui/form-classes'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import type { OperatorRoadmapSettings, StatusRoadmapSettings } from '../status-roadmap-settings'

export function StatusRoadmapSettings() {
 const [resource, reload] = useOperatorResource<OperatorRoadmapSettings>('/api/operator/settings/status-roadmap')
 const [saving, setSaving] = useState(false), [message, setMessage] = useState('')
 return <SectionCard id="status-roadmap-settings-heading" icon="roadmap" title="Public roadmap" description="Choose approved roadmap items or build your public roadmap from request statuses.">
  {resource.kind === 'ready' ? <form aria-label="Public roadmap settings" className="space-y-5" onSubmit={event => {
   event.preventDefault()
   const data = new FormData(event.currentTarget), settings = resource.data.settings
   const input: StatusRoadmapSettings = {
    source: data.get('source') as StatusRoadmapSettings['source'],
    boardSlugs: data.getAll('boardSlugs').map(String),
    columns: settings.columns.map(column => ({ status: column.status, label: String(data.get(`${column.status}-label`)), visible: data.has(`${column.status}-visible`) })),
    shippedDays: data.get('shippedDays') === 'all' ? null : Number(data.get('shippedDays')) as StatusRoadmapSettings['shippedDays'],
   }
   setSaving(true); setMessage('')
   void operatorMutation('/api/operator/settings/status-roadmap', input, 'PUT').then(() => { setMessage('Public roadmap saved.'); reload() }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not save the public roadmap.')).finally(() => setSaving(false))
  }}>
   {!resource.data.owner ? <p className="text-sm text-penny-muted">Only the installation owner can change the public roadmap.</p> : null}
   <fieldset disabled={!resource.data.owner || saving} className="min-w-0 space-y-5">
    <label className={fieldLabelClass}>Roadmap source<select name="source" defaultValue={resource.data.settings.source} className={fieldClass}><option value="request_statuses">Request statuses</option><option value="approved_items">Approved roadmap items</option></select></label>
    <p className="text-sm leading-6 text-penny-muted">The board, column and Shipped settings below apply when the source is request statuses.</p>
    <fieldset className="min-w-0"><legend className="text-sm font-semibold text-penny-ink">Public boards</legend><p className="mt-1 text-sm text-penny-muted">Leave every board unchecked to include all public boards.</p>
     <div className="mt-2 space-y-1">{resource.data.boards.map(board => <label key={board.slug} className={checkRowClass}><input type="checkbox" name="boardSlugs" value={board.slug} defaultChecked={resource.data.settings.boardSlugs.includes(board.slug)} className={checkboxClass} /><span className="min-w-0 break-words">{board.name}</span></label>)}</div>
     {resource.data.settings.boardSlugs.filter(slug => !resource.data.boards.some(board => board.slug === slug)).map(slug => <label key={slug} className={checkRowClass}><input type="checkbox" name="boardSlugs" value={slug} defaultChecked className={checkboxClass} /><span className="min-w-0 break-words">{slug} is unavailable. Uncheck it before saving.</span></label>)}
     {resource.data.boards.length === 0 ? <p className="mt-2 text-sm text-penny-muted">No public boards are available yet.</p> : null}
    </fieldset>
    <fieldset className="min-w-0"><legend className="text-sm font-semibold text-penny-ink">Status columns</legend>
     <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{resource.data.settings.columns.map(column => <div key={column.status} className="min-w-0">
      <label className={checkRowClass}><input type="checkbox" name={`${column.status}-visible`} defaultChecked={column.visible} className={checkboxClass} />Show {column.status.replaceAll('_', ' ')}</label>
      <label className={fieldLabelClass}>Column heading<input name={`${column.status}-label`} defaultValue={column.label} required maxLength={80} className={fieldClass} /></label>
     </div>)}</div>
    </fieldset>
    <label className={fieldLabelClass}>Shipped requests<select name="shippedDays" defaultValue={resource.data.settings.shippedDays ?? 'all'} className={fieldClass}><option value="all">Show all</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></select></label>
    <button className={primaryButtonClass}>{saving ? 'Saving…' : 'Save public roadmap'}</button>
   </fieldset>
  </form> : resource.kind === 'loading' ? <p role="status">Loading public roadmap settings…</p> : <><p role="alert">Public roadmap settings could not be loaded.</p><button onClick={reload} className={`min-h-11 ${textLinkClass}`}>Retry roadmap settings</button></>}
  {message ? <p role="status" className="mt-4">{message}</p> : null}
 </SectionCard>
}
