import { CoinMark } from '@/core/ui/brand/CoinMark'
import { Glyph } from '../../collage/Glyph'
import { Arrow, Burst, Ink } from '@/core/ui/brand/collage/Ink'
import { Lines, Note, Text } from '@/core/ui/brand/collage/Note'
import { Plane } from '@/core/ui/brand/collage/Plane'
import { ScriptPaper } from '../../collage/Script'
import { Written } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { StarStamp } from '@/core/ui/brand/collage/Stamp'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { copy } from '../../copy'
import { Mountain } from '@/core/ui/brand/collage/Mountain'

const art = copy.art.hero
const stageGlyphs = ['ring', 'half', 'done'] as const

/** The hero collage: a request travels to Shipped and a "thanks for asking" letter flies back as a paper plane. */
export function HeroArt() {
  return (
    <Stage label={art.label} width={840} height={660} className="pl-hero-drawing">
      <Layer>
        <TornCircle cx={150} cy={172} r={150} tone="sand" seed={1} rough={2.4} />
        <TornCircle cx={240} cy={94} r={62} from={180} to={360} tone="copper" seed={2} />
        <TornRect x={452} y={34} w={262} h={214} tone="copper" seed={3} rotate={1.5} />
        <Mountain />
        <TornCircle cx={688} cy={402} r={118} tone="charcoal" seed={4} />
        <ScriptPaper x={386} y={444} w={448} h={180} seed={5} rotate={-1.5} />
        <StarStamp cx={752} cy={608} r={42} seed={6} />
        <Burst x={66} y={92} angle={-128} spread={30} gap={28} length={17} />
        <Arrow d="M306 130C330 111 362 103 397 112" hx={397} hy={112} angle={12} />
        <Burst x={690} y={152} angle={0} spread={22} gap={44} length={15} />
        <Burst x={800} y={316} angle={-35} spread={24} gap={18} length={16} />
        <Ink draw d="M408 497C386 527 340 548 300 545 268 543 238 530 236 508 234 486 262 482 263 501 264 523 236 532 204 525 178 518 156 470 134 460" />
        <Plane x={50} y={430} rotate={-4} className="pl-glide" />
      </Layer>

      <Note x={58} y={75} w={245} h={172} r={-2.5} settle={0} className="pl-hero-request">
        <span className="pl-row"><CoinMark className="pl-coin-dot" tier="full" /><Text size={21} hand>{art.request}</Text></span>
        <Lines widths={[88, 88, 64]} />
        <span className="pl-votes"><Glyph name="vote" size={24} /><Text size={19} hand>{art.votes}</Text></span>
      </Note>

      <Note x={425} y={77} w={240} h={208} r={1.5} settle={1} className="pl-hero-status">
        <ol className="pl-steps">
          {art.statuses.map((status, index) => (
            <li key={status}>
              <Glyph name={stageGlyphs[index]} size={index === 2 ? 38 : 27} />
              <Text size={index === 2 ? 22 : 18} hand>{status}</Text>
            </li>
          ))}
        </ol>
      </Note>

      <Note x={410} y={348} w={355} h={196} r={-2} settle={2} tone="cream" className="pl-hero-letter">
        <span className="pl-badge"><Glyph name="envelope" size={36} /></span>
        <span className="pl-letter-copy">
          <Text size={22} hand><Written lines={art.letter} /></Text>
          <Lines widths={[100, 92, 44]} />
        </span>
      </Note>
    </Stage>
  )
}
