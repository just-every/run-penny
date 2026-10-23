import { useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { primaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { checkboxClass, checkRowClass } from '@/core/features/requests/ui/form-classes'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'

interface WeeklySetting { enabled: boolean; canConfigure: boolean }
const path = '/api/operator/settings/weekly-summary'

export function WeeklySummarySetting() {
  const [resource, reload] = useOperatorResource<WeeklySetting>(path)
  return <SectionCard id="weekly-summary" icon="form" title="Weekly requester summary" description="Let requesters choose a weekly email of public changes. Weekly summaries start off.">
    {resource.kind === 'ready' ? resource.data.canConfigure
      ? <WeeklySettingForm key={String(resource.data.enabled)} initial={resource.data.enabled} />
      : <p>Weekly requester summaries are {resource.data.enabled ? 'on' : 'off'}. Only the installation owner can change this setting.</p>
      : resource.kind === 'loading' ? <p role="status">Loading weekly summary settings…</p>
      : <><p role="alert">Weekly summary settings could not be loaded.</p><button className={`min-h-11 ${textLinkClass}`} onClick={reload}>Retry weekly summary settings</button></>}
  </SectionCard>
}

function WeeklySettingForm({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await operatorMutation(path, { enabled }, 'PUT') as WeeklySetting
      setEnabled(result.enabled); setMessage('Weekly requester summary setting saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save weekly summary settings.') }
    finally { setBusy(false) }
  }}>
    <label className={checkRowClass}><input type="checkbox" className={checkboxClass} checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} />Enable weekly requester summaries</label>
    <p className="text-sm text-penny-muted">Requesters can choose a summary of followed requests’ public changes and published releases. Existing vote permission stays limited to its requests. Empty weeks send no summary.</p>
    <p className="text-sm text-penny-muted">A <a href="#mail-identity" className={textLinkClass}>confirmed business postal address</a> is required before enabling. Turning summaries off keeps requester choices for when you enable them again.</p>
    <button className={primaryButtonClass} disabled={busy}>{busy ? 'Saving…' : 'Save weekly summary setting'}</button>
    <p role="status" className="text-sm empty:hidden">{message}</p>
  </form>
}
