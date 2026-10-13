import { Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Note, Text } from '@/core/ui/brand/collage/Note'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import './collage.css'

const note = ['One link,', 'one sign-in.']

/**
 * The paper around the sign-in card from sm up (1000 × 720, the card standing in its middle third): torn copper and sand
 * behind the card's top-left corner, a charcoal blot with the star at its bottom right, and at the right the plane with its
 * loop and a sand note. Decorative.
 */
export function SignInArtWide() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 hidden w-[1000px] -translate-x-1/2 -translate-y-1/2 sm:block">
      <Stage width={1000} height={720}>
        <Layer>
          <TornRect x={170} y={190} w={130} h={190} tone="sand" seed={101} rotate={-3} />
          <TornRect x={196} y={70} w={160} h={210} tone="copper" seed={102} rotate={-4} />
          <Burst x={190} y={92} angle={-140} spread={30} gap={24} length={20} />
          <TornCircle cx={770} cy={566} r={78} tone="charcoal" seed={103} />
          <StarStamp cx={790} cy={606} r={38} seed={104} />
          <Ink d="M760 336C800 336 830 320 840 296 848 276 826 266 818 282 808 302 852 300 880 270 900 248 912 230 924 214" />
          <Plane x={1000} y={142} scale={0.95} rotate={-22} flip />
          <Burst x={975} y={352} angle={-40} spread={30} gap={14} length={16} />
        </Layer>
        <Note x={800} y={362} w={180} h={120} r={-4} tone="sand" className="pa-note">
          <Text size={24} hand><Signed lines={note} /></Text>
        </Note>
      </Stage>
    </div>
  )
}

/** On a phone: the note and plane above the card at the right, with a copper scrap peeking behind it. */
export function SignInArtTop() {
  return (
    <div aria-hidden="true" className="relative z-0 -mb-8 ml-auto w-[280px] max-w-full sm:hidden">
      <Stage width={280} height={120}>
        <Layer>
          <TornRect x={196} y={64} w={72} h={70} tone="copper" seed={111} rotate={4} />
          <Plane x={20} y={10} scale={0.45} rotate={8} />
          <Ink d="M62 30C80 50 70 66 58 62 46 58 52 44 64 48 82 54 100 62 132 56" />
          <Burst x={262} y={40} angle={-20} spread={30} gap={10} length={10} />
        </Layer>
        <Note x={140} y={8} w={118} h={70} r={-6} className="pa-note pa-note--tight">
          <Text size={16} hand><Signed lines={note} /></Text>
        </Note>
      </Stage>
    </div>
  )
}

/** On a phone: torn charcoal and sand with the star, peeking out under the card's bottom-left corner. */
export function SignInArtBottom() {
  return (
    <div aria-hidden="true" className="relative z-0 -mt-10 w-[150px] sm:hidden">
      <Stage width={150} height={110}>
        <Layer>
          <TornRect x={8} y={8} w={84} h={80} tone="sand" seed={121} rotate={-5} />
          <TornCircle cx={40} cy={56} r={34} tone="charcoal" seed={122} />
          <StarStamp cx={56} cy={82} r={20} seed={123} />
          <Burst x={20} y={22} angle={-150} spread={30} gap={8} length={10} />
        </Layer>
      </Stage>
    </div>
  )
}
