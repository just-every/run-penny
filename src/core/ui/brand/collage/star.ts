// The stamp's pressed star: a five-point star cut freehand from paper, every arm a little different in length and angle,
// the valleys wandering, the whole thing tilted a few degrees. Fixed offsets, so it is the same hand every time. Shared by
// Stamp.tsx and the docs build, which stamps its callouts with the same mark.

const ARMS = [1.0, 0.94, 1.05, 0.95, 1.0]
const TIPS = [-1.5, 2.5, -2, 2, -1]
const VALLEY = [0.44, 0.49, 0.42, 0.47, 0.45]
const VALLEY_TURN = [1.5, -2, 1, -1.5, 2]

/** The star's paper outline stroke (round joins soften the points), as a fraction of the stamp's radius. */
export const STAR_EDGE = 0.06

/** The star's outline for a stamp of radius `r` centred on (cx, cy); paint it filled, with a round-joined stroke of STAR_EDGE × r. */
export function stampStarPath(cx: number, cy: number, r: number): string {
  const reach = r * 0.68
  const tilt = -90 - 5
  const points: string[] = []
  for (let i = 0; i < 5; i++) {
    const tip = ((tilt + i * 72 + TIPS[i]) * Math.PI) / 180
    const valley = ((tilt + i * 72 + 36 + VALLEY_TURN[i]) * Math.PI) / 180
    points.push(`${(cx + reach * ARMS[i] * Math.cos(tip)).toFixed(1)} ${(cy + reach * ARMS[i] * Math.sin(tip)).toFixed(1)}`)
    points.push(`${(cx + reach * VALLEY[i] * Math.cos(valley)).toFixed(1)} ${(cy + reach * VALLEY[i] * Math.sin(valley)).toFixed(1)}`)
  }
  return `M${points.join('L')}Z`
}
