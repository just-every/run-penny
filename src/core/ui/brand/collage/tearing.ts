// Torn-paper outlines. Each shape walks its perimeter in uneven short steps and moves every point in or out along the edge's
// normal by three seeded terms: a slow wave (two long sines, the tear wandering along the paper's grain), a fine fibre jitter,
// and now and then a bite, a steep nick that eases back out over a few steps. Everything comes from the seed, so the server
// and the browser draw the same edge and nothing differs at hydration. The SVG fibre filter (Filters.tsx) then frays the
// edge further and adds the paper's grain.
type Point = readonly [number, number]
/** A point on the untorn outline: its position, outward normal and distance along the perimeter. */
type Sample = { x: number; y: number; nx: number; ny: number; s: number }

/** A small deterministic generator (mulberry32): the same seed always gives the same tear. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (value: number) => Math.round(value * 10) / 10

function toPath(points: readonly Point[]): string {
  return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`
}

/** The next step along the edge: between half and one and a bit of the nominal step, so no rhythm repeats. */
const nextStep = (random: () => number, step: number) => step * (0.5 + random() * 0.6)

/**
 * The tear's offset at each sample (positive is outward). `perimeter` makes the slow wave close on itself for a whole
 * outline; an open run (a half disc's chord) passes its own length.
 */
function tear(samples: readonly Sample[], perimeter: number, random: () => number, rough: number): number[] {
  const waves = [0, 1].map(() => {
    const cycles = Math.max(1, Math.round(perimeter / (50 + random() * 70)))
    return { k: (2 * Math.PI * cycles) / perimeter, phase: random() * 2 * Math.PI, amp: rough * (0.32 + random() * 0.22) }
  })
  const bite = [1, 0.62, 0.3, 0.1]
  let biting = -1
  let depth = 0
  return samples.map(({ s }) => {
    const slow = waves.reduce((sum, w) => sum + w.amp * Math.sin(w.k * s + w.phase), 0)
    const fibre = (random() - 0.5) * 1.1 * rough
    if (biting < 0 && random() < 0.05) {
      biting = 0
      depth = rough * (1.4 + random() * 0.9)
    }
    let nick = 0
    if (biting >= 0) {
      nick = depth * bite[biting]
      biting = biting + 1 < bite.length ? biting + 1 : -1
    }
    return slow + fibre - nick
  })
}

function place(samples: readonly Sample[], offsets: readonly number[]): Point[] {
  return samples.map(({ x, y, nx, ny }, index) => [x + nx * offsets[index], y + ny * offsets[index]] as const)
}

/** A rectangle torn on every side. */
export function tornRect(x: number, y: number, w: number, h: number, seed: number, rough = 3.2, step = 8): string {
  const random = seeded(seed)
  const corners: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  const samples: Sample[] = []
  let travelled = 0
  corners.forEach(([x0, y0], side) => {
    const [x1, y1] = corners[(side + 1) % 4]
    const length = Math.hypot(x1 - x0, y1 - y0)
    // Outward normal of this side (clockwise winding).
    const nx = (y1 - y0) / length
    const ny = -(x1 - x0) / length
    for (let along = 0; along < length - step * 0.3; along += nextStep(random, step)) {
      const t = along / length
      samples.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, nx, ny, s: travelled + along })
    }
    travelled += length
  })
  return toPath(place(samples, tear(samples, travelled, random, rough)))
}

/** A full circle, or the arc from `from` to `to` degrees closed by a torn straight edge (a half disc for 180–360). */
export function tornCircle(cx: number, cy: number, r: number, seed: number, rough = 3, from = 0, to = 360, step = 7): string {
  const random = seeded(seed)
  const span = to - from
  const arc = (Math.PI * r * span) / 180
  const samples: Sample[] = []
  for (let along = 0; along < arc - (span === 360 ? step * 0.3 : 0); along += nextStep(random, step)) {
    const angle = (from * Math.PI) / 180 + along / r
    samples.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle), s: along })
  }
  if (span === 360) return toPath(place(samples, tear(samples, arc, random, rough)))

  // A part disc: tear the arc up to its end, then close along the chord with a gentler tear of its own.
  const end = ((from + span) * Math.PI) / 180
  samples.push({ x: cx + r * Math.cos(end), y: cy + r * Math.sin(end), nx: Math.cos(end), ny: Math.sin(end), s: arc })
  const points = place(samples, tear(samples, arc * 2, random, rough))
  const [ex, ey] = points[points.length - 1]
  const [sx, sy] = points[0]
  const length = Math.hypot(sx - ex, sy - ey)
  const chord: Sample[] = []
  for (let along = nextStep(random, step); along < length - step * 0.4; along += nextStep(random, step)) {
    const t = along / length
    chord.push({ x: ex + (sx - ex) * t, y: ey + (sy - ey) * t, nx: (sy - ey) / length, ny: -(sx - ex) / length, s: along })
  }
  return toPath([...points, ...place(chord, tear(chord, length * 2, random, rough * 0.6))])
}
