import { formatOperatorDate } from '@/core/app/ui/operator-format'
import { Chip } from '@/core/ui/app/Chip'
import { DataField } from '@/core/ui/app/DataField'
import { DoneMark } from '@/core/ui/app/Icon'
import { SectionCard } from '@/core/ui/app/SectionCard'
import { insetPanelClass } from '@/core/ui/app/classes'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'

interface Delivery {
  readonly kind?: 'update' | 'rejection'
  readonly id: string
  readonly requestId: string
  readonly state: 'queued' | 'sending' | 'accepted' | 'failed' | 'suppressed' | 'unknown' | 'delivered'
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
    ? resource.data.deliveries.filter((delivery) => delivery.kind === 'rejection' || delivery.state === 'unknown' || delivery.state === 'failed')
    : []

  return (
    <SectionCard id="delivery-review-heading" icon="mail" title="Requester email delivery" description="Private rejection notices and messages needing attention appear here. Provider acceptance does not confirm inbox delivery; unknown results are held without automatic resend.">
      {resource.kind === 'loading' ? <p className="text-base text-penny-muted" role="status">Loading delivery details…</p> : null}
      {resource.kind === 'error' ? <p className="text-base font-semibold text-penny-danger" role="alert">Delivery details could not be loaded.</p> : null}
      {resource.kind === 'ready' && needsReview.length === 0 ? <p className="flex items-center gap-3 rounded-lg bg-penny-moss-wash px-4 py-3 text-base text-penny-ink"><DoneMark className="size-7" />No requester messages need delivery review.</p> : null}
      {needsReview.length > 0 ? <ul className="space-y-3">{needsReview.map((delivery) => (
        <li key={delivery.id}>
          <article className={`${insetPanelClass} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-bold text-penny-ink">{delivery.kind === 'rejection' ? 'Private rejection notice' : 'Requester update'}</h3>
                <p className="mt-1 break-words text-sm leading-6 text-penny-muted">{deliveryDescription(delivery)}</p>
              </div>
              <Chip tone="copper">{deliveryLabel(delivery)}</Chip>
            </div>
            <dl className="mt-4 grid min-w-0 gap-x-5 gap-y-3 border-t border-penny-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <DataField label="Request record" valueClassName="break-all">{delivery.requestId}</DataField>
              {delivery.failureReason ? <DataField label="Outcome reason">{delivery.failureReason.replaceAll('_', ' ')}</DataField> : null}
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

function deliveryLabel(delivery: Delivery): string {
  if (delivery.state === 'accepted') return delivery.provider === 'development' ? 'Captured in local outbox' : 'Provider accepted'
  return { queued: 'Queued', sending: 'Sending', failed: 'Failed', suppressed: 'Not sent', unknown: 'Unknown result', delivered: 'Delivery confirmed' }[delivery.state]
}
function deliveryDescription(delivery: Delivery): string {
  if (delivery.state === 'accepted') return delivery.provider === 'development'
    ? 'The message is in the gated development outbox. No real inbox delivery is claimed.'
    : 'The mail provider accepted this message. Inbox delivery is not yet confirmed.'
  return { queued: 'Waiting for the next permitted send time. Current author consent and privacy settings will be checked before sending.',
    sending: 'A durable attempt owns this message. It will not be sent again while that result is pending.',
    failed: 'This message could not be sent. Review the outcome reason and email configuration.',
    suppressed: 'This message was not sent. The outcome reason explains why.',
    unknown: 'Penny could not confirm whether the provider accepted this message. Automatic resending is disabled; check provider records.',
    delivered: 'The provider reported delivery.' }[delivery.state]
}
