import { formatOperatorDate } from '@/core/app/ui/operator-format'
import { Chip } from '@/core/ui/app/Chip'
import { DataField } from '@/core/ui/app/DataField'
import { DoneMark } from '@/core/ui/app/Icon'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { insetPanelClass } from '@/core/ui/app/classes'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'

interface Delivery {
  readonly id: string
  readonly requestId: string
  readonly state: 'queued' | 'sending' | 'accepted' | 'failed' | 'suppressed' | 'unknown'
  readonly provider: string | null
  readonly providerMessageId: string | null
  readonly attemptCount: number
  readonly failureReason: string | null
  readonly windowStart: string | null
  readonly windowEnd: string | null
  readonly nextAttemptAt: string | null
  readonly updatedAt: string
}

interface DeliveryInbox {
  readonly deliveries: readonly Delivery[]
}

export function DeliveryReview() {
  const [resource] = usePublicResource<DeliveryInbox>('/api/operator/notifications')
  const needsReview = resource.kind === 'ready'
    ? resource.data.deliveries.filter((delivery) => delivery.state === 'unknown' || delivery.state === 'failed')
    : []

  return (
    <SectionCard id="delivery-review-heading" icon="mail" title="Requester email delivery" description="Messages with an unknown or failed result appear here. Check the mail provider before acting on a message whose result is unknown.">
      {resource.kind === 'loading' ? <p className="text-base text-penny-muted" role="status">Loading delivery details…</p> : null}
      {resource.kind === 'error' ? <p className="text-base font-semibold text-penny-danger" role="alert">Delivery details could not be loaded.</p> : null}
      {resource.kind === 'ready' && needsReview.length === 0 ? <p className="flex items-center gap-3 rounded-lg bg-penny-moss-wash px-4 py-3 text-base text-penny-ink"><DoneMark className="size-7" />No requester messages need delivery review.</p> : null}
      {needsReview.length > 0 ? <ul className="space-y-3">{needsReview.map((delivery) => (
        <li key={delivery.id}>
          <article className={`${insetPanelClass} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-bold text-penny-ink">{delivery.state === 'unknown' ? 'Acceptance not confirmed' : 'Message failed'}</h3>
                <p className="mt-1 break-words text-sm leading-6 text-penny-muted">{delivery.state === 'unknown'
                  ? 'Penny could not confirm whether the provider accepted this message. Check with the provider before deciding whether to send it again.'
                  : 'This message could not be sent. Check the email configuration and provider records before deciding what to do.'}</p>
              </div>
              <Chip tone="copper">{delivery.state === 'unknown' ? 'Unknown result' : 'Failed'}</Chip>
            </div>
            <dl className="mt-4 grid min-w-0 gap-x-5 gap-y-3 border-t border-penny-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <DataField label="Request record" valueClassName="break-all">{delivery.requestId}</DataField>
              <DataField label="Mail provider">{delivery.provider}</DataField>
              <DataField label="Attempts">{delivery.attemptCount}</DataField>
              {delivery.providerMessageId ? <DataField label="Provider message ID" valueClassName="break-all">{delivery.providerMessageId}</DataField> : null}
              {delivery.windowStart || delivery.windowEnd ? <DataField label="Send window">{formatOperatorDate(delivery.windowStart)} – {formatOperatorDate(delivery.windowEnd)}</DataField> : null}
              {delivery.nextAttemptAt ? <DataField label="Next attempt">{formatOperatorDate(delivery.nextAttemptAt)}</DataField> : null}
              <DataField label="Last updated">{formatOperatorDate(delivery.updatedAt)}</DataField>
            </dl>
          </article>
        </li>
      ))}</ul> : null}
    </SectionCard>
  )
}
