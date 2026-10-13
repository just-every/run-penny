import type { ReactNode } from 'react'
import { EmptyArt } from './collage/EmptyArt'

const panelClass = 'min-w-0 rounded-xl border border-dashed border-penny-line-strong/60 bg-penny-card/60 px-5'

/**
 * An empty state: the drawn taped note (with the list's handwritten `note`), a heading and what to do next. From sm up it
 * sits in a dashed paper panel; on a phone the art and words stand centred on the page. `small` is for an empty section
 * beside others, such as the overview's releases.
 */
export function EmptyState({ title, note = 'Nothing here yet.', small = false, children }: { readonly title: string; readonly note?: string; readonly small?: boolean; readonly children: ReactNode }) {
  return (
    <div className={`min-w-0 py-6 text-center sm:rounded-xl sm:border sm:border-dashed sm:border-penny-line-strong/60 sm:bg-penny-card/60 sm:px-5 ${small ? 'sm:py-6' : 'sm:py-10'}`}>
      <EmptyArt note={note} className={`mx-auto max-w-full ${small ? 'w-[200px]' : 'w-[280px] sm:w-[360px]'}`} />
      <h2 className={`mt-3 font-extrabold text-penny-ink ${small ? 'text-lg' : 'text-2xl tracking-[-0.01em] sm:text-[28px]'}`}>{title}</h2>
      <div className={`mx-auto mt-2 max-w-2xl text-penny-muted ${small ? 'text-base leading-6' : 'text-base leading-normal sm:text-lg'}`}>{children}</div>
    </div>
  )
}

/** A one-line empty note inside a section that already has its heading: the dashed panel, no art. */
export function EmptyNote({ children }: { readonly children: ReactNode }) {
  return <p className={`${panelClass} py-6 text-sm leading-6 text-penny-muted`}>{children}</p>
}
