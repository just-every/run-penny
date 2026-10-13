// Penny declares its own fonts here; Base's default (Outfit) does not apply. The root renderer links
// fontLinks, and the no-JavaScript first-run document (/setup) links fontHead; its look is public/rer-theme.css.
export const fontLinks = [
  { rel: 'preload', href: '/fonts/inter-tight/inter-tight-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
