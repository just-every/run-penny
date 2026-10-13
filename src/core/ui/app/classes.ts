// The app's shared surface, control and text classes, used by the portal, the operator app and sign-in. They read the
// --color-penny-* tokens (src/index.css), which read the brand palette. Usability first: flat paper, fine lines, Inter
// Tight, copper only for accents and focus.

/** A paper card: a sheet a shade lighter than the page, a fine line border and a soft paper lift. */
export const paperCardClass = 'min-w-0 rounded-xl border border-penny-line bg-penny-card shadow-penny-card'

/** A light inset inside a card, for one of several forms or records the card holds (never a second card in a card). */
export const insetPanelClass = 'min-w-0 rounded-xl border border-penny-line bg-penny-paper/60'

const buttonBase = 'inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-8 py-2 text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent'

/** The primary action: a black pill. */
export const primaryButtonClass = `${buttonBase} bg-penny-ink text-penny-paper hover:bg-penny-soft`

/** A secondary action: an outlined ink pill. */
export const secondaryButtonClass = `${buttonBase} border-[1.5px] border-penny-ink text-penny-ink hover:bg-penny-ink/6`

/** A text link inside content: ink, underlined, the underline turning copper on hover. */
export const textLinkClass = 'font-semibold text-penny-ink underline decoration-penny-ink/40 underline-offset-4 transition-colors hover:decoration-penny-copper'

/** A link that carries the accent, for the one prompt a block leads to (for example, verify your email). */
export const accentLinkClass = 'font-semibold text-penny-accent underline decoration-penny-accent/45 underline-offset-4 transition-colors hover:text-penny-accent-dark hover:decoration-penny-accent-dark'

/** The small uppercase copper line above a page or section title. */
export const eyebrowClass = 'text-[13px] font-bold tracking-[0.14em] text-penny-accent uppercase sm:text-sm'

/** The intro paragraph under a page's title. */
export const ledeClass = 'mt-4 max-w-2xl text-[17px] leading-normal text-penny-soft sm:text-xl'

/** A readable small-caps label over a data value (CONFIDENCE, REVIEW DATE, VOTES). */
export const dataLabelClass = 'text-[11px] font-semibold tracking-[0.12em] text-penny-muted uppercase sm:text-xs'

/**
 * A text input, select, textarea or file input on paper: a fine ink line, copper when focused. Typed text is always normal
 * weight, whatever the label around it sets. Callers add the top margin. --field-inset is the text's inset from the side
 * border; a select's caret sits the same distance from the right border (src/index.css).
 */
export const inputClass = 'block min-h-12 w-full min-w-0 rounded-lg border border-penny-line-strong bg-penny-card [--field-inset:1rem] px-(--field-inset) py-2 font-normal text-penny-ink placeholder:text-penny-muted transition-colors focus-visible:border-penny-copper focus-visible:ring-3 focus-visible:ring-penny-copper/30 focus-visible:outline-none disabled:opacity-60'

/** The native file picker's button, for a file input that already carries inputClass. */
export const fileInputClass = 'file:mr-3 file:min-h-8 file:rounded-full file:border-0 file:bg-penny-sand file:px-3 file:text-sm file:font-semibold file:text-penny-ink'

/** A field label wrapping its control (or a fieldset legend). The control's own class supplies the gap above it. */
export const fieldLabelClass = 'block min-w-0 text-[15px] font-medium text-penny-ink'

/** The destructive action: a red pill, for the one step that cannot be undone. */
export const dangerButtonClass = `${buttonBase} bg-penny-danger text-white hover:bg-penny-danger/90`

/**
 * A <details> summary line: a chevron that points right when closed and down when open, in place of the browser marker. The
 * <details> needs the `group` class. It sets no type of its own, so a summary can be a heading or a quiet line.
 */
export const disclosureChevronClass = 'flex min-h-11 cursor-pointer list-none items-center gap-2 before:inline-block before:size-1.5 before:shrink-0 before:rotate-[-45deg] before:border-r-2 before:border-b-2 before:border-current before:transition-transform group-open:before:rotate-45 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent [&::-webkit-details-marker]:hidden'

/** The usual <details> summary: the chevron with small semibold ink text. */
export const disclosureSummaryClass = `${disclosureChevronClass} text-sm font-semibold text-penny-ink`

/** A checkbox or radio in a rounded box that fills sand when chosen, for a short list of options. */
export const choicePillClass = 'flex min-h-11 w-fit max-w-full min-w-0 items-center gap-2.5 rounded-lg border border-penny-line bg-penny-paper px-3 text-sm font-medium text-penny-ink has-[:checked]:border-penny-line-strong has-[:checked]:bg-penny-sand'

/** A small read-only tag, like a release's subject. */
export const tagPillClass = 'rounded-full border border-penny-line bg-penny-paper px-2.5 py-1 text-xs font-semibold text-penny-muted'

/**
 * A disclosure that leads a page's list, such as Create decision or Record evidence: a full-width paper card whose summary
 * row holds a sand icon disc, the label and a chevron. Its form opens inside the same card under a hairline. Use with
 * DisclosureRow (./DisclosureRow.tsx), which supplies the summary's parts.
 */
export const disclosureRowClass = `group ${paperCardClass}`
