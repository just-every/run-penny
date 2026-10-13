import { Glyph, type GlyphName } from '../collage/Glyph'
import { Arrow, Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Lines, Note, Text } from '@/core/ui/brand/collage/Note'
import { ScriptPaper } from '../collage/Script'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle } from '@/core/ui/brand/collage/Torn'
import { copy } from '../copy'

const art = copy.art.evidence
// Each clipped note: its source's mark and where it is pinned beside the option it supports.
const clips: { glyph: GlyphName; x: number; y: number; w: number; r: number }[] = [
  { glyph: 'phone', x: 398, y: 88, w: 196, r: -5 },
  { glyph: 'chat', x: 396, y: 254, w: 296, r: -3.5 },
  { glyph: 'envelope', x: 414, y: 154, w: 158, r: -1.5 },
]

/**
 * The copper ring around the chosen option. It is drawn on the option itself and stretches with it, so it still circles the
 * option when the sheet's text keeps its readable minimum on a narrow stage and the option moves down or grows.
 */
function ChosenRing() {
  return (
    <svg className="pl-option-ring" viewBox="110 89.8 297 108.4" preserveAspectRatio="none" focusable="false">
      <Ink className="pl-circle" d="M396 156C408 112 334 88 262 90 182 92 114 108 112 144 110 180 188 200 268 198 340 196 404 180 406 146 404 124 388 110 370 104" />
    </svg>
  )
}

/** The decision sheet: two options with the evidence clipped beside them, the chosen one circled in copper. */
export function EvidenceArt() {
  return (
    <Stage label={art.label} width={760} height={440} className="pl-evidence-drawing">
      <Layer>
        <TornCircle cx={218} cy={204} r={180} tone="sand" seed={41} rough={2.4} />
        <ScriptPaper x={6} y={172} w={204} h={252} seed={42} rotate={-7} />
        <TornCircle cx={572} cy={226} r={130} tone="charcoal" seed={43} />
        <Burst x={118} y={42} angle={-135} spread={30} gap={26} length={18} />
        <Arrow d="M742 300C772 210 740 110 612 80" hx={612} hy={80} angle={-167} />
      </Layer>

      <Note x={112} y={28} w={340} h={372} r={-3.5} className="pl-sheet">
        <Text size={21} hand className="pl-sheet-title">{art.sheet}</Text>
        {art.options.map((option, index) => (
          <span key={option.mark} className={index === 0 ? 'pl-option pl-option--chosen' : 'pl-option'}>
            <span className="pl-option-head"><Text size={15} className="pl-option-mark">{option.mark}</Text><Text size={19} className="pl-strong">{option.title}</Text></span>
            <Lines widths={index === 0 ? [82, 62] : [92, 70]} />
            {index === 0 ? <ChosenRing /> : null}
          </span>
        ))}
        <span className="pl-option pl-why">
          <Text size={17} hand>{art.why}</Text>
          <Lines widths={[96, 78]} />
        </span>
      </Note>

      {art.clips.map((label, index) => {
        const clip = clips[index]
        return (
          <Note key={label} x={clip.x} y={clip.y} w={clip.w} h={56} r={clip.r} tone="sand" cut={index === 1 ? 'c' : 'b'} className="pl-clip" outside={<Glyph name="clip" size={34} className="pl-clip-pin" />}>
            <Glyph name={clip.glyph} size={20} />
            <Text size={19} hand>{label}</Text>
          </Note>
        )
      })}

      <Layer front>
        <StarStamp cx={98} cy={384} r={42} seed={44} />
      </Layer>
    </Stage>
  )
}
