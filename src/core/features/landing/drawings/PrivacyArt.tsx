import { Glyph } from '../collage/Glyph'
import { Burst } from '@/core/ui/brand/collage/Ink'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { Lines, Note, Text } from '@/core/ui/brand/collage/Note'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { copy } from '../copy'

const art = copy.art.privacy

/** The private card: the commercial context Penny keeps behind the lock, and the note that it stays with you. */
export function PrivacyArt() {
  return (
    <Stage label={art.label} width={560} height={330} className="pl-privacy-drawing">
      <Layer>
        <TornRect x={34} y={6} w={232} h={182} tone="copper" seed={61} rotate={-3} />
        <TornCircle cx={364} cy={84} r={80} tone="charcoal" seed={62} />
        <TornCircle cx={444} cy={94} r={62} tone="sand" seed={63} />
        <TornCircle cx={172} cy={262} r={60} tone="sand" seed={64} />
        <Burst x={456} y={64} angle={-38} spread={30} gap={20} length={17} />
        <Burst x={74} y={226} angle={160} spread={30} gap={26} length={16} />
      </Layer>

      {/* The copper seal is pressed over the card's lower-left corner, so it follows the corner however tall the card grows. */}
      <Note x={88} y={36} w={290} h={250} r={-2} className="pl-vault" outside={<svg className="pl-vault-seal" viewBox="0 0 40 40" focusable="false"><StarStamp cx={20} cy={20} r={14} seed={65} /></svg>}>
        <span className="pl-badge"><Glyph name="lock" size={30} /></span>
        <span className="pl-fields">
          {art.fields.map((field) => (
            <span key={field} className="pl-field"><Text size={14}>{field}</Text><Lines widths={[88, 58]} /></span>
          ))}
        </span>
      </Note>

      <Note x={350} y={138} w={190} h={104} r={-3} tone="sand" cut="b" className="pl-privacy-note">
        <Text size={18} hand><Signed lines={art.note} /></Text>
      </Note>
    </Stage>
  )
}
