import { Link } from '@tanstack/react-router'
import type { PublicRequestCard } from '@/core/shared/api/public'
import { formatPublicDate } from '@/core/features/portal/ui/public-format'
import { PortalIcon, PublicStatus } from '@/core/features/portal/ui/public-primitives'
import { paperCardClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'

export function PublicRequestCardView({ request }: { readonly request: PublicRequestCard }) {
  return (
    <article className={`${paperCardClass} p-5 transition-colors hover:border-penny-line-strong sm:p-6`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PublicStatus status={request.status} label={request.statusLabel} />
        <span className="text-xs font-medium text-penny-muted">{request.board.name}</span>
        {request.category?<span className="text-xs text-penny-muted">{request.category.parent?`${request.category.parent.name} / `:''}{request.category.name}</span>:null}
      </div>
      <h2 className="mt-3 break-words text-lg font-bold tracking-[-0.015em] text-penny-ink sm:text-xl">
        <Link to="/portal/feedback/$requestSlug" params={{ requestSlug: request.slug }} className="rounded-sm hover:underline hover:decoration-penny-copper hover:underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-penny-accent">{request.title}</Link>
      </h2>
      <p className="mt-2 break-words line-clamp-3 text-sm leading-6 text-penny-muted">{request.description}</p>
      <footer className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-penny-line pt-3 text-sm text-penny-muted">
        {request.voteCount!==undefined?<span className="inline-flex items-center gap-1.5 tabular-nums"><PortalIcon name="vote" className="size-4 text-penny-accent" />{request.voteCount} {request.voteCount === 1 ? 'vote' : 'votes'}</span>:null}
        <span className="inline-flex items-center gap-1.5 tabular-nums"><PortalIcon name="comment" className="size-4" />{request.commentCount} {request.commentCount === 1 ? 'comment' : 'comments'}</span>
        <Link to="/portal/feedback/$requestSlug" params={{ requestSlug: request.slug }} aria-label={`View feedback: ${request.title}`} className={`${textLinkClass} inline-flex min-h-11 items-center gap-1 text-sm`}>View feedback<PortalIcon name="arrow" className="size-4" /></Link>
        <time className="text-xs sm:ml-auto" dateTime={request.recentActivityAt}>Updated {formatPublicDate(request.recentActivityAt)}</time>
      </footer>
    </article>
  )
}
