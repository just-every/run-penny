import { Burst } from '@/core/ui/brand/collage/Ink'
import { Note, Text } from '@/core/ui/brand/collage/Note'
import { Signed } from '@/core/ui/brand/collage/Signed'
import { Layer, Stage } from '@/core/ui/brand/collage/Stage'
import { TornCircle, TornRect } from '@/core/ui/brand/collage/Torn'
import { copy } from '../copy'

const art = copy.art.yours

/** A kraft parcel with crisp grained faces, tied with two crossing strings and a bow. */
function Parcel() {
  return (
    <g className="pl-parcel">
      <path d="M92 214 290 210 334 166 140 168Z" fill="#ead0a6" filter="url(#pl-kraft)" />
      <path d="M290 210 334 166 336 304 292 352Z" fill="#c69a68" filter="url(#pl-kraft)" />
      <path d="M92 214 290 210 292 352 94 356Z" fill="#dbb88b" filter="url(#pl-kraft)" />
      <path className="pl-parcel-edge" d="M92 214 290 210 334 166 140 168ZM290 210 292 352M334 166 336 304 292 352 94 356 92 214" />
      <path className="pl-string" d="M190 212 192 354M191 211 237 167M116 191 312 188 314 329" />
      <path className="pl-string" d="M214 189C196 168 172 170 178 184 184 196 204 194 214 189 232 166 258 170 252 184 246 197 224 194 214 189M214 189 203 214M214 189 231 211" />
      <path className="pl-string pl-string--thin" d="M214 189C236 198 250 220 262 244" />
    </g>
  )
}

/** Ownership: the source parcelled up to keep, and the three commands that run it on your own account. */
export function YoursArt() {
  return (
    <Stage label={art.label} width={640} height={400} className="pl-yours-drawing">
      <Layer>
        <TornCircle cx={198} cy={232} r={160} tone="sand" seed={71} rough={2.4} />
        <TornRect x={350} y={16} w={250} h={112} tone="copper" seed={72} rotate={5} />
        <TornCircle cx={560} cy={418} r={84} from={180} to={360} tone="charcoal" seed={73} />
        <Parcel />
        <Burst x={96} y={170} angle={-140} spread={30} gap={16} length={18} />
        <Burst x={596} y={244} angle={10} spread={28} gap={14} length={15} />
      </Layer>

      <Note x={248} y={238} w={74} h={44} r={16} tone="cream" cut="c" className="pl-tag">
        <Text size={19} hand>{art.tag}</Text>
      </Note>

      <Note x={352} y={52} w={268} h={172} r={3} tone="charcoal" className="pl-terminal">
        <span className="pl-dots"><i /><i /><i /></span>
        {art.commands.map((command) => (
          <span key={command} className="pl-command"><Text size={17} hand className="pl-prompt">{art.prompt}</Text><Text size={17} hand>{command}</Text></span>
        ))}
      </Note>

      <Note x={372} y={264} w={184} h={64} r={-4} tone="sand" cut="b" className="pl-yours-note">
        <Text size={19} hand><Signed lines={art.note} /></Text>
      </Note>
    </Stage>
  )
}
