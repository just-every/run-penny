import { Link } from '@tanstack/react-router'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Icon, IconDisc } from '@/core/ui/app/Icon'

export const cardLinkClass = 'block min-w-0 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent'
export const cardHoverClass = 'transition-colors hover:border-penny-line-strong hover:bg-penny-ink/4'

type AttentionTarget = '/app/moderation' | '/app/feedback' | '/app/decisions' | '/app/roadmap' | '/app/releases'
type AttentionIcon = 'moderation' | 'evidence' | 'decisions' | 'roadmap' | 'releases'

/** One "Needs you" action: a 72px paper row with the item's icon in a sand disc, the count and a chevron. */
export function AttentionLink({ to, icon, count, singular, plural }: { readonly to: AttentionTarget; readonly icon: AttentionIcon; readonly count: number; readonly singular: string; readonly plural: string }) {
  return (
    <li>
      <Link to={to} className={cardLinkClass}>
        <OperatorCard className={`flex min-h-18 items-center gap-4 px-4 sm:px-5 ${cardHoverClass}`}>
          <IconDisc name={icon} />
          <span className="min-w-0 flex-1 text-lg font-medium text-penny-ink sm:text-xl">{count} {count === 1 ? singular : plural}</span>
          <Icon name="arrow" className="size-5 shrink-0 text-penny-ink" />
        </OperatorCard>
      </Link>
    </li>
  )
}
