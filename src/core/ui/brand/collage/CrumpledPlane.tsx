// The crumpled paper plane: the plane after a bad landing, for a load failure. Pale creased facets with the kraft grain, an inked outline and
// fold lines, nose to the upper right, drawn on a 100 × 70 grid and placed at (x, y) with an optional scale and tilt.
const facets = [
  { d: 'M6 41 31 35 47 45 93 7Z', fill: '#f6f1e7' },
  { d: 'M47 45 93 7 61 66 53 51Z', fill: '#e2d8c6' },
  { d: 'M6 41 17 38 23 53 12 50Z', fill: '#ebe3d3' },
  { d: 'M17 38 31 35 47 45 36 59 23 53Z', fill: '#d8ccb7' },
]
const folds = 'M19 43 38 41 53 30M50 50 69 31M28 51 44 49M57 57 75 26'

export function CrumpledPlane({ x, y, scale = 1, rotate = 0 }: { x: number; y: number; scale?: number; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <g filter="url(#pl-kraft)">{facets.map((facet) => <path key={facet.d} d={facet.d} fill={facet.fill} className="pl-crumple" vectorEffect="non-scaling-stroke" />)}</g>
      <path d={folds} className="pl-crumple-fold" vectorEffect="non-scaling-stroke" />
    </g>
  )
}
