// Line icons for the sections' points, on a 24-unit grid, all pure line at one weight. Rect-based shapes share a 1.5 corner
// radius, and each icon's ink is centred on the grid's centre so it sits still inside its sand circle.

/**
 * The envelope, drawn once for every surface (the point icon and the glyphs in the paper notes). The frame is centred on
 * the grid; the flap's legs start on the midpoint of each rounded top corner, so with round caps they leave the corner
 * itself, and the fold meets just above the frame's middle.
 */
export const envelope = {
  frame: 'M5 5.75h14a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-9.5A1.5 1.5 0 0 1 5 5.75Z',
  flap: 'M3.94 6.19 12 11.9l8.06-5.71',
}

/** The padlock, likewise shared by the point icon and the private card's badge. */
export const padlock = 'M7 9.2h10a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 7 9.2ZM8.5 9.2V6.7a3.5 3.5 0 0 1 7 0v2.5M12 12.9v2.6'

export const iconPaths = {
  duplicate: 'M9 8.5h9.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19.5V10A1.5 1.5 0 0 1 9 8.5ZM16.5 8.5v-3A1.5 1.5 0 0 0 15 4H5.5A1.5 1.5 0 0 0 4 5.5V15a1.5 1.5 0 0 0 1.5 1.5h2',
  shield: 'M12 3.2 19 6v5.3c0 4.4-2.9 7.8-7 9.5-4.1-1.7-7-5.1-7-9.5V6ZM9.2 11.9l2 2 3.8-3.9',
  statuses: 'M8 4.5h2a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 10 9.5H8A1.5 1.5 0 0 1 6.5 8V6A1.5 1.5 0 0 1 8 4.5ZM8 14.5h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 18v-2A1.5 1.5 0 0 1 8 14.5ZM14.8 7h5.7M14.8 17h5.7',
  quote: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.8v-3.8H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5ZM10.6 9.1v1.9c0 .9-.4 1.6-1.3 2M14.6 9.1v1.9c0 .9-.4 1.6-1.3 2',
  columns: 'M6.3 5h3a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 6.3 5ZM14.7 5h3a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 14.7 5ZM7.1 9h1.4M15.5 9h1.4',
  flag: 'M7.4 21.2V5.4M7.4 6.1h11.5l-2.3 4.2 2.3 4.3H7.4',
  megaphone: 'M4 9.5v4h3l8 4.5V5L7 9.5ZM7.5 13.5 9 18.5h2.2M16.6 9.6a2.5 2.5 0 0 1 0 3.8M17.9 8.1a4.5 4.5 0 0 1 0 6.8',
  note: 'M7.5 3h7l3.5 3.5v13a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3ZM14.5 3v3.5H18M9 11.5h6M9 15h6M9 18h4',
  mail: `${envelope.frame}${envelope.flap}`,
  approve: 'M6 6h12a1.5 1.5 0 0 1 1.5 1.5v7.4a1.5 1.5 0 0 1-1.5 1.5h-5.8l-4.4 3.9v-3.9H6a1.5 1.5 0 0 1-1.5-1.5V7.5A1.5 1.5 0 0 1 6 6ZM8.8 11.3l2.2 2.2 4.4-4.4',
  lock: padlock,
  eyeOff: 'M3.5 3.5l17 17M10.4 6.1A9 9 0 0 1 12 6c5 0 8.4 4.4 9 6-.3.9-1.3 2.4-2.8 3.7M6.4 7.7C4.6 9 3.4 10.8 3 12c.6 1.6 4 6 9 6 1.6 0 3-.4 4.3-1.1M10 10a3 3 0 0 0 4 4',
  worker: 'M5.75 17.5h11.42a4.48 4.48 0 0 0 .45-8.96 6.72 6.72 0 0 0-12.77 1.57A3.81 3.81 0 0 0 5.75 17.5Z',
  export: 'M12 2.4v10M8 8.4l4 4 4-4M5 14.2v2a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-2',
  noSignal: 'M3.5 3.5l17 17M8.6 14.8a5 5 0 0 1 6.8 0M5.1 11.4a10 10 0 0 1 13.8 0M12 18.4h.01',
} as const

export type IconName = keyof typeof iconPaths
