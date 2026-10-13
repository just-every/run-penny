import type { EditionIdentity } from './base/identity'
import { publicLandingConfig } from './core/app/extension-config'
import { copy } from './core/features/landing/copy'

export const identity: EditionIdentity = {
  product: 'Penny',
  deployment: publicLandingConfig.ownerName,
  purpose: '{deployment}’s customer feedback, roadmap and updates.',
  tagline: copy.hero.sub,
  signInPath: '/signin',
  runSite: 'https://run-penny.com',
  installedHome: 'page',
  theme: '/rer-theme.css',
  mark: '/brand/penny-mark.svg',
  band: '/brand/band.svg',
}
