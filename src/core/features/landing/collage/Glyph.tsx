import type { CSSProperties } from 'react'
import { envelope, padlock } from '../icons/iconPaths'

// Small marks drawn inside paper notes: status dots, the vote arrow, envelopes and the sources of evidence. Each is sized in
// stage units by `size` (collage.css keeps it legible at small widths) and coloured by the note's ink.
const glyphs = {
  done: <><circle cx="12" cy="12" r="11" fill="#c85d2f" /><path d="m7 12.4 3.3 3.2L17.2 8.6" fill="none" stroke="#fff8ec" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  doneGrey: <><circle cx="12" cy="12" r="10" fill="#c9c3b8" /><path d="m7.6 12.3 3 2.9 5.8-6" fill="none" stroke="#fbf8f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></>,
  // Filled with the note's paper so the status line behind it stops at the ring instead of showing through.
  ring: <circle cx="12" cy="12" r="9.5" fill="#f8f5ee" stroke="#b7b1a6" strokeWidth="2.2" />,
  half: <><circle cx="12" cy="12" r="9.5" fill="#ece8e0" stroke="#a9a397" strokeWidth="2.2" /><circle cx="12" cy="12" r="5" fill="#a9a397" /></>,
  review: <circle cx="12" cy="12" r="9.5" fill="none" stroke="#a9a397" strokeWidth="2.2" strokeDasharray="3.2 2.6" />,
  vote: <path d="M12 3.5 21.5 19h-19Z" fill="#c85d2f" stroke="#c85d2f" strokeWidth="1.5" strokeLinejoin="round" />,
  comment: <path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  envelope: <><path d={envelope.frame} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d={envelope.flap} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>,
  lock: <path d={padlock} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  phone: <path d="M7.5 3.5h2.8l1.4 4.2-2 1.4a10 10 0 0 0 5.2 5.2l1.4-2 4.2 1.4v2.8a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5.5 5.7a2 2 0 0 1 2-2.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  chat: <><path d="M4 5h11v8H9l-3 2.6V13H4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M17 9h3v8h-2v2.4L15.4 17H10v-2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></>,
  clip: <path d="M15.5 6.5 8.4 13.6a2.4 2.4 0 0 0 3.4 3.4l7.5-7.5a4.2 4.2 0 0 0-6-6L5.6 11.2a6 6 0 0 0 8.5 8.5l6-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
  tick: <path d="m5 12.5 4.6 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  arrow: <path d="M4.5 12h14M13.5 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
} as const

export type GlyphName = keyof typeof glyphs

export function Glyph({ name, size, className = '' }: { name: GlyphName; size: number; className?: string }) {
  return (
    <svg className={`pl-glyph ${className}`.trim()} viewBox="0 0 24 24" style={{ '--gs': size } as CSSProperties} focusable="false">
      {glyphs[name]}
    </svg>
  )
}
