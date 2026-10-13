import { copy } from '../copy'
import { ClosingArt } from '../drawings/ClosingArt'
import { links } from '../links'
import { Headline } from '../parts/Headline'
import { SiteLink } from '@/core/ui/site/SiteLink'

const { closing } = copy

/** The closing band: the promise once more, the same two actions and the paper plane coming in to land. */
export function Closing() {
  return (
    <section className="pl-closing" id="start" aria-labelledby="start-title">
      <ClosingArt />
      <h2 id="start-title" className="pl-h2 pl-closing-title"><Headline title={closing.title} keyPhrase={closing.key} /></h2>
      <div className="pl-actions pl-actions--center">
        <SiteLink className="pl-pill pl-pill--large" href={links.install}>{closing.primary}</SiteLink>
        <SiteLink className="pl-text-link" href={links.docs}>{closing.secondary}</SiteLink>
      </div>
    </section>
  )
}
