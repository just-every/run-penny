import type { ReactNode } from 'react'
import { CopperStroke } from '@/core/ui/brand/collage/Stroke'
import { eyebrowClass } from './classes'

// Title sizes. `app` is the landing's scale for an operator page: 52px from xl, 46px beside the sidebar at lg, and 26px on a
// phone, where the title wraps around the vignette as the phone picks draw it. `card` heads a centred card such as sign-in
// (34px, 40px from sm). Both take no negative tracking, as the landing's headlines do. `portal` is the customer pages'
// quieter title exactly as the owner approved it, with its own eyebrow.
const sizes = {
  app: { eyebrow: eyebrowClass, gap: 'mt-3 ', title: 'leading-[1.04] text-[26px] sm:text-[42px] lg:text-[46px] xl:text-[52px]', stroke: 'mt-2.5 h-2.5 w-[min(12rem,70%)] sm:w-[min(18rem,60%)]' },
  card: { eyebrow: eyebrowClass, gap: 'mt-3 ', title: 'leading-[1.02] text-[34px] sm:text-[40px]', stroke: 'mt-2.5 h-2.5 w-[min(12rem,70%)] sm:w-[min(16rem,60%)]' },
  portal: { eyebrow: 'text-xs font-semibold tracking-[0.14em] text-penny-accent uppercase', gap: 'mt-2 ', title: 'text-3xl leading-[1.1] tracking-[-0.025em] sm:text-4xl', stroke: 'mt-2 h-2 w-[min(11rem,70%)]' },
} as const

/**
 * A page's title block: an optional copper eyebrow, the h1 (extra-bold Inter Tight) with the copper hand stroke under its
 * last line. `id` is the h1's id, for a section that names itself with aria-labelledby.
 */
export function PageTitle({ children, id, eyebrow, size = 'portal', className = '' }: { readonly children: ReactNode; readonly id?: string; readonly eyebrow?: string; readonly size?: keyof typeof sizes; readonly className?: string }) {
  const scale = sizes[size]
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      {eyebrow ? <p className={scale.eyebrow}>{eyebrow}</p> : null}
      <h1 id={id} className={`${eyebrow ? scale.gap : ''}break-words font-extrabold text-penny-ink ${scale.title}`}>{children}</h1>
      <CopperStroke className={scale.stroke} />
    </div>
  )
}
