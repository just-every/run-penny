// Penny's small marks: the copper penny alone, inked, with its ink shadow offset down and to the right, hinted for the pixel grid.
// Each drawing is written as its .svg file spells it, with no ids (they are drawn inline many times and as the favicon) and with the
// coin centred in its grid and filling it (coin.css narrows a lockup's box to match): coin16 on a 16-unit grid for the 16px favicon, coin32
// on a 32-unit grid for the header, footer, portal, sign-in, 404 and operator marks and the 32px favicon. The landing drawings'
// coins use the full drawing in coinFull.ts instead (one <symbol> per page). A redrawn small mark replaces its list here and nothing else.
export type SvgElement = { tag: string; attrs: Readonly<Record<string, string | number>>; children?: readonly SvgElement[] }
export type SvgArt = { size: number; elements: readonly SvgElement[] }

export const coin16: SvgArt = { size: 16, elements: [
  { tag: 'path', attrs: { d: 'M5 3h4v1h-4zM10 3h2v1h-2zM4 4h2v1h-2zM8 4h2v1h-2zM11 4h1v1h-1zM3 5h2v1h-2zM6 5h5v1h-5zM12 5h1v1h-1zM3 6h1v1h-1zM5 6h6v1h-6zM12 6h1v1h-1zM3 7h1v1h-1zM5 7h6v1h-6zM12 7h1v1h-1zM3 8h8v1h-8zM12 8h1v1h-1zM4 9h6v1h-6zM11 9h1v1h-1zM3 10h1v1h-1zM5 10h4v1h-4zM10 10h2v1h-2zM3 11h2v1h-2zM9 11h2v1h-2zM5 12h4v1h-4z', fill: '#c4572a' } },
  { tag: 'path', attrs: { d: 'M5 2h4v1h-4zM4 3h1v1h-1zM9 3h1v1h-1zM3 4h1v1h-1zM10 4h1v1h-1zM2 5h1v1h-1zM11 5h1v1h-1zM2 6h1v1h-1zM11 6h1v1h-1zM2 7h1v1h-1zM11 7h1v1h-1zM2 8h1v1h-1zM11 8h1v1h-1zM3 9h1v1h-1zM10 9h1v1h-1zM4 10h1v1h-1zM9 10h1v1h-1zM5 11h4v1h-4z', fill: '#8a3512' } },
  { tag: 'path', attrs: { d: 'M5 1h4v1h-4zM3 2h2v1h-2zM9 2h2v1h-2zM2 3h2v1h-2zM2 4h1v1h-1zM1 5h1v1h-1zM1 6h1v1h-1zM1 7h1v1h-1zM1 8h1v1h-1zM2 9h1v1h-1zM2 10h1v1h-1z', fill: '#e68a5a' } },
  { tag: 'path', attrs: { d: 'M6 4h2v1h-2zM5 5h1v1h-1zM4 6h1v1h-1zM4 7h1v1h-1z', fill: '#fbe3cc' } },
  { tag: 'path', attrs: { d: 'M5 0h4v1h-4zM3 1h2v1h-2zM9 1h2v1h-2zM2 2h1v1h-1zM11 2h1v1h-1zM1 3h1v1h-1zM12 3h1v1h-1zM1 4h1v1h-1zM12 4h2v1h-2zM0 5h1v1h-1zM13 5h1v1h-1zM0 6h1v1h-1zM13 6h2v1h-2zM0 7h1v1h-1zM13 7h2v1h-2zM0 8h1v1h-1zM13 8h2v1h-2zM1 9h1v1h-1zM12 9h3v1h-3zM1 10h1v1h-1zM12 10h2v1h-2zM2 11h1v1h-1zM11 11h3v1h-3zM3 12h2v1h-2zM9 12h4v1h-4zM4 13h8v1h-8zM6 14h4v1h-4z', fill: '#1f1d1a' } },
] }

export const coin32: SvgArt = { size: 32, elements: [
  { tag: 'circle', attrs: { cx: 16.36, cy: 16.84, r: 14.28, fill: '#1f1d1a' } },
  { tag: 'circle', attrs: { cx: 15.64, cy: 15.16, r: 14.28, fill: '#1f1d1a' } },
  { tag: 'circle', attrs: { cx: 16.36, cy: 16.84, r: 12.48, fill: '#8a3512' } },
  { tag: 'circle', attrs: { cx: 15.64, cy: 15.16, r: 12.48, fill: '#d76a3c' } },
  { tag: 'path', attrs: { d: 'M5.92 20.78A11.22 11.22 0 0 1 19.48 4.61', fill: 'none', stroke: '#ee9a6a', 'stroke-width': 1.56, 'stroke-linecap': 'round' } },
  { tag: 'circle', attrs: { cx: 15.64, cy: 15.16, r: 9.84, fill: '#c4572a' } },
  { tag: 'circle', attrs: { cx: 15.64, cy: 15.16, r: 9.84, fill: 'none', stroke: '#8a3512', 'stroke-width': 1.32 } },
  { tag: 'path', attrs: { d: 'M9.73 13.78L14.26 9.26', stroke: '#fbe3cc', 'stroke-width': 1.8, 'stroke-linecap': 'round' } },
  { tag: 'path', attrs: { d: 'M11.51 16.73L17.21 11.03', stroke: '#fbe3cc', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: '.8' } },
] }
