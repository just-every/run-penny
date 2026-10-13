import { siteLinks } from '@/core/ui/site/site'

// Where the landing page's links go: the site chrome's destinations, and the install guide its two calls to action open.
export const links = {
  ...siteLinks,
  install: '/docs/install',
} as const
