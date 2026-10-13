import { Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle } from '@/core/ui/brand/collage/Torn'

/** The closing flourish, pure decoration: torn paper to the left, and the paper plane looping in to land on the right. */
export function ClosingArt() {
  return (
    <div className="pl-closing-art" aria-hidden="true">
      <svg className="pl-closing-left" viewBox="0 0 300 260" focusable="false">
        {/* The copper half disc is tilted and tucked under the sand's rim, so its torn chord reads as layered paper. */}
        <g transform="rotate(-24 206 92)"><TornCircle cx={206} cy={92} r={46} from={180} to={360} tone="copper" seed={82} /></g>
        <TornCircle cx={120} cy={150} r={96} tone="sand" seed={81} />
        <Burst x={236} y={64} angle={-40} spread={30} gap={16} length={16} />
      </svg>
      <svg className="pl-closing-right" viewBox="0 0 360 260" focusable="false">
        <TornCircle cx={244} cy={156} r={78} tone="sand" seed={83} />
        <Ink d="M12 184C44 160 74 160 88 178 100 194 86 214 70 206 54 198 62 168 96 150 120 136 140 124 160 116" />
        <Plane x={248} y={78} scale={0.85} rotate={14} flip />
        <StarStamp cx={322} cy={226} r={26} seed={84} />
      </svg>
    </div>
  )
}
