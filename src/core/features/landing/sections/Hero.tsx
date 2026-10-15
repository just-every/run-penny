import { useSiteVariant } from '@/core/ui/site/SiteVariant'
import { copy } from '../copy'
import { HeroArt } from '../drawings/hero/HeroArt'
import { links } from '../links'
import { Headline } from '../parts/Headline'
import { SiteLink } from '@/core/ui/site/SiteLink'

const { hero } = copy

/** "Canny, UserVoice and Productboard": the replaced products in the page's bold, the commas and "and" in normal weight. */
function AlternativeLine({ lead, names }: { lead: string; names: readonly string[] }) {
  return (
    <>
      {lead}{' '}
      {names.map((name, index) => (
        <span key={name}>
          {index === 0 ? '' : index === names.length - 1 ? ' and ' : ', '}
          <strong className="pl-strong">{name}</strong>
        </span>
      ))}
    </>
  )
}

/** The first viewport: the page's one h1, the promise in one line, the two actions and the request's journey. */
export function Hero() {
  const site = useSiteVariant() === 'site'
  return (
    <section className="pl-hero" id="top" aria-labelledby="hero-title">
      <div className="pl-hero-copy">
        <h1 id="hero-title" className="pl-h1"><Headline title={hero.title} keyPhrase={hero.key} /></h1>
        <p className="pl-hero-sub">{hero.sub}</p>
        <p className="pl-hero-alt"><AlternativeLine lead={hero.alternative.lead} names={hero.alternative.names} /></p>
        <div className="pl-actions">
          <SiteLink className="pl-pill pl-pill--large" href={site ? '/run' : links.install}>{site ? 'Run Penny' : hero.primary}</SiteLink>
          {site && <a className="pl-pill pl-pill--large" href="https://demo.run-penny.com/">Try the demo</a>}
          <SiteLink className="pl-text-link" href={links.docs}>{hero.secondary}</SiteLink>
        </div>
      </div>
      <div className="pl-hero-art"><HeroArt /></div>
    </section>
  )
}
