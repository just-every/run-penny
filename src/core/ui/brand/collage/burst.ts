// Geometry for hand-inked marks, shared by the landing's drawings (Ink.tsx) and the docs build, which draws the same marks
// into its static HTML. Plain functions of their inputs, so the server, the browser and the build draw identical strokes.

export type BurstShape = { x: number; y: number; angle: number; spread?: number; gap?: number; length?: number }

/** Three short strokes fanning out from (x, y) along `angle` degrees: the "look here" burst beside a note. */
export function burstPath({ x, y, angle, spread = 34, gap = 8, length = 16 }: BurstShape): string {
  return [-1, 0, 1].map((step, index) => {
    const a = ((angle + step * spread) * Math.PI) / 180
    const near = gap + (index === 1 ? 2 : 0)
    const far = near + length * (index === 1 ? 1.15 : 0.9)
    const point = (distance: number) => `${(x + distance * Math.cos(a)).toFixed(1)} ${(y + distance * Math.sin(a)).toFixed(1)}`
    return `M${point(near)}L${point(far)}`
  }).join('')
}
