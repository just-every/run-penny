import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HeaderCollage } from '@/core/ui/app/collage/HeaderCollage'
import { Icon } from '@/core/ui/app/Icon'
import { PageTitle } from '@/core/ui/app/PageTitle'

/** The page's collage vignette and its handwritten line. Pass none while the page's main list is empty or failed to load. */
export interface HeaderArt {
  readonly note: string
}

/**
 * An operator page's header: the copy (eyebrow, title at the landing's scale, lede and any action) at the left, and an
 * optional paper-collage vignette at the right. From sm up the vignette has its own column; on a phone it floats at the top
 * right and the eyebrow and title wrap around it, so a long title keeps the full width below it. It steps aside below 340px.
 */
export function OperatorPageHeader({ eyebrow, title, children, action, art }: { readonly eyebrow: string; readonly title: string; readonly children: ReactNode; readonly action?: ReactNode; readonly art?: HeaderArt | null }) {
  return (
    <header className={`flow-root sm:grid sm:items-start sm:gap-x-8 ${art ? 'sm:grid-cols-[minmax(0,1fr)_min(40%,520px)] sm:grid-rows-[auto_1fr]' : 'sm:grid-cols-1'}`}>
      {art ? <div className="float-right -mt-1 mb-1 ml-3 w-[110px] max-[339px]:hidden sm:float-none sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:m-0 sm:w-auto"><HeaderCollage note={art.note} /></div> : null}
      <div className="max-w-[44rem] sm:col-start-1 sm:row-start-1 sm:min-w-0 sm:pt-4"><PageTitle eyebrow={eyebrow} size="app">{title}</PageTitle></div>
      <div className="min-w-0 max-w-[44rem] sm:col-start-1 sm:row-start-2">
        <div className="mt-4 text-[17px] leading-normal text-penny-soft sm:text-xl">{children}</div>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </header>
  )
}

const backLinkClass = 'inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-penny-ink hover:text-penny-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent'

/** The "All releases" style link above an operator detail page. */
export function OperatorDetailBack({ to, children }: { readonly to: '/app/decisions' | '/app/releases' | '/app/accounts'; readonly children: string }) {
  return <div className="mb-2"><Link to={to} className={backLinkClass}><Icon name="arrow" className="size-4 rotate-180" />{children}</Link></div>
}
