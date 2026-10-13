import { CrumpledPlane } from '@/core/ui/brand/collage/CrumpledPlane'
import { Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Note, Text } from '@/core/ui/brand/collage/Note'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { noteLines } from './note-lines'
import './collage.css'

/**
 * The empty-state drawing (360 × 220): a cream note taped down with a copper strip over a torn sand scrap, holding the
 * list's handwritten line, the star stamp at its lower left and the plane looping off to the right. Decorative.
 */
export function EmptyArt({ note, className = '' }: { readonly note: string; readonly className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <Stage width={360} height={220}>
        <Layer>
          <TornRect x={104} y={50} w={178} h={130} tone="sand" seed={81} rotate={5} />
          <Burst x={118} y={78} angle={196} spread={30} gap={20} length={16} />
          <Ink d="M214 184C246 196 270 182 270 158 270 138 248 140 252 156 256 176 286 160 300 100" />
          <Plane x={344} y={44} scale={0.62} rotate={-22} flip />
        </Layer>
        <Note x={114} y={40} w={160} h={118} r={-6} tone="cream" className="pa-note">
          <Text size={25} hand><Signed lines={noteLines(note, 14)} /></Text>
        </Note>
        <Layer front>
          <TornRect x={168} y={26} w={48} h={20} tone="copper" seed={82} rotate={-5} rough={1.6} />
          <StarStamp cx={110} cy={168} r={28} seed={83} />
        </Layer>
      </Stage>
    </div>
  )
}

/** The load-failure drawing (400 × 170): a crumpled plane on torn charcoal over sand, its broken loop trailing in. */
export function ErrorArt({ className = '' }: { readonly className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <Stage width={400} height={170}>
        <Layer>
          <TornCircle cx={250} cy={96} r={72} tone="sand" seed={91} rough={2.2} />
          <TornRect x={206} y={62} w={176} h={92} tone="charcoal" seed={92} rotate={-4} />
          <CrumpledPlane x={244} y={40} scale={1.2} rotate={-6} />
          <Ink d="M8 128C56 126 80 108 76 90 72 72 50 80 58 98 66 120 122 140 196 122 214 118 228 110 246 100" />
          <Burst x={340} y={52} angle={-48} spread={30} gap={20} length={16} />
        </Layer>
      </Stage>
    </div>
  )
}
