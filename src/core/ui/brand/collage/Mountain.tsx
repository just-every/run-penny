import { TornCircle } from '@/core/ui/brand/collage/Torn'

// The summit's silhouette, shared by the lit face and the pencilled ridge line drawn over it.
const ridge = 'M196 410 254 350 284 364 345 291 383 330 420 302 466 410'

// Pencil hatching on the lit faces, short strokes laid at one slant like shading with the side of a pencil.
const hatch = [
  [300, 352], [308, 344], [316, 336], [324, 326], [332, 316], [306, 366], [314, 358], [322, 350], [330, 340], [338, 330],
  [312, 382], [320, 374], [328, 364], [388, 340], [396, 332], [404, 324], [394, 352], [402, 344], [410, 336], [262, 382], [270, 376],
].map(([x, y]) => `M${x} ${y}l-6 11`).join('')

/** The milestone: a torn sand half-disc with a pencilled mountain, a road switching back up it and a flag on the summit. */
export function Mountain() {
  return (
    <g className="pl-mountain">
      <TornCircle cx={330} cy={412} r={150} from={180} to={360} tone="sand" seed={21} rough={2.6} />
      <path d={`${ridge}Z`} fill="#ad9c85" filter="url(#pl-sand)" />
      <path className="pl-hatch" d={hatch} />
      <path className="pl-shade" d="M345 291 383 330 371 352 386 410 334 410 352 352 338 322ZM420 302 466 410 430 410 418 360 404 330ZM254 350 284 364 262 410 238 410 262 372Z" filter="url(#pl-charcoal)" />
      <path className="pl-ridge" d={ridge} />
      <path className="pl-trail" d="M296 410C282 392 326 384 318 362 312 344 338 336 344 304" />
      <path className="pl-ink" d="M345 292V258" vectorEffect="non-scaling-stroke" />
      <path className="pl-flag" d="M345 259 368 265 345 273Z" vectorEffect="non-scaling-stroke" />
    </g>
  )
}
