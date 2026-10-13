// The favicon: the hinted small marks as `data:` URLs for `<link rel="icon">`, so the browser tab shows the same mark as
// the page and nothing is fetched for it. The 32-unit drawing serves a 32px tab icon (a 2x display), and the 16-unit
// drawing, listed last for browsers that take the last icon, the 16px one.
import { coin16, coin32, type SvgArt, type SvgElement } from './coinSmall'

const markup = (elements: readonly SvgElement[]): string =>
  elements
    .map(({ tag, attrs, children }) => {
      const attributes = Object.entries(attrs).map(([name, value]) => ` ${name}="${value}"`).join('')
      return children ? `<${tag}${attributes}>${markup(children)}</${tag}>` : `<${tag}${attributes}/>`
    })
    .join('')

const href = ({ size, elements }: SvgArt) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${markup(elements)}</svg>`)}`

export const coinFaviconLinks = [coin32, coin16].map((art) => ({ rel: 'icon', type: 'image/svg+xml', sizes: `${art.size}x${art.size}`, href: href(art) }))
