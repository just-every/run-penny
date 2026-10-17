import { useEffect, useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { operatorMutation } from '../../requests/ui/operator-client'
import type { OwnershipQueue } from '../types'

export function MyQueue() {
 const [page, setPage] = useState(1), [resource, refresh] = useOperatorResource<OwnershipQueue>(`/api/operator/ownership/queue?page=${page}`), [message, setMessage] = useState(''), [busy, setBusy] = useState<string | null>(null)
 useEffect(() => { window.addEventListener('penny-ownership-changed', refresh); return () => window.removeEventListener('penny-ownership-changed', refresh) }, [refresh])
 const queue = resource.kind === 'ready' ? resource.data : null
 const pages = queue ? Math.max(1, ...Object.values(queue.totals).map(total => Math.ceil(total / queue.pageSize))) : 1
 return <OperatorCard as="section" className="mt-6 p-5 sm:p-6" aria-label="My queue">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-penny-ink">My queue</h2><button type="button" className={secondaryButtonClass} onClick={refresh}>Refresh my queue</button></div>
  <p className="mt-2 text-sm text-penny-muted">Your assigned requests, unreviewed evidence and requester comments awaiting your attention.</p>
  {resource.kind === 'loading' ? <p className="mt-4 text-sm text-penny-muted">Loading your queue…</p> : null}
  {resource.kind !== 'ready' && resource.kind !== 'loading' ? <p role="alert" className="mt-4 text-sm text-penny-danger">Could not load your queue. Sign in again or refresh.</p> : null}
  {queue ? <>
   <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-3">
    <section aria-label="My requests"><h3 className="font-bold text-penny-ink">Requests ({queue.totals.requests})</h3>{queue.requests.length ? <ul className="mt-3 space-y-3">{queue.requests.map(request => <li key={request.id} className="min-w-0"><a className="inline-flex min-h-11 items-center break-words text-penny-ink underline underline-offset-4" href={`/app/moderation?item=${request.id}#request-${request.slug}`}>{request.title}</a><p className="text-sm text-penny-muted">{request.boardName} · {request.moderationState.replaceAll('_', ' ')}</p></li>)}</ul> : <p className="mt-3 text-sm text-penny-muted">No requests on this page.</p>}</section>
    <section aria-label="My evidence"><h3 className="font-bold text-penny-ink">Evidence ({queue.totals.evidence})</h3>{queue.evidence.length ? <ul className="mt-3 space-y-3">{queue.evidence.map(evidence => <li key={evidence.id} className="min-w-0"><a className="inline-flex min-h-11 items-center break-words text-penny-ink underline underline-offset-4" href={`/app/feedback?item=${evidence.id}#evidence-${evidence.id}`}>{evidence.wording.slice(0, 180)}</a><p className="text-sm text-penny-muted">{evidence.sourceLabel || evidence.sourceType.replaceAll('_', ' ')}</p></li>)}</ul> : <p className="mt-3 text-sm text-penny-muted">No evidence on this page.</p>}</section>
    <section aria-label="My requester comments"><h3 className="font-bold text-penny-ink">Requester comments ({queue.totals.comments})</h3>{queue.comments.length ? <ul className="mt-3 space-y-4">{queue.comments.map(comment => <li key={comment.id} className="min-w-0 border-b border-penny-line pb-3"><a className="inline-flex min-h-11 items-center break-words text-penny-ink underline underline-offset-4" href={`/app/moderation?item=${comment.requestId}#request-${comment.slug}`}>{comment.title}</a><p className="mt-1 text-sm break-words whitespace-pre-wrap text-penny-ink">{comment.body}</p>{comment.moderationState === 'awaiting_review' ? <p className="mt-2 text-sm text-penny-muted">Awaiting moderation. Review it on the request first.</p> : <button type="button" disabled={busy !== null} className={`${secondaryButtonClass} mt-3`} onClick={async () => {
      setBusy(comment.id); setMessage('')
      try { await operatorMutation(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: comment.updatedAt }); refresh(); setMessage('Comment marked handled.') }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Could not mark the comment handled.') }
      finally { setBusy(null) }
     }}>{busy === comment.id ? 'Saving…' : 'Mark handled'}</button>}</li>)}</ul> : <p className="mt-3 text-sm text-penny-muted">No requester comments on this page.</p>}</section>
   </div>
   <nav className="mt-5 flex flex-wrap items-center gap-3 border-t border-penny-line pt-4" aria-label="My queue pages"><p className="text-sm text-penny-muted">Page {page} of {pages}</p>{page > 1 ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(page - 1)}>Previous queue page</button> : null}{page < pages ? <button type="button" className={secondaryButtonClass} onClick={() => setPage(page + 1)}>Next queue page</button> : null}</nav>
  </> : null}
  <p role="status" className="mt-3 text-sm text-penny-ink empty:hidden">{message}</p>
 </OperatorCard>
}
