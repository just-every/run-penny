import { DeliveryCounts, useMailSuppressed } from '@/core/features/releases/ui/delivery-counts'
import type { DeliveryCounts as Counts } from '@/core/features/releases/counts'
import { StatusUpdateForm } from './status-update-form'
import { AttachmentRecovery } from './attachment-recovery'
import { operatorMutation } from './operator-client'
import { RequestMetadata } from './request-metadata'
import { RequestSupporters, type RequestVoter } from './request-supporters'
import {TrackerLinks} from '../../integrations/ui/tracker-links'
import { AppealReview, HeldItemForm } from './held-items'
import { heldItems, type HeldContext } from './held-context'
import { quietButtonClass, subformClass } from './form-classes'
import { useState } from 'react'
import { Chip } from '@/core/ui/app/Chip'
import { disclosureSummaryClass, fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import type { RequestActions } from '../operator-availability'
import { useRouter } from '@tanstack/react-router'

function followerSummary(counts: Counts, mailSuppressed: boolean): string {
  const parts: string[] = []
  if (counts.queued > 0) parts.push(`${counts.queued} follower${counts.queued === 1 ? '' : 's'} will be notified`)
  if (counts.sent + counts.delivered > 0) parts.push(`${counts.sent + counts.delivered} ${mailSuppressed ? 'recorded, not emailed (local)' : 'sent'}`)
  if (counts.suppressed > 0) parts.push(`${counts.suppressed} suppressed`)
  if (counts.failed > 0) parts.push(`${counts.failed} failed`)
  if (counts.unknown > 0) parts.push(`${counts.unknown} need review`)
  return parts.length > 0 ? parts.join(', ') : 'No followers to notify.'
}
interface Context extends HeldContext { actions: RequestActions; statusVersions: { id: string; title: string; publicStatus: string; counts: Counts }[]; deliveryCounts: Counts; uploads: { id: string; original_filename: string; writing: number }[]; requestId: string; voters: RequestVoter[]; tags: { id: string; name: string }[] }

export function OperatorRequestControls({ slug }: { slug: string }) {
  const [context, refresh] = usePublicResource<Context>(`/api/operator/requests/${slug}/context`), [message, setMessage] = useState(''), router = useRouter()
  async function act(path: string, body: unknown, method = 'POST', inline = false) { try { await operatorMutation(path, body, method); setMessage('Saved.'); refresh(); await router.invalidate(); return null } catch (e) { const text = e instanceof Error ? e.message : 'Action failed.'; if (!inline) setMessage(text); return text } }
  const held = context.kind === 'ready' ? heldItems(context.data) : []
  const mailSuppressed = useMailSuppressed()
  return (
    <>
      {context.kind === 'ready' ? (
        <section className="mt-6 border-t border-penny-line pt-5" aria-label="Status update delivery">
          <h3 className="font-bold text-penny-ink">Follower notifications</h3>
          <DeliveryCounts counts={context.data.deliveryCounts} />
          {context.data.statusVersions.map((version) => (
            <article key={version.id} className="mt-4 rounded-lg border border-penny-line bg-penny-paper p-4">
              <h4 className="font-bold text-penny-ink">{version.title} · {version.publicStatus.replaceAll('_', ' ')}</h4>
              <p className="mt-1 text-sm font-semibold text-penny-muted">{followerSummary(version.counts, mailSuppressed)}</p>
              <DeliveryCounts counts={version.counts} />
            </article>
          ))}
        </section>
      ) : null}
      {context.kind === 'ready' && context.data.tags.length > 0 ? <ul className="mt-4 flex list-none flex-wrap gap-2 p-0" aria-label="Private tags">{context.data.tags.map(tag => <li key={tag.id}><Chip tone="sand">{tag.name}</Chip></li>)}</ul> : null}
      {context.kind === 'ready' ? <RequestSupporters voters={context.data.voters} /> : null}
      <details open={held.length > 0} className="group mt-5 border-t border-penny-line pt-1">
        <summary className={disclosureSummaryClass}><span>Discussion, status and request controls</span>{held.length ? <span className="ml-2 rounded-full bg-penny-copper/15 px-2 py-0.5 text-xs font-bold text-penny-ink">{held.length} awaiting review</span> : null}</summary>
        <div className="max-w-3xl space-y-5">
          <p className="mt-3 text-sm font-semibold text-penny-ink empty:hidden" role="status">{message}</p>
          {context.kind === 'ready' ? held.map(({ item, path, label }) => <HeldItemForm key={item.id} item={item} path={path} label={label} act={act} canReview={context.data.actions.moderation} />) : null}
          {context.kind === 'ready' ? <TrackerLinks requestId={context.data.requestId} /> : null}
          {context.kind === 'ready' && context.data.actions.publish ? <StatusUpdateForm key={slug} slug={slug} onSaved={refresh} onMessage={setMessage} onReverse={context.data.actions.reverseDecline ? () => void act(`/api/operator/requests/${slug}/decline/reverse`, {}) : undefined} /> : null}
          {context.kind === 'ready' && !context.data.actions.publish && context.data.actions.reverseDecline ? <button type="button" className={quietButtonClass} onClick={() => void act(`/api/operator/requests/${slug}/decline/reverse`, {})}>Reverse decline</button> : null}
          {context.kind === 'ready' && context.data.actions.publish ? <form className={`${subformClass} space-y-3`} onSubmit={(e) => { e.preventDefault(); void act(`/api/operator/requests/${slug}/comments`, { body: new FormData(e.currentTarget).get('body') }) }}><label className={fieldLabelClass}>Operator comment<textarea name="body" required className={fieldClass} /></label><button className={primaryButtonClass}>Post public comment</button></form> : null}
          {context.kind === 'ready' && context.data.actions.merge ? <form className={`${subformClass} space-y-3`} onSubmit={(e) => { e.preventDefault(); void act(`/api/operator/requests/${slug}/merge`, { targetSlug: new FormData(e.currentTarget).get('target') }) }}><label className={fieldLabelClass}>Canonical request slug<input name="target" required className={fieldClass} /></label><div className="flex flex-wrap items-center gap-3"><button className={primaryButtonClass}>Merge duplicate</button></div></form> : null}
          {context.kind === 'ready' && context.data.actions.unmerge ? <button type="button" className={quietButtonClass} onClick={() => void act(`/api/operator/requests/${slug}/unmerge`, {})}>Unmerge</button> : null}
          {context.kind === 'ready' ? <form className={`${subformClass} space-y-3`} onSubmit={(e) => { e.preventDefault(); void act(`/api/operator/requests/${slug}/board`, { boardSlug: new FormData(e.currentTarget).get('board') }, 'PATCH') }}><label className={fieldLabelClass}>Move to board<input name="board" required className={fieldClass} /></label><button className={primaryButtonClass}>Move request</button></form> : null}
          {context.kind === 'ready' ? <>
            <RequestMetadata requestId={context.data.requestId} tags={context.data.tags} onChanged={refresh} />
            {context.data.uploads.map((u) => <AttachmentRecovery key={u.id} upload={u} onRecovered={refresh} />)}
            {context.data.appeals.map((a) => <AppealReview key={a.id} appeal={a} act={act} canReview={context.data.actions.moderation} />)}
          </> : context.kind === 'error' ? <p role="alert" className="text-sm font-semibold text-penny-danger">Could not load moderation details.</p> : <p className="text-sm text-penny-muted">Loading details…</p>}
        </div>
      </details>
    </>
  )
}
