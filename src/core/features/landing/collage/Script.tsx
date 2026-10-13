import { seeded } from '@/core/ui/brand/collage/tearing'
import { TornRect } from '@/core/ui/brand/collage/Torn'

/**
 * Old handwriting on a torn sheet: rows of slanted cursive scribble, generated from a seed so it is identical on the server
 * and in the browser. Each letter is one cubic curve: a loop (e, l), an arch (n, m) or a descender (g, y), of varied width
 * and height; words are mostly spaced but sometimes joined by a flat connector, and each row's baseline drifts a little.
 */
function scribble(x: number, y: number, w: number, rows: number, gap: number, seed: number): string {
  const random = seeded(seed)
  const parts: string[] = []
  for (let row = 0; row < rows; row += 1) {
    const base = y + row * gap
    const drift = { phase: random() * 6.28, length: 40 + random() * 50 }
    const baseline = (at: number) => base + 2 * Math.sin(at / drift.length + drift.phase)
    // The pen leans right: a point `rise` above the baseline moves right by a fifth of it.
    const pt = (px: number, py: number, at: number) => `${(px + 0.21 * (baseline(at) - py)).toFixed(1)} ${py.toFixed(1)}`
    let cursor = x + random() * 14
    let joined = false
    while (cursor < x + w - 24) {
      if (!joined) parts.push(`M${pt(cursor, baseline(cursor), cursor)}`)
      const letters = 2 + Math.floor(random() * 6)
      for (let i = 0; i < letters && cursor < x + w - 12; i += 1) {
        const step = 4 + random() * 8
        const next = cursor + step
        const b = baseline(cursor)
        const end = pt(next, baseline(next) + (random() - 0.5) * 1.4, next)
        const kind = random()
        if (kind < 0.12) {
          const depth = gap * (0.38 + random() * 0.14)
          parts.push(`C${pt(cursor + step * 1.3, b + depth, cursor)} ${pt(cursor - step * 0.5, b + depth, cursor)} ${end}`)
        } else if (kind < 0.4) {
          const tall = gap * (0.2 + random() * 0.14)
          parts.push(`C${pt(cursor + step * 0.1, b - tall, cursor)} ${pt(next - step * 0.1, b - tall, cursor)} ${end}`)
        } else {
          const tall = random() < 0.24 ? gap * (0.52 + random() * 0.2) : gap * (0.18 + random() * 0.2)
          parts.push(`C${pt(cursor + step * 1.5, b - tall, cursor)} ${pt(cursor - step * 0.6, b - tall, cursor)} ${end}`)
        }
        cursor = next
      }
      joined = random() < 0.18
      const space = joined ? 10 + random() * 10 : 9 + random() * 12
      if (joined) parts.push(`L${pt(cursor + space, baseline(cursor + space), cursor + space)}`)
      cursor += space
    }
  }
  return parts.join('')
}

type ScriptProps = { x: number; y: number; w: number; h: number; seed: number; rotate?: number; tone?: 'sand' | 'cream' }

/** A torn sheet of old handwriting. */
export function ScriptPaper({ x, y, w, h, seed, rotate = 0, tone = 'cream' }: ScriptProps) {
  const transform = rotate ? `rotate(${rotate} ${x + w / 2} ${y + h / 2})` : undefined
  const gap = 24
  const rows = Math.max(1, Math.floor((h - 26) / gap))
  return (
    <g transform={transform}>
      <TornRect x={x} y={y} w={w} h={h} tone={tone} seed={seed} />
      <path className="pl-script" d={scribble(x + 14, y + 32, w - 26, rows, gap, seed + 1)} />
    </g>
  )
}
