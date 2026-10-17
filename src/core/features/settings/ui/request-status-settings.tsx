import { useState, type FormEvent } from 'react'
import type { PublicRequestStatus } from '@/core/shared/api/public'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { fieldLabelClass, secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { buttonClass, fieldClass } from '../../auth/client-mutations'
import { checkboxClass, checkRowClass } from '../../requests/ui/form-classes'
import { operatorMutation } from '../../requests/ui/operator-client'
import type { InternalRequestStatus, RequestStatusSettingsData } from '../request-statuses'

const root = '/api/operator/settings/request-statuses'
const statusLabels: Record<PublicRequestStatus, string> = {
  open: 'Open', under_review: 'Under review', planned: 'Planned', in_progress: 'In progress', shipped: 'Shipped', declined: 'Declined',
}

export function RequestStatusSettings() {
  const [resource, reload, request] = useOperatorResource<RequestStatusSettingsData>(root)
  return <SectionCard id="request-status-settings-heading" icon="settings" title="Request statuses" description="Configure internal statuses and the comment templates offered when changing a request’s status.">
    {resource.kind === 'ready' ? resource.data.owner ? <div className="space-y-8">
      <button type="button" className={secondaryButtonClass} onClick={reload} disabled={request.pending}>{request.pending ? 'Refreshing…' : 'Refresh request statuses'}</button>
      <div className="space-y-5">
        <h3 className="font-bold text-penny-ink">Internal statuses</h3>
        <p className="text-sm text-penny-muted">Each internal status maps to a public status. Changing its mapping moves every request using it without sending notifications. Its name stays private unless you choose to show it publicly.</p>
        {resource.data.statuses.length === 0 ? <p>No internal statuses configured.</p> : null}
        {resource.data.statuses.map(status => <StatusForm key={status.id} status={status} onSaved={reload} />)}
        <StatusForm onSaved={reload} />
      </div>
      <div className="space-y-5">
        <h3 className="font-bold text-penny-ink">Status comment templates</h3>
        <p className="text-sm text-penny-muted">These templates prefill the optional comment when changing status. Operators can edit the comment before publishing it. Leave a template blank to offer no suggested comment.</p>
        {(Object.keys(statusLabels) as PublicRequestStatus[]).map(status => <TemplateForm key={status} status={status} body={resource.data.templates[status]} onSaved={reload} />)}
      </div>
    </div> : <p>Owner access is required to configure request statuses.</p> : resource.kind === 'loading' ? <p>Loading request statuses…</p> : <>
      <p role="alert">{resource.kind === 'session_expired' ? 'Your operator session has expired. Sign in again to load request statuses.' : 'Request statuses could not be loaded.'}</p>
      <button type="button" className={`min-h-11 ${textLinkClass}`} onClick={reload}>Retry request statuses</button>
    </>}
  </SectionCard>
}

function StatusForm({ status, onSaved }: { status?: InternalRequestStatus; onSaved: () => void }) {
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, values = new FormData(form)
    setSaving(true); setMessage(''); setFailed(false)
    void operatorMutation(status ? root + '/' + encodeURIComponent(status.id) : root, {
      name: values.get('name'), publicStatus: values.get('publicStatus'),
      showPublicLabel: values.get('showPublicLabel') === 'on', position: Number(values.get('position')),
    }, status ? 'PUT' : 'POST').then(() => {
      setMessage(status ? 'Internal status saved.' : 'Internal status created.')
      if (!status) form.reset()
      onSaved()
    }).catch((error: unknown) => {
      setFailed(true); setMessage(error instanceof Error ? 'Could not save internal status: ' + error.message : 'Could not save internal status.')
    }).finally(() => setSaving(false))
  }
  return <form aria-label={status ? 'Edit internal status ' + status.name : 'Create internal status'} onSubmit={save} className="space-y-4 border-t border-penny-line pt-5">
    <fieldset key={JSON.stringify(status)} disabled={saving} className="space-y-4">
      <legend className="font-semibold text-penny-ink">{status ? status.name : 'New internal status'}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={fieldLabelClass}>Internal name<input name="name" required maxLength={160} defaultValue={status?.name ?? ''} className={fieldClass} /></label>
        <label className={fieldLabelClass}>Mapped public status<select name="publicStatus" defaultValue={status?.publicStatus ?? 'open'} className={fieldClass}>
          {(Object.keys(statusLabels) as PublicRequestStatus[]).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
        </select></label>
        <label className={fieldLabelClass}>Display order<input name="position" type="number" required min={0} step={1} defaultValue={status?.position ?? 0} className={fieldClass} /></label>
      </div>
      <label className={checkRowClass}><input name="showPublicLabel" type="checkbox" defaultChecked={status?.showPublicLabel ?? false} className={checkboxClass} />Show this internal name publicly</label>
      <button className={buttonClass}>{saving ? 'Saving…' : status ? 'Save internal status' : 'Create internal status'}</button>
    </fieldset>
    {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </form>
}

function TemplateForm({ status, body, onSaved }: { status: PublicRequestStatus; body: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
  return <form aria-label={statusLabels[status] + ' comment template'} className="space-y-4 border-t border-penny-line pt-5" onSubmit={event => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setSaving(true); setMessage(''); setFailed(false)
    void operatorMutation(root + '/templates/' + status, { body: values.get('body') }, 'PUT').then(() => {
      setMessage('Comment template saved.'); onSaved()
    }).catch((error: unknown) => {
      setFailed(true); setMessage(error instanceof Error ? 'Could not save comment template: ' + error.message : 'Could not save comment template.')
    }).finally(() => setSaving(false))
  }}>
    <label className={fieldLabelClass}>{statusLabels[status]} comment template<textarea key={body} name="body" rows={3} maxLength={20000} defaultValue={body} disabled={saving} className={fieldClass} /></label>
    <button disabled={saving} className={buttonClass}>{saving ? 'Saving…' : 'Save ' + statusLabels[status].toLowerCase() + ' template'}</button>
    {message ? <p role={failed ? 'alert' : 'status'}>{message}</p> : null}
  </form>
}
