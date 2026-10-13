// Penny declares its own fonts here; Base's default (Outfit) does not apply. The root renderer links
// fontLinks, and the no-JavaScript first-run document (/setup) links fontHead; its look is public/rer-theme.css.
export const fontLinks = [
  { rel: 'preload', href: '/fonts/inter-tight/inter-tight-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')

/** Adapt Base's font preload in its no-JavaScript documents, without modifying the shared runtime. */
export function pennyDocumentFonts(response: Response): Response {
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  return new HTMLRewriter().on('link[rel="preload"][as="font"]', {
    element(link) { link.setAttribute('href', fontLinks[0].href) },
  }).transform(response)
}
