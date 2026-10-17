import { useEffect } from 'react'
import { HydrationUnit } from '@/base/hydration/unit'
import { RequesterActions } from './requester-actions'
import { buttonClass, fieldClass, dataLabelClass, fieldLabelClass, ledeClass, primaryButtonClass, textLinkClass } from '@/core/features/portal/ui/portal-classes'
import { Link, useLocation } from '@tanstack/react-router'
import type { PublicBoard, PublicRequestCard, PublicRequestDetail } from '@/core/shared/api/public'
import type { PublicPortalContent } from '@/core/features/portal/ui/public-portal-layout'
import { PublicPortalLayout } from '@/core/features/portal/ui/public-portal-layout'
import { formatPublicDate } from '@/core/features/portal/ui/public-format'
import { PortalIcon, PublicCard, PublicEmpty, PublicStatus, ResourceFailure, ResourceLoading } from '@/core/features/portal/ui/public-primitives'
import { PortalBackLink } from '@/core/features/portal/ui/portal-back-link'
import { PageTitle } from '@/core/ui/app/PageTitle'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { PublicRequestCardView } from './public-request-card'
import { DataField } from '@/core/ui/app/DataField'

const orderLinkClass = 'inline-flex min-h-11 items-center px-3 text-sm focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-penny-accent'
const orderActiveClass = 'font-semibold text-penny-ink underline decoration-penny-copper decoration-2 underline-offset-8'
const orderIdleClass = 'font-medium text-penny-muted hover:text-penny-ink'

function useFeedbackQuery(): { readonly q?: string; readonly status?: string; readonly board?: string; readonly category?:string; readonly sort?: 'recent' | 'votes' | 'newest' | 'trending' } {
  const params = new URLSearchParams(useLocation().searchStr)
  const board = params.get('board')?.trim()
  const value=params.get('sort')
  const sort=value==='votes'||value==='recent'||value==='newest'||value==='trending'?value:undefined
  return { q: params.get('q')?.trim() || undefined, status: params.get('status') || undefined, board: board || undefined, category:params.get('category')||undefined,sort }
}

function requestsPath({ q, status, board, category, sort }: { readonly q?: string; readonly status?: string; readonly board?: string; readonly category?:string; readonly sort?: 'recent' | 'votes' | 'newest' | 'trending' }): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (board) params.set('board', board)
  if(category)params.set('category',category)
  if (sort) params.set('sort', sort)
  const query = params.toString()
  return `/api/public/requests${query ? `?${query}` : ''}`
}

export function PublicFeedbackHomePage({ content }: { readonly content: PublicPortalContent }) {
  const query = useFeedbackQuery()
  const [requests, retryRequests] = usePublicResource<readonly PublicRequestCard[]>(requestsPath(query))
  const [boards, retryBoards] = usePublicResource<readonly PublicBoard[]>('/api/public/boards')
  const selectedBoard=boards.kind==='ready'?boards.data.find(b=>b.slug===query.board):undefined
  const categories=boards.kind==='ready'?boards.data.filter(b=>!query.board||b.slug===query.board).flatMap(b=>b.categories.map(c=>({...c,boardName:b.name}))):[]
  useEffect(()=>{const timer=window.setInterval(()=>{retryBoards();retryRequests()},4000);return()=>window.clearInterval(timer)},[retryBoards,retryRequests])

  return (
    <PublicPortalLayout content={content}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <HydrationUnit><section className="min-w-0" aria-labelledby="feedback-heading">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <header className="min-w-0"><PageTitle id="feedback-heading" eyebrow="Feedback">What should we improve?</PageTitle><p className={ledeClass}>Browse feedback that has been reviewed and published by {content.ownerName}.</p></header>
            {boards.kind==='ready'&&(query.board?selectedBoard?.postingPolicy==='requesters':boards.data.some(b=>b.postingPolicy==='requesters'))?<Link to="/portal/feedback/new" className={primaryButtonClass}><PortalIcon name="plus" />Submit feedback</Link>:null}
          </div>
          <form action="/" className="mt-8 flex flex-wrap items-end gap-3">
            <label className={`${fieldLabelClass} basis-full flex-1 min-[31rem]:basis-56`}>Search feedback<input name="q" defaultValue={query.q} maxLength={200} className={`${fieldClass} text-sm`} /></label>
            <label className={fieldLabelClass}>Status<select name="status" defaultValue={query.status ?? ''} className={`${fieldClass} text-sm`}><option value="">All statuses</option>{['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
            {categories.length?<label className={fieldLabelClass}>Category<select name="category" defaultValue={query.category??''} className={`${fieldClass} text-sm`}><option value="">All categories</option>{categories.filter(c=>!c.archived||c.requestCount>0).map(c=><option key={c.id} value={c.id}>{query.board?'':`${c.boardName}: `}{c.parentId?`${categories.find(p=>p.id===c.parentId)?.name} / `:''}{c.name} ({c.requestCount})</option>)}</select></label>:null}
            {query.sort?<input type="hidden" name="sort" value={query.sort}/>:null}
            {query.board ? <input type="hidden" name="board" value={query.board} /> : null}
            <button className={buttonClass}>Search</button>
          </form>
          <div className="mt-7 flex flex-wrap items-center gap-2 border-y border-penny-line py-3" aria-label="Feedback order">
            <span className={`${dataLabelClass} mr-2`}>Order</span>
            <Link to="/" search={{ ...query, sort: 'recent' }} className={`${orderLinkClass} ${!query.sort||query.sort==='recent' ? orderActiveClass : orderIdleClass}`}>Recent activity</Link>
            <Link to="/" search={{ ...query, sort: 'votes' }} className={`${orderLinkClass} ${query.sort === 'votes' ? orderActiveClass : orderIdleClass}`}>Most votes</Link>
            <Link to="/" search={{...query,sort:'newest'}} className={`${orderLinkClass} ${query.sort==='newest'?orderActiveClass:orderIdleClass}`}>Newest</Link>
            <Link to="/" search={{...query,sort:'trending'}} className={`${orderLinkClass} ${query.sort==='trending'?orderActiveClass:orderIdleClass}`}>Trending</Link>
          </div>
          <div className="mt-5 space-y-3">
            {requests.kind === 'loading' ? <ResourceLoading label="Loading published feedback…" /> : null}
            {requests.kind === 'error' ? <ResourceFailure status={requests.status} onRetry={retryRequests} /> : null}
            {requests.kind === 'ready' && requests.data.length === 0 ? <PublicEmpty title={query.q || query.status || query.board ? "No matching feedback" : "No published feedback yet"}>{query.q || query.status ? 'No published feedback matches these filters.' : query.board ? 'No published feedback matches this board.' : 'Feedback will appear here after review.'}</PublicEmpty> : null}
            {requests.kind === 'ready' ? requests.data.map((request) => <PublicRequestCardView key={request.slug} request={request} />) : null}
          </div>
        </section></HydrationUnit>
        <HydrationUnit><aside className="min-w-0 lg:pt-1" aria-labelledby="boards-heading">
          <PublicCard className="p-5">
            <h2 id="boards-heading" className={dataLabelClass}>Boards</h2>
            <div className="mt-3">
              {boards.kind === 'loading' ? <ResourceLoading label="Loading boards…" /> : null}
              {boards.kind === 'error' ? <ResourceFailure status={boards.status} onRetry={retryBoards} /> : null}
              {boards.kind === 'ready' && boards.data.length === 0 ? <p className="text-sm leading-6 text-penny-muted">No public boards are available.</p> : null}
              {boards.kind === 'ready' ? <ul className="divide-y divide-penny-line">{boards.data.map((board) => <li key={board.slug}><Link to="/" search={{ ...query, category:undefined, board: board.slug }} className={`flex min-h-11 items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-penny-accent focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-penny-accent ${query.board === board.slug ? 'font-bold text-penny-ink underline decoration-penny-copper decoration-2 underline-offset-4' : 'font-medium text-penny-ink'}`}><span>{board.name}</span><span className="text-xs tabular-nums text-penny-muted">{board.requestCount}</span></Link></li>)}</ul> : null}
            </div>
          </PublicCard>
        </aside></HydrationUnit>
      </div>
    </PublicPortalLayout>
  )
}

export function PublicFeedbackDetailPage({ content, requestSlug }: { readonly content: PublicPortalContent; readonly requestSlug: string }) {
  const [request, retry] = usePublicResource<PublicRequestDetail>(`/api/public/requests/${encodeURIComponent(requestSlug)}`)
  useEffect(()=>{const timer=window.setInterval(retry,4000);return()=>window.clearInterval(timer)},[retry])

  return (
    <PublicPortalLayout content={content}>
      <HydrationUnit><section className="mx-auto max-w-3xl" aria-labelledby="feedback-detail-heading">
        <PortalBackLink to="/">All feedback</PortalBackLink>
        <PageTitle id="feedback-detail-heading" className="mt-3">Feedback detail</PageTitle>
        <div className="mt-7">
          {request.kind === 'loading' ? <ResourceLoading label="Loading feedback…" /> : null}
          {request.kind === 'error' ? <ResourceFailure status={request.status} onRetry={retry} /> : null}
          {request.kind === 'ready' ? <FeedbackDetail request={request.data} onChange={retry} /> : null}
        </div>
      </section></HydrationUnit>
    </PublicPortalLayout>
  )
}

function FeedbackDetail({ request, onChange }: { readonly request: PublicRequestDetail; readonly onChange: () => void }) {
  return (
    <>
      <PublicCard className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><PublicStatus status={request.status} label={request.statusLabel} /><span className="text-sm font-medium text-penny-muted">{request.board.name}</span>{request.category?<span className="text-sm text-penny-muted">{request.category.parent?`${request.category.parent.name} / `:''}{request.category.name}</span>:null}</div>
        <h2 className="mt-4 break-words text-2xl font-extrabold tracking-[-0.02em] text-penny-ink">{request.title}</h2>
        {request.authorDisplayName ? <p className="mt-1 text-sm text-penny-muted">Submitted by {request.authorDisplayName}</p> : null}
        <p className="mt-4 break-words whitespace-pre-wrap text-base leading-7 text-penny-ink">{request.description}</p>
        <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-penny-line pt-5 text-sm">
          {request.voteCount!==undefined?<DataField portal label="Votes" valueClassName="text-lg font-bold tabular-nums">{request.voteCount}</DataField>:null}
          <DataField portal label="Published" valueClassName="text-lg font-bold"><time dateTime={request.publishedAt}>{formatPublicDate(request.publishedAt)}</time></DataField>
        </dl>
        {request.publicEta ? <p className="mt-4 text-sm font-semibold text-penny-ink">Public ETA: {request.publicEta}</p> : null}
        <RequesterActions slug={request.slug} commentsAllowed={request.commentsAllowed} showVoters={request.showVoters} onChange={onChange} />
        {request.voters?.length?<div className="mt-4 border-t border-penny-line pt-4"><h3 className={dataLabelClass}>Voters</h3><ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-penny-muted">{request.voters.map((voter,index)=><li key={index}>{voter.displayName}</li>)}</ul></div>:null}
        {request.attachments.map((file) => <a key={file.id} className={`${textLinkClass} mt-3 block break-words`} href={`/api/public/attachments/${file.id}`}>{file.filename}</a>)}
      </PublicCard>
      {request.statusUpdates.map((update) => (
        <PublicCard key={update.id} className="mt-4 p-5">
          <p className={dataLabelClass}>{update.pinned ? 'Pinned status update' : 'Status update'} · {update.status.replaceAll('_', ' ')}</p>
          <p className="mt-2 break-words whitespace-pre-wrap leading-7 text-penny-ink">{update.body}</p>
        </PublicCard>
      ))}
      <HydrationUnit><section className="mt-9" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="text-xl font-bold tracking-[-0.02em] text-penny-ink">Published comments</h2>
        <div className="mt-4 space-y-3">
          {request.comments.length === 0 ? <PublicEmpty title="No published comments">Comments appear here after review.</PublicEmpty> : null}
          {request.comments.map((comment) => (
            <PublicCard key={comment.id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="break-words font-semibold text-penny-ink">{comment.author.displayName}</p><time className="text-xs font-medium text-penny-muted" dateTime={comment.publishedAt}>{formatPublicDate(comment.publishedAt)}</time></div>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-penny-ink">{comment.body}</p>
            </PublicCard>
          ))}
        </div>
      </section></HydrationUnit>
    </>
  )
}
