import { useEffect, useState, type ReactNode } from 'react'

/**
 * A disclosure that opens when its list is empty, so the create form is already there, and then belongs to the owner:
 * it stays as they leave it once the first record exists, with its saved notice still in view.
 */
export function FoldOpenWhenEmpty({ empty, summary, className, children }: { readonly empty: boolean; readonly summary: ReactNode; readonly className: string; readonly children: ReactNode }) {
  const [open, setOpen] = useState(empty)
  useEffect(() => { if (empty) setOpen(true) }, [empty])
  return <details className={className} open={open} onToggle={event => setOpen(event.currentTarget.open)}>{summary}{children}</details>
}
