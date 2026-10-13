import { CoinMark } from '@/core/ui/brand/CoinMark'
import { Glyph } from '../collage/Glyph'
import { Arrow, Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Lines, Note, NoteStack, Text } from '@/core/ui/brand/collage/Note'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { ScriptPaper } from '../collage/Script'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { copy } from '../copy'

const art = copy.art.loop
const stageGlyphs = ['doneGrey', 'doneGrey', 'done'] as const

/** Closing the loop: the roadmap reaches Shipped, the update letter goes out and the paper plane comes home. */
export function LoopArt() {
  return (
    <Stage label={art.label} width={800} height={520} className="pl-loop-drawing">
      <Layer>
        <TornRect x={70} y={10} w={276} h={188} tone="copper" seed={51} rotate={-2} />
        <TornCircle cx={110} cy={210} r={96} tone="sand" seed={52} />
        <TornCircle cx={462} cy={126} r={116} tone="charcoal" seed={53} />
        <TornCircle cx={622} cy={126} r={86} tone="sand" seed={54} />
        <TornCircle cx={362} cy={326} r={72} tone="sand" seed={55} />
        <ScriptPaper x={652} y={258} w={112} h={224} seed={56} rotate={6} />
        <Burst x={62} y={110} angle={-150} spread={30} gap={22} length={18} />
        <Burst x={732} y={112} angle={-40} spread={30} gap={20} length={18} />
        <Arrow d="M368 180C390 160 420 150 450 156" hx={450} hy={156} angle={10} halo />
        <Ink d="M440 372C420 420 368 462 318 458 286 455 252 440 250 418 248 396 276 392 278 410 280 432 250 444 218 438 186 432 160 424 138 418" />
        <Plane x={46} y={372} rotate={-8} />
      </Layer>

      <Note x={115} y={56} w={300} h={282} className="pl-roadmap">
        <span className="pl-row"><CoinMark className="pl-coin-dot" tier="full" /><Text size={19}>{art.roadmap}</Text></span>
        <ol className="pl-steps pl-steps--lined">
          {art.stages.map((stage, index) => (
            <li key={stage}>
              <Glyph name={stageGlyphs[index]} size={index === 2 ? 30 : 26} />
              <span className="pl-step-text"><Text size={15} className={index === 2 ? 'pl-strong' : ''}>{stage}</Text><Lines widths={[92, 70]} /></span>
            </li>
          ))}
        </ol>
      </Note>

      {/* The follow-through note is stacked under the letter so it never covers the letter's button on a narrow stage. */}
      <NoteStack x={450} y={96}>
        <Note x={0} y={0} w={280} h={236} r={8} className="pl-update">
          <span className="pl-row"><span className="pl-badge"><Glyph name="envelope" size={30} /></span><Text size={20} hand>{art.letterTitle}</Text></span>
          <Text size={15}>{art.letterBody}</Text>
          <Lines widths={[94, 72]} />
          <span className="pl-button pl-button--wide"><Text size={14}>{art.button}</Text><Glyph name="arrow" size={15} /></span>
        </Note>
        <Note x={-32} y={6} w={256} h={120} r={-8} tone="sand" cut="c" className="pl-loop-note">
          <Text size={19} hand><Signed lines={art.note} /></Text>
        </Note>
      </NoteStack>

      <Layer front>
        <StarStamp cx={730} cy={448} r={40} seed={57} />
      </Layer>
    </Stage>
  )
}
