import type { ReactNode } from 'react'

/** A section's heading (28px, 24px on a phone) and its one-line description. */
export function SectionHeading({ id, title, children }: { readonly id: string; readonly title: string; readonly children?: ReactNode }) {
  return <div className="min-w-0"><h2 id={id} className="text-2xl leading-[1.15] font-extrabold tracking-[-0.01em] text-penny-ink sm:text-[28px]">{title}</h2>{children ? <div className="mt-1.5 max-w-4xl text-[15px] leading-normal text-penny-muted sm:text-base">{children}</div> : null}</div>
}
