// Class strings the feedback operator forms (moderation, request controls, settings) share. Inputs, labels and buttons come
// from src/core/ui/app/classes.ts; these cover the pieces that file leaves to the page.

/** A checkbox row: a 44px target with the box on the left. */
export const checkRowClass = 'flex min-h-11 items-center gap-3 text-sm font-semibold text-penny-ink'

/** The checkbox itself, ink-coloured so it reads on paper. */
export const checkboxClass = 'size-5 shrink-0 accent-penny-ink'

/** A text-styled button for a quiet action beside a primary one (Delete, Unmerge, Reject). */
export const quietButtonClass = 'inline-flex min-h-11 items-center px-1 text-sm font-semibold text-penny-ink underline decoration-penny-ink/40 underline-offset-4 hover:decoration-penny-copper focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent disabled:opacity-55'

/** A group of controls under a fine rule inside a card. */
export const subformClass = 'border-t border-penny-line pt-5'
