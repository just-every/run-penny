import { CoinSprite } from '@/core/ui/brand/CoinSprite'
import { CollageFilters } from '@/core/ui/brand/collage/Filters'
import { SiteFooter } from '@/core/ui/site/SiteFooter'
import { SiteHeader } from '@/core/ui/site/SiteHeader'
import { copy } from './copy'
import { Board } from './sections/Board'
import { Closing } from './sections/Closing'
import { Evidence } from './sections/Evidence'
import { Hero } from './sections/Hero'
import { Loop } from './sections/Loop'
import { Privacy } from './sections/Privacy'
import { Yours } from './sections/Yours'
import './styles'

/**
 * HOME-002. Penny's public product landing at `/`: a static page about the product with links to the docs, the public
 * board under /portal, the source and sign-in. It reads no workspace data, loads only same-origin resources (its own CSS,
 * fonts and script) and sets no cookies. The server HTML is the finished page; motion is a one-shot extra.
 */
export function Landing() {
  return (
    <CoinSprite>
      <div className="penny-landing penny-brand penny-collage">
        <a className="pl-skip" href="#content">{copy.skip}</a>
        <CollageFilters />
        <SiteHeader home="#top" />
        <main id="content">
          <Hero />
          <Board />
          <Evidence />
          <Loop />
          <Privacy />
          <Yours />
          <Closing />
        </main>
        <SiteFooter />
      </div>
    </CoinSprite>
  )
}
