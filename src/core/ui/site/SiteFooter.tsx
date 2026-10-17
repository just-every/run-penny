import { HydrationUnit } from '@/base/hydration/unit'
import { useSiteVariant } from './SiteVariant'
import { publicLandingConfig } from '@/core/app/extension-config'
import { CoinMark } from '../brand/CoinMark'
import { site, siteLinks } from './site'
import { SiteLink } from './SiteLink'

const { nav, footer } = site

/**
 * The footer: the coin and the name back to the top, the same destinations as the header and the credit. The credit is the
 * buyer's to switch off (`showPoweredByCredit` in src/ext/config.ts); it is a plain link.
 */
export function SiteFooter() {
  const variant = useSiteVariant()
  return (
    <HydrationUnit><footer className="pl-footer">
      <a className="pl-brand pl-brand--footer" href="#top">
        <CoinMark />
        <span className="pl-brand-name">{site.brand}</span>
      </a>
      <nav className="pl-footer-nav" aria-label={footer.label}>
        <SiteLink href={siteLinks.docs}>{nav.docs}</SiteLink>
        {variant === 'site' ? <a href={siteLinks.contract}>{nav.contract}</a> : null}
        {variant === 'instance' ? <SiteLink href={siteLinks.portal}>{nav.portal}</SiteLink> : null}
        <a href={siteLinks.source}>{nav.source}</a>
        {variant === 'instance' ? <SiteLink href={siteLinks.signIn}>{nav.signIn}</SiteLink> : null}
      </nav>
      {publicLandingConfig.showPoweredByCredit
        ? <p className="pl-credit">{footer.credit}<a href={siteLinks.credit}>{footer.creditLink}</a></p>
        : null}
    </footer></HydrationUnit>
  )
}
