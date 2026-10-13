import { tornCircle, tornRect } from './tearing'

/** `rust` is the copper dark enough to carry white text (--copper-text). */
export type Tone = 'copper' | 'rust' | 'sand' | 'cream' | 'kraft' | 'charcoal'

const fill: Record<Tone, string> = {
  copper: '#c85d2f',
  rust: '#ad4a1f',
  sand: '#efd4ac',
  cream: '#f3e7d3',
  kraft: '#dfbf93',
  charcoal: '#2f2d2a',
}

const filter: Record<Tone, string> = {
  copper: 'pl-copper',
  rust: 'pl-copper',
  sand: 'pl-sand',
  cream: 'pl-sand',
  kraft: 'pl-sand',
  charcoal: 'pl-charcoal',
}

/** How ragged each paper tears by default: thin copper paper tears finest, heavy charcoal paper coarsest. */
const roughness: Record<Tone, number> = { copper: 2.6, rust: 2.6, sand: 3, cream: 3, kraft: 3, charcoal: 3.4 }

/** Small pieces fray less, so a little disc keeps a round edge instead of a cog's. */
const SMALL = 60
const paper = (tone: Tone, small: boolean) => `url(#${filter[tone]}${small ? '-small' : ''})`

type RectProps = { x: number; y: number; w: number; h: number; tone: Tone; seed: number; rotate?: number; rough?: number }

/** A torn sheet of coloured paper. */
export function TornRect({ x, y, w, h, tone, seed, rotate = 0, rough = roughness[tone] }: RectProps) {
  const transform = rotate ? `rotate(${rotate} ${x + w / 2} ${y + h / 2})` : undefined
  return <path d={tornRect(x, y, w, h, seed, rough)} fill={fill[tone]} filter={paper(tone, Math.min(w, h) <= SMALL)} transform={transform} />
}

type CircleProps = { cx: number; cy: number; r: number; tone: Tone; seed: number; from?: number; to?: number; rough?: number }

/** A torn paper disc, or part of one (`from`/`to` in degrees, 180–360 being the upper half). */
export function TornCircle({ cx, cy, r, tone, seed, from, to, rough = roughness[tone] }: CircleProps) {
  return <path d={tornCircle(cx, cy, r, seed, rough, from, to)} fill={fill[tone]} filter={paper(tone, r <= SMALL)} />
}
