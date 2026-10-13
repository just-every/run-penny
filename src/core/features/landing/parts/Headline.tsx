import { CopperStroke } from '@/core/ui/brand/collage/Stroke'

/**
 * A headline whose key phrase carries Penny's copper hand-drawn stroke. The stroke is decoration under real text; the
 * phrase must occur in the title, and a mismatch fails the render instead of silently dropping the stroke.
 */
export function Headline({ title, keyPhrase }: { title: string; keyPhrase: string }) {
  const at = title.lastIndexOf(keyPhrase)
  if (at < 0) throw new Error(`Headline key phrase "${keyPhrase}" is not in "${title}".`)
  return (
    <>
      {title.slice(0, at)}
      <span className="pl-key">
        {keyPhrase}
        <CopperStroke />
      </span>
      {title.slice(at + keyPhrase.length)}
    </>
  )
}
