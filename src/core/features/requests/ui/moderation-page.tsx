import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { OperatorEmpty, OperatorResourceLoading } from '@/core/app/ui/operator-resource-state'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Icon } from '@/core/ui/app/Icon'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { useState } from 'react'
import { ModerationCard, type QueueRequest } from './moderation-card'

export function ModerationPage() {
  const [resource, refresh] = usePublicResource<QueueRequest[]>('/api/operator/moderation'), [message, setMessage] = useState('')
  return (
    <section>
      <OperatorPageHeader eyebrow="Customer feedback" title="Review feedback before it becomes public." art={resource.kind === 'ready' && resource.data.length === 0 || resource.kind === 'error' ? null : { note: 'Nothing goes public until approved.' }} action={<a href="/app/settings" className={secondaryButtonClass}><Icon name="settings" />Feedback settings</a>}>Approve customer-safe wording, board and display name explicitly. Original evidence remains private and unchanged.</OperatorPageHeader>
      <p role="status" className="mt-5 text-base font-semibold text-penny-ink empty:hidden">{message}</p>
      <div className="mt-6 sm:mt-8">
        {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading moderation queue…" /> : null}
        {resource.kind === 'error' ? <OperatorCard className="p-6" role="alert"><p className="text-sm font-semibold text-penny-ink">Could not load feedback. Sign in again or refresh.</p><button type="button" onClick={refresh} className={`${secondaryButtonClass} mt-4`}>Try again</button></OperatorCard> : null}
        {resource.kind === 'ready' && resource.data.length === 0 ? <OperatorEmpty title="No feedback to review.">New customer submissions that need review will appear here.</OperatorEmpty> : null}
        {resource.kind === 'ready' && resource.data.length > 0 ? <div className="space-y-5">{resource.data.map((row) => <ModerationCard key={row.slug} row={row} report={setMessage} />)}</div> : null}
      </div>
    </section>
  )
}
