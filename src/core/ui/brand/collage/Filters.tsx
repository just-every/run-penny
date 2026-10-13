// The paper filters every torn shape on the page refers to, defined once. Each one frays the shape's edge (feTurbulence +
// feDisplacementMap), lays a grain of mottling and stretched fibres over its colour, and lights a thin ragged rim where the
// paper's pale core shows through the tear, in patches rather than as an even die-cut border. Every paper has a `-small`
// twin that frays less, for discs and scraps small enough that a full fray would turn their edge into a cog. Filters are
// drawn at the screen's own resolution, so they stay crisp at any DPR.
type PaperFilter = {
  id: string
  /** How far the edge frays, in drawing units. */
  fray: number
  /** The grain: colour × (base + mul × noise) + add × noise. */
  base: number
  mul: number
  add: number
  /** The noise's tone curve; a steeper table means harsher fibres. */
  curve: string
  /** Width of the pale torn rim, in drawing units; 0 for none. */
  rim: number
  seed: number
}

const full: PaperFilter[] = [
  { id: 'pl-copper', fray: 6, base: 0.66, mul: 0.62, add: 0.02, curve: '0 0.2 0.48 0.72 1', rim: 1, seed: 3 },
  { id: 'pl-sand', fray: 5, base: 0.8, mul: 0.34, add: 0, curve: '0.1 0.35 0.55 0.75 0.95', rim: 1, seed: 7 },
  { id: 'pl-charcoal', fray: 6, base: 0.7, mul: 0.5, add: 0.3, curve: '0 0.05 0.3 0.7 1', rim: 1, seed: 11 },
]
// Kraft board: the sand grain on a crisp, unfrayed edge, for folded and cut shapes such as the parcel's faces.
const kraft: PaperFilter = { id: 'pl-kraft', fray: 0, base: 0.8, mul: 0.34, add: 0, curve: '0.1 0.35 0.55 0.75 0.95', rim: 0, seed: 9 }
const papers: PaperFilter[] = [...full, ...full.map((paper) => ({ ...paper, id: `${paper.id}-small`, fray: Math.round(paper.fray / 2) })), kraft]

const grey = '0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 0 1'

function Paper({ id, fray, base, mul, add, curve, rim, seed }: PaperFilter) {
  return (
    <filter id={id} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={3} seed={seed} result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale={fray} xChannelSelector="R" yChannelSelector="G" result="shape" />
      <feTurbulence type="fractalNoise" baseFrequency="0.013 0.022" numOctaves={3} seed={seed + 1} result="mottle" />
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.32" numOctaves={2} seed={seed + 2} result="fibre" />
      <feComposite in="mottle" in2="fibre" operator="arithmetic" k2={0.55} k3={0.45} result="mix" />
      <feColorMatrix in="mix" type="matrix" values={grey} result="grey" />
      <feComponentTransfer in="grey" result="tone">
        <feFuncR type="table" tableValues={curve} />
        <feFuncG type="table" tableValues={curve} />
        <feFuncB type="table" tableValues={curve} />
      </feComponentTransfer>
      <feComposite in="shape" in2="tone" operator="arithmetic" k1={mul} k2={base} k3={add} result="lit" />
      <feComposite in="lit" in2="shape" operator="in" result="paper" />
      {rim > 0 ? (
        <>
          <feMorphology in="shape" operator="erode" radius={rim} result="core" />
          <feComposite in="shape" in2="core" operator="out" result="rim" />
          {/* Slow patches decide where the pale core shows: about three fifths of the edge. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={seed + 3} result="patches" />
          <feColorMatrix in="patches" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 6 0 0 0 -2.35" result="patchMask" />
          <feComposite in="rim" in2="patchMask" operator="in" result="edge" />
          <feColorMatrix in="tone" type="matrix" values="0 0 0 0 0.99 0 0 0 0 0.96 0 0 0 0 0.9 1.9 0 0 0 -0.62" result="fleck" />
          <feComposite in="fleck" in2="edge" operator="in" result="torn" />
          <feMerge>
            <feMergeNode in="paper" />
            <feMergeNode in="torn" />
          </feMerge>
        </>
      ) : null}
    </filter>
  )
}

/** One zero-size SVG holding the shared filters; it must stay rendered (not display: none) for the references to resolve. */
export function CollageFilters() {
  return (
    <svg className="pl-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {papers.map((paper) => <Paper key={paper.id} {...paper} />)}
      </defs>
    </svg>
  )
}
