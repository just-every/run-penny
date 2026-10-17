// The words and destinations of Penny's public site chrome (the header and footer the landing and the docs share). The
// first three links are this deployment's own pages; the source and the credit are outbound navigation only: the pages
// load nothing from them.
export const site = {
  brand: 'Penny',
  nav: { label: 'Main navigation', docs: 'Docs', contract: 'Contract', portal: 'Public board', source: 'Source', signIn: 'Sign in' },
  footer: { label: 'Footer navigation', credit: 'Powered by Penny · ', creditLink: 'runeditrun.com' },
} as const

export const siteLinks = {
  docs: '/docs',
  contract: '/contract',
  portal: '/portal',
  signIn: '/signin',
  source: 'https://github.com/just-every/run-penny',
  credit: 'https://runeditrun.com',
} as const
