import { CoinMark } from '@/core/ui/brand/CoinMark'
import { Glyph, type GlyphName } from '../collage/Glyph'
import { Arrow, Burst } from '@/core/ui/brand/collage/Ink'
import { Lines, Note, NoteStack, Place, Text } from '@/core/ui/brand/collage/Note'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { copy } from '../copy'

const art = copy.art.board
// The portal's own status vocabulary, each with the dot the drawing gives it.
const statusGlyph: Record<string, GlyphName> = { 'In progress': 'half', Planned: 'ring', 'Under review': 'review' }

/**
 * The public board drawn on paper: requests by votes with real statuses, an approved comment and a "+1" reply. The card is
 * as tall as its rows, and the reply is stacked under it so it stays against the card's bottom edge at every width.
 */
export function BoardArt() {
  return (
    <Stage label={art.label} width={840} height={640} className="pl-board-drawing">
      <Layer>
        <TornRect x={58} y={26} w={312} h={236} tone="copper" seed={31} rotate={-1.5} />
        <TornCircle cx={142} cy={428} r={132} tone="sand" seed={32} />
        <TornCircle cx={690} cy={330} r={118} tone="charcoal" seed={33} />
        <TornRect x={532} y={6} w={222} h={104} tone="sand" seed={34} rotate={4} />
        <Arrow d="M530 34C502 30 478 44 472 74" hx={472} hy={74} angle={100} />
        <Burst x={88} y={160} angle={180} spread={30} gap={40} length={22} />
        <Burst x={790} y={120} angle={-20} spread={26} gap={26} length={16} />
        <Burst x={348} y={514} angle={140} spread={30} gap={16} length={16} />
      </Layer>

      <NoteStack x={95} y={96}>
        <Note x={0} y={0} w={615} h={340} r={-0.6} className="pl-board">
          <span className="pl-board-head">
            <CoinMark className="pl-coin-dot" tier="full" />
            <Text size={20} className="pl-strong">{art.title}</Text>
            <span className="pl-button"><Glyph name="plus" size={13} /><Text size={14}>{art.submit}</Text></span>
          </span>
          <span className="pl-tabs">
            {art.sort.map((label, index) => <Text key={label} size={14} className={index === 0 ? 'pl-tab pl-tab--on' : 'pl-tab'}>{label}</Text>)}
          </span>
          {art.rows.map((row) => (
            <span key={row.title} className="pl-board-row">
              <span className="pl-vote"><Glyph name="vote" size={22} /><Text size={16} className="pl-strong">{row.votes}</Text></span>
              <span className="pl-board-text"><Text size={18} className="pl-strong">{row.title}</Text><Lines widths={[94, 70]} /></span>
              <span className="pl-chip"><Glyph name={statusGlyph[row.status]} size={16} /><Text size={13}>{row.status}</Text></span>
              <span className="pl-count"><Glyph name="comment" size={20} /><Text size={14}>{row.comments}</Text></span>
            </span>
          ))}
        </Note>
        <Note x={245} y={16} w={290} h={64} r={-2} tone="sand" cut="b" className="pl-board-reply">
          <Text size={19} hand>{art.reply}</Text>
        </Note>
      </NoteStack>

      <Note x={560} y={4} w={200} h={88} r={7} className="pl-board-quote">
        <Text size={19} hand>{art.quote}</Text>
      </Note>

      <Layer front>
        <TornCircle cx={752} cy={136} r={40} tone="copper" seed={35} />
        <path className="pl-token-arrow" d="M752 121.5 766.5 148H737.5Z" />
      </Layer>
      <Place x={450} y={74} r={-10} className="pl-approved"><Glyph name="tick" size={16} /><Text size={15}>{art.stamp}</Text></Place>
    </Stage>
  )
}
