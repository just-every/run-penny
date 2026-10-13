import type { ReactNode } from 'react'
import { disclosureRowClass } from './classes'
import { Icon, IconDisc, type IconName } from './Icon'

const summaryClass = 'flex cursor-pointer list-none items-center gap-4 rounded-xl px-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent sm:px-5 [&::-webkit-details-marker]:hidden'

/** The chevron: right when closed on a phone and down when closed from sm up, turning a quarter when open. */
function RowChevron() {
  return <Icon name="arrow" className="size-5 shrink-0 text-penny-ink transition-transform group-open:rotate-90 sm:rotate-90 sm:group-open:-rotate-90" />
}

/**
 * A disclosure row that leads a page's list (Create decision, Record evidence): a 72px paper card with a sand icon disc,
 * the label and a chevron. Its content opens inside the same card under a hairline.
 */
export function DisclosureRow({ icon, label, open, className = '', children }: { readonly icon: IconName; readonly label: string; readonly open?: boolean; readonly className?: string; readonly children: ReactNode }) {
  return (
    <details className={`${disclosureRowClass} ${className}`.trim()} open={open}>
      <summary className={`${summaryClass} min-h-18`}><IconDisc name={icon} /><span className="min-w-0 flex-1 text-lg font-semibold text-penny-ink sm:text-xl">{label}</span><RowChevron /></summary>
      <div className="border-t border-penny-line p-4 sm:p-6">{children}</div>
    </details>
  )
}

/** The small disclosure inside a card (Manage this bet): a hairline above, a 36px disc, the label and the chevron. */
export function SmallDisclosureRow({ icon, label, children }: { readonly icon: IconName; readonly label: string; readonly children: ReactNode }) {
  return (
    <details className="group mt-5 border-t border-penny-line pt-2">
      <summary className={`${summaryClass} -mx-1 min-h-13 px-1 sm:px-1`}><IconDisc name={icon} size="small" /><span className="min-w-0 flex-1 text-base font-semibold text-penny-ink">{label}</span><RowChevron /></summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  )
}
