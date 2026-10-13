import type { ReactNode } from 'react'
import type { IconName } from '../icons/Icon'
import { Headline } from './Headline'
import { Points } from './Points'

type SectionCopy = { eyebrow: string; title: string; key: string; body: string; points: readonly string[] }

type SectionProps = {
  id: string
  copy: SectionCopy
  icons: readonly [IconName, IconName, IconName]
  /** Which side the copy takes on a wide screen; the drawing takes the other. On a narrow screen copy always comes first. */
  copySide: 'left' | 'right'
  /** The section's drawing, already staged. */
  children: ReactNode
}

/** One feature section: copper eyebrow, headline with its stroke, a paragraph, three points, and the drawing beside it. */
export function Section({ id, copy, icons, copySide, children }: SectionProps) {
  if (copy.points.length !== icons.length) throw new Error(`Section "${id}" needs one icon per point.`)
  return (
    <section className={`pl-sec pl-sec--copy-${copySide}`} id={id} aria-labelledby={`${id}-title`}>
      <div className="pl-sec-copy">
        <p className="pl-eyebrow">{copy.eyebrow}</p>
        <h2 id={`${id}-title`} className="pl-h2"><Headline title={copy.title} keyPhrase={copy.key} /></h2>
        <p className="pl-sec-body">{copy.body}</p>
        <Points items={copy.points.map((text, index) => [icons[index], text] as const)} />
      </div>
      <div className="pl-sec-art">{children}</div>
    </section>
  )
}
