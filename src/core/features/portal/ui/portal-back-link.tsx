import { Link } from '@tanstack/react-router'
import { PortalIcon } from './public-primitives'

const backLinkClass = 'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-penny-ink underline decoration-penny-ink/40 underline-offset-4 transition-colors hover:decoration-penny-copper'

/** The "All feedback" style link above a detail page. */
export function PortalBackLink({ to, children }: { readonly to: '/' | '/portal/feedback' | '/portal/roadmap' | '/portal/updates'; readonly children: string }) {
  return <Link to={to} className={backLinkClass}><PortalIcon name="arrow" className="size-4 rotate-180" />{children}</Link>
}
