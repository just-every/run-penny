import { Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Mountain } from '@/core/ui/brand/collage/Mountain'
import { Note, Text } from '@/core/ui/brand/collage/Note'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { noteLines } from './note-lines'
import './collage.css'

/**
 * The wide vignette beside a page title from sm up (520 × 300): a torn copper sheet and sand behind the landing's mountain,
 * a cream note with the page's handwritten line, the plane with its looping ink line, a charcoal blot with the star stamp,
 * and tick bursts.
 */
function WideStage({ note }: { readonly note: string }) {
  return (
    <Stage width={520} height={300} className="hidden sm:block">
      <Layer>
        <TornCircle cx={262} cy={150} r={96} tone="sand" seed={61} rough={2.4} />
        <TornRect x={272} y={22} w={164} h={116} tone="copper" seed={62} rotate={-3} />
        <TornRect x={300} y={206} w={134} h={68} tone="cream" seed={63} rotate={2} />
        <g transform="translate(30 -87) scale(0.72)"><Mountain /></g>
        <TornCircle cx={414} cy={196} r={66} tone="charcoal" seed={64} />
        <StarStamp cx={458} cy={242} r={30} seed={65} />
        <Ink d="M50 192C70 246 150 262 190 240 215 226 206 200 191 210 174 222 190 258 230 256 256 254 278 246 292 232" />
        <Plane x={6} y={150} scale={0.7} rotate={-12} />
        <Burst x={190} y={44} angle={-58} spread={30} gap={18} length={15} />
        <Burst x={446} y={86} angle={-16} spread={28} gap={22} length={15} />
        <Burst x={478} y={250} angle={22} spread={28} gap={18} length={14} />
      </Layer>
      <Note x={10} y={26} w={196} h={110} r={-4} className="pa-note">
        <Text size={21} hand><Signed lines={noteLines(note, 15)} /></Text>
      </Note>
    </Stage>
  )
}

/**
 * The tight vignette a phone title wraps around (150 × 150): the note at the top over the copper sheet, and below it, clear
 * of the note, the mountain on its sand with the plane looping in from the left and the star at the bottom right.
 */
function TightStage({ note }: { readonly note: string }) {
  return (
    <Stage width={150} height={150} className="sm:hidden">
      <Layer>
        <TornRect x={74} y={0} w={72} h={58} tone="copper" seed={72} rotate={3} />
        <TornCircle cx={96} cy={116} r={36} tone="sand" seed={71} rough={2} />
        <g transform="translate(-4 12) scale(0.3)"><Mountain /></g>
        <Ink d="M24 118C22 134 34 142 44 136 52 130 46 120 38 125 30 131 40 148 64 146" />
        <Plane x={2} y={96} scale={0.26} rotate={-12} />
        <StarStamp cx={136} cy={136} r={13} seed={75} />
        <Burst x={146} y={70} angle={-10} spread={30} gap={8} length={8} />
      </Layer>
      <Note x={2} y={6} w={112} h={64} r={-5} className="pa-note pa-note--tight">
        <Text size={13} hand><Signed lines={noteLines(note, 16)} /></Text>
      </Note>
    </Stage>
  )
}

/** The paper-collage vignette in a top-level page's header. Decorative and hidden from assistive technology; `note` is the page's one handwritten line. */
export function HeaderCollage({ note }: { readonly note: string }) {
  return (
    <div aria-hidden="true">
      <WideStage note={note} />
      <TightStage note={note} />
    </div>
  )
}
