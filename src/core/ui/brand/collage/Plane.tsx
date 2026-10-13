/**
 * A folded paper plane in outline, nose to the left (or to the right when flipped), drawn on a 90 × 60 grid and placed at
 * (x, y) with an optional scale and tilt. `className` lets the hero give it its one-shot glide.
 */
export function Plane({ x, y, scale = 1, rotate = 0, flip = false, className = '' }: { x: number; y: number; scale?: number; rotate?: number; flip?: boolean; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${flip ? -scale : scale} ${scale})`}>
      <g data-intro={className.split(/\s+/).includes('pl-glide') ? '' : undefined} className={`pl-plane ${className}`.trim()}>
        <path className="pl-plane-wing" d="M1 21.5 87.5 1.5 37 33.5Z" vectorEffect="non-scaling-stroke" />
        <path className="pl-plane-keel" d="M37 33.5 87.5 1.5 53 58 45.5 40.5Z" vectorEffect="non-scaling-stroke" />
        <path className="pl-ink" d="M37 33.5 45.5 40.5" vectorEffect="non-scaling-stroke" />
      </g>
    </g>
  )
}
