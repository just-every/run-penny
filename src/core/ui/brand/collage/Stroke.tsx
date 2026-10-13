import { useId } from 'react'

// The brush: a slight smile that rises to the right, full and round where the brush lands, thinning to a dry tail with
// one bristle streak breaking away beneath it.
const body = 'M3 3.6C60 4.6 120 6.6 170 6.4 220 6.2 262 4.4 297 1.8c1.6.5 1.2 2.4-.4 3.1C262 8.8 220 14.6 168 16.8 118 18.6 60 19.4 6 19.2C2 19 .4 15 .4 11.4.4 7.6 1 3.8 3 3.6Z'
const bristle = 'M196 17.7C230 16.1 260 13.1 289 9.5c1 .3.9 1-.2 1.4C260 14.7 230 17.7 196 18.9Z'

/**
 * Penny's copper hand-drawn stroke, drawn under a key phrase or a current item. Decorative; the parent sizes and places it.
 * Long streaky grain thins the paint in places, like a dry brush, so the stroke matches the grained torn copper.
 */
export function CopperStroke({ className = '' }: { className?: string }) {
  const grain = `pl-brush-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg className={`pl-stroke ${className}`.trim()} viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <filter id={grain} x="-2%" y="-20%" width="104%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.45" numOctaves={2} seed={4} result="fibre" />
        <feColorMatrix in="fibre" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.6 0 0 0 2.95" result="dry" />
        <feComposite in="SourceGraphic" in2="dry" operator="in" />
      </filter>
      <g filter={`url(#${grain})`}>
        <path d={body} />
        <path d={bristle} />
      </g>
    </svg>
  )
}
