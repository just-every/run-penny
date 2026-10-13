import type { CSSProperties, ReactNode } from 'react'

type NoteProps = {
  /** Position and size in stage units; `r` is the note's rotation in degrees. `w` × `h` is the least size: on a narrow stage the paper grows to hold text kept at its readable minimum. */
  x: number
  y: number
  w: number
  h: number
  r?: number
  tone?: 'card' | 'cream' | 'sand' | 'charcoal'
  /** Which hand-cut outline the paper takes. */
  cut?: 'a' | 'b' | 'c'
  /** The note's place in the one-shot settling motion (hero only); notes without it never move. */
  settle?: number
  className?: string
  /** Marks that sit on the note but outside its cut paper, such as a paper clip over the edge. */
  outside?: ReactNode
  children?: ReactNode
}

/** A slightly rotated paper note with a soft shadow and grain, holding real text. */
export function Note({ x, y, w, h, r = 0, tone = 'card', cut = 'a', settle, className = '', outside, children }: NoteProps) {
  const style = { '--x': x, '--y': y, '--w': w, '--h': h, '--r': r, ...(settle === undefined ? {} : { '--d': settle }) } as CSSProperties
  const classes = ['pl-note', `pl-note--${tone}`, settle === undefined ? '' : 'pl-settle', className].filter(Boolean).join(' ')
  return (
    <div className={classes} style={style}>
      <div className={`pl-paper pl-cut-${cut}`}>{children}</div>
      {outside}
    </div>
  )
}

/**
 * Notes stacked one under another from (x, y) in stage units, so a later note keeps its place against an earlier note's
 * bottom edge however tall that note's text makes it on a narrow stage. Inside a stack each note's `x` and `y` offset it
 * from where the stack would put it.
 */
export function NoteStack({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const style = { '--x': x, '--y': y } as CSSProperties
  return <div className="pl-stack" style={style}>{children}</div>
}

/** Unpapered marks placed in stage units, such as a rubber stamp. */
export function Place({ x, y, r = 0, className = '', children }: { x: number; y: number; r?: number; className?: string; children: ReactNode }) {
  const style = { '--x': x, '--y': y, '--r': r } as CSSProperties
  return <span className={`pl-place ${className}`.trim()} style={style}>{children}</span>
}

type TextProps = {
  /** Size in stage units; the rendered size never falls below the readable minimum set in collage.css. */
  size: number
  hand?: boolean
  className?: string
  children: ReactNode
}

/** Text drawn inside a collage: the handwriting face for notes, or the page's sans for interface labels. */
export function Text({ size, hand = false, className = '', children }: TextProps) {
  const style = { '--fs': size } as CSSProperties
  return <span className={`pl-t${hand ? ' pl-t--hand' : ''} ${className}`.trim()} style={style}>{children}</span>
}

/** Grey pencil strokes standing in for lines of text; each width is a percentage of the line's box. */
export function Lines({ widths, className = '' }: { widths: readonly number[]; className?: string }) {
  return (
    <span className={`pl-lines ${className}`.trim()}>
      {widths.map((width, index) => <i key={index} style={{ '--lw': `${width}%` } as CSSProperties} />)}
    </span>
  )
}
