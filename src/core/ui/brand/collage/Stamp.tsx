import { STAR_EDGE, stampStarPath } from './star'
import { tornCircle } from './tearing'

/**
 * The copper stamp: a small torn copper disc with a pale freehand five-point star pressed into it. The star is filled paper
 * with a thin paper edge in the stamp's own units (STAR_EDGE of the radius), so it keeps its proportions however small the
 * drawing renders.
 */
export function StarStamp({ cx, cy, r, seed }: { cx: number; cy: number; r: number; seed: number }) {
  return (
    <g className="pl-stamp">
      <path d={tornCircle(cx, cy, r, seed, 1.6)} fill="#c85d2f" filter="url(#pl-copper-small)" />
      <path d={stampStarPath(cx, cy, r)} className="pl-stamp-star" style={{ strokeWidth: r * STAR_EDGE }} />
    </g>
  )
}
