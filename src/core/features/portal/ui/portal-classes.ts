// The customer pages (portal, requester verification and activity) keep the kit at the quieter scale the owner approved
// for them; the operator app and sign-in use the landing's larger scale in src/core/ui/app/classes.ts. Every class not
// listed here is the shared kit unchanged, so a portal file imports its classes from this module only.
export * from '@/core/ui/app/classes'

/** A flat paper card: a sheet a shade lighter than the page, a fine line border and a barely-there shadow. */
export const paperCardClass = 'min-w-0 rounded-xl border border-penny-line bg-penny-card shadow-[0_1px_2px_rgb(92_62_32_/_0.06)]'

const buttonBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent'

/** The primary action: a black pill. */
export const primaryButtonClass = `${buttonBase} bg-penny-ink text-penny-paper hover:bg-penny-soft`

/** A secondary action: an outlined ink pill. */
export const secondaryButtonClass = `${buttonBase} border border-penny-ink text-penny-ink hover:bg-penny-ink/6`

/** The small uppercase copper line above a page or section title. */
export const eyebrowClass = 'text-xs font-semibold tracking-[0.14em] text-penny-accent uppercase'

/** The intro paragraph under a portal page's title. */
export const ledeClass = 'mt-4 max-w-2xl text-base leading-7 text-penny-muted'

/** A readable small-caps label over a data value (VOTES, PUBLISHED). */
export const dataLabelClass = 'text-xs font-semibold tracking-[0.09em] text-penny-muted uppercase'

/** A text input, select or textarea on paper: a fine ink line, copper when focused. Callers add the top margin. Its --field-inset is the shared kit's (a select's caret reads it). */
export const inputClass = 'block min-h-11 w-full min-w-0 rounded-lg border border-penny-line-strong bg-penny-card [--field-inset:0.75rem] px-(--field-inset) py-2 font-normal text-penny-ink placeholder:text-penny-muted transition-colors focus-visible:border-penny-copper focus-visible:ring-3 focus-visible:ring-penny-copper/30 focus-visible:outline-none disabled:opacity-60'

/** A field label wrapping its control (or a fieldset legend). */
export const fieldLabelClass = 'block min-w-0 text-sm font-semibold text-penny-ink'

/** A requester form's field and submit button (the operator forms' fieldClass and buttonClass at the portal's scale). */
export const fieldClass = `mt-2 text-base ${inputClass}`
export const buttonClass = primaryButtonClass
