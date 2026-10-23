import {AgingPanel} from '../../triage/aging-panel'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { OperatorEmpty, OperatorResourceLoading } from '@/core/app/ui/operator-resource-state'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { useOperatorList, ListControls } from '@/core/features/workspace/ui/list-controls'
import { useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ModerationCard, type QueueRequest } from './moderation-card'
import { RequestBulk } from '../../triage/ui/request-bulk'

export function ModerationPage() {
  const [resource, refresh, page] = useOperatorList<QueueRequest & { id: string }>('/api/operator/moderation'), [message, setMessage] = useState('')
  const includesAccountHistory = new URLSearchParams(useLocation().searchStr).has('account')
  return (
    <section>
      <OperatorPageHeader eyebrow="Customer feedback" title="Review feedback before it becomes public." art={resource.kind === 'ready' && resource.data.length === 0 || resource.kind === 'error' ? null : { note: 'Nothing goes public until approved.' }} action={<a href="/app/settings" className={secondaryButtonClass}><Icon name="settings" />Feedback settings</a>}>Approve customer-safe wording, board and display name explicitly. Original evidence remains private and unchanged.</OperatorPageHeader><ListControls page={page} entity="requests"/>
      <AgingPanel staleOnly/>
      {includesAccountHistory ? <p className="text-sm text-penny-muted">Account results include current feedback and retained history, including withdrawn and merged requests and inactive authors.</p> : null}
      <p role="status" className="mt-5 text-base font-semibold text-penny-ink empty:hidden">{message}</p>
      <RequestBulk requests={resource.kind === 'ready' ? resource.data : []} ready={resource.kind === 'ready'} refresh={refresh}>{({ canSelect, busy, revision, selected, toggle }) => <div className="mt-6 sm:mt-8">
        {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading moderation queue…" /> : null}
        {resource.kind === 'error' ? <OperatorCard className="p-6" role="alert"><p className="text-sm font-semibold text-penny-ink">Could not load feedback. Sign in again or refresh.</p><button type="button" onClick={refresh} className={`${secondaryButtonClass} mt-4`}>Try again</button></OperatorCard> : null}
        {resource.kind === 'ready' && resource.data.length === 0 ? <OperatorEmpty title="No feedback to review.">New customer submissions that need review will appear here.</OperatorEmpty> : null}
        {resource.kind === 'ready' && resource.data.length > 0 ? <div className="space-y-5">{resource.data.map((row) => <div key={`${row.id}:${revision}`} className="min-w-0">{canSelect ? <label className="mb-2 flex min-h-11 items-center gap-3 text-sm font-semibold text-penny-ink"><input type="checkbox" className="size-4 shrink-0" checked={selected.has(row.id)} disabled={busy} onChange={() => toggle(row.id)} /><span className="min-w-0 break-words">Select {row.title}</span></label> : null}<ModerationCard row={row} report={setMessage} /></div>)}</div> : null}
      </div>}</RequestBulk>
    </section>
  )
}
