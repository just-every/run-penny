import type { ReactNode } from 'react'
import { DoneMark, Icon } from './Icon'

/**
 * The status chip tones, from the palette only. One meaning each, so a state reads the same on the portal and in the
 * operator app: neutral (new, open, draft), sand (being looked at), copper outline (planned or ready), copper (in motion or
 * due), moss (done or published), muted (closed without shipping), selected (the option a decision committed to).
 */
export type ChipTone = 'neutral' | 'sand' | 'copper-outline' | 'copper' | 'moss' | 'muted' | 'selected'

const tones: Record<ChipTone, string> = {
  neutral: 'border-penny-line-strong/60 bg-penny-card text-penny-ink',
  sand: 'border-[#e3cfae] bg-penny-sand text-penny-ink',
  'copper-outline': 'border-penny-accent/70 bg-penny-card text-penny-accent',
  copper: 'border-penny-copper/30 bg-penny-copper/8 text-penny-accent',
  moss: 'border-penny-moss/30 bg-penny-moss-wash text-penny-moss',
  muted: 'border-penny-line bg-transparent text-penny-muted',
  selected: 'border-penny-copper/30 bg-penny-copper/12 text-penny-accent',
}

/** The selected commitment's mark: a pale star in a filled disc of the chip's own colour. */
const selectedMark = <svg className="size-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="m8 3.6 1.3 2.8 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3Z" fill="#fdfbf6" /></svg>

// The leading mark per tone; a tone without one is an outline or quiet fill on its own.
const marks: Partial<Record<ChipTone, ReactNode>> = {
  copper: <Icon name="clock" className="size-4 shrink-0" />,
  moss: <DoneMark />,
  muted: <Icon name="minus" className="size-4 shrink-0" />,
  selected: selectedMark,
}

// The customer pages keep the small unmarked chip the owner approved, with moss at its approved tint.
const portalTones: Record<ChipTone, string> = { ...tones, moss: 'border-penny-moss/30 bg-penny-moss/10 text-penny-moss' }

/**
 * A small clean status label with a leading mark where its tone has one. `portal` is the customer pages' quieter chip:
 * no mark, small type.
 */
export function Chip({ tone, portal = false, children }: { readonly tone: ChipTone; readonly portal?: boolean; readonly children: ReactNode }) {
  if (portal) return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs leading-none font-semibold whitespace-nowrap ${portalTones[tone]}`}>{children}</span>
  const mark = marks[tone]
  return <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border text-sm leading-none font-semibold whitespace-nowrap sm:h-7 ${mark ? 'pr-3 pl-2' : 'px-3'} ${tones[tone]}`}>{mark}{children}</span>
}
