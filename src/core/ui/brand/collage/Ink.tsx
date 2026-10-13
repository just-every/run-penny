import { burstPath, type BurstShape } from './burst'

// Hand-inked marks: wobbly strokes, arrows and the little bursts of emphasis around a note. Strokes keep their weight on
// screen at any drawing size (non-scaling stroke, width set in the shared collage.css).
type InkProps = { d: string; className?: string; draw?: boolean }

/** One ink stroke. `draw` makes it the stroke that draws itself once on load (hero motion only). */
export function Ink({ d, className = '', draw = false }: InkProps) {
  return <path d={d} className={`pl-ink${draw ? ' pl-draw' : ''} ${className}`.trim()} pathLength={draw ? 1 : undefined} vectorEffect="non-scaling-stroke" />
}

type ArrowProps = { d: string; hx: number; hy: number; angle: number; size?: number; halo?: boolean }

/**
 * An inked arrow: the shaft and a two-stroke head at (hx, hy) pointing along `angle` degrees. `halo` cuts it out of dark
 * paper with a paper-coloured margin, so an arrow crossing charcoal still reads.
 */
export function Arrow({ d, hx, hy, angle, size = 13, halo = false }: ArrowProps) {
  const wing = (offset: number) => {
    const a = ((angle + 180 + offset) * Math.PI) / 180
    return `${(hx + size * Math.cos(a)).toFixed(1)} ${(hy + size * Math.sin(a)).toFixed(1)}`
  }
  const head = `M${wing(-32)}L${hx} ${hy}L${wing(30)}`
  return (
    <>
      {halo ? <><Ink d={d} className="pl-ink--halo" /><Ink d={head} className="pl-ink--halo" /></> : null}
      <Ink d={d} />
      <Ink d={head} />
    </>
  )
}

/** Three short strokes fanning out from a point: the "look here" burst beside a note. */
export function Burst(props: BurstShape) {
  return <Ink d={burstPath(props)} />
}
