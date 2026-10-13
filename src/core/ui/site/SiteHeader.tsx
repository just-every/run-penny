import { CoinMark } from '../brand/CoinMark'
import { CopperStroke } from '../brand/collage/Stroke'
import { site, siteLinks } from './site'
import { SiteLink } from './SiteLink'

const { nav } = site

type SiteHeaderProps = {
  /** Where the coin and the name go: `/` from another page, `#top` on the landing itself. */
  home?: string
  /** The section the page belongs to, marked current with the copper stroke. */
  current?: 'docs'
}

/** The header: the coin and the name, then Docs, the public board, the source and the sign-in pill. */
export function SiteHeader({ home = '/', current }: SiteHeaderProps) {
  const docsCurrent = current === 'docs'
  return (
    <header className="pl-header">
      {home.startsWith('#')
        ? <a className="pl-brand" href={home}><CoinMark /><span className="pl-brand-name">{site.brand}</span></a>
        : <SiteLink className="pl-brand" href={home}><CoinMark /><span className="pl-brand-name">{site.brand}</span></SiteLink>}
      <nav className="pl-nav" aria-label={nav.label}>
        <SiteLink className="pl-nav-link" href={siteLinks.docs} current={docsCurrent}>
          {nav.docs}
          {docsCurrent ? <CopperStroke /> : null}
        </SiteLink>
        <SiteLink className="pl-nav-link" href={siteLinks.portal}>{nav.portal}</SiteLink>
        <a className="pl-nav-link pl-nav-link--source" href={siteLinks.source}>{nav.source}</a>
        <SiteLink className="pl-pill" href={siteLinks.signIn}>{nav.signIn}</SiteLink>
      </nav>
    </header>
  )
}
