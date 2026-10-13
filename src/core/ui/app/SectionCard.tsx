import type { ReactNode } from 'react'
import { paperCardClass } from './classes'
import { IconDisc, type IconName } from './Icon'

/**
 * A long form's own paper card (a settings section, a brief's edit form): a head with a 56px sand icon disc, the heading and
 * its description, then a hairline and the body. `id` is the heading's id; the section names itself with it.
 */
export function SectionCard({ id, icon, title, description, className = '', children }: { readonly id: string; readonly icon: IconName; readonly title: string; readonly description?: ReactNode; readonly className?: string; readonly children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${paperCardClass} p-5 sm:p-6 ${className}`.trim()}>
      <div className="flex items-start gap-4 sm:gap-6">
        <IconDisc name={icon} size="section" />
        <div className="min-w-0 flex-1 sm:pt-1.5">
          <h2 id={id} className="text-xl leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-2xl">{title}</h2>
          {description ? <div className="mt-1.5 text-[15px] leading-normal text-penny-muted sm:text-base">{description}</div> : null}
        </div>
      </div>
      <div className="mt-5 border-t border-penny-line pt-5">{children}</div>
    </section>
  )
}
