import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Chip, type ChipTone } from '@/core/ui/app/Chip'
import { dataLabelClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass, postJson } from '@/core/features/auth/client-mutations'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import type { OperatorRequestCard } from '@/core/shared/api/operator'
import { useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { OperatorRequestControls } from './operator-request-controls'
import type { ModerationAvailability } from '../operator-availability'

export interface QueueRequest extends Pick<OperatorRequestCard, 'slug' | 'title' | 'description' | 'moderationState' | 'publicState'> {
  boardSlug: string
  displayName: string | null
  reason: string | null
  moderationAvailability: ModerationAvailability
}

const stateTones: Record<string, ChipTone> = { awaiting_review: 'copper', approved: 'moss', rejected: 'muted' }
const historyLabels = { withdrawn: 'Withdrawn', merged: 'Merged', inactive_author: 'Inactive author' }
const historyDescriptions = {
  withdrawn: 'This feedback request was withdrawn. Its private context is retained; moderation is unavailable.',
  merged: 'This feedback request was merged into another request. Its private context is retained; moderation is unavailable while it remains merged.',
  inactive_author: 'The author is blocked or their identity was merged. Private context is retained; moderation is unavailable.',
}

export function ModerationCard({ row, report }: { row: QueueRequest; report: (message: string) => void }) {
  const history = row.moderationAvailability === 'current' ? null : row.moderationAvailability
  const statusLabel = history ? historyLabels[history] : row.moderationState.replaceAll('_', ' ')
  return (
    <OperatorCard as="article" id={`request-${row.slug}`} className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold tracking-[-0.02em] break-words text-penny-ink">{row.title}</h2>
        <Chip tone={history ? 'muted' : stateTones[row.moderationState] ?? 'neutral'}><span className="first-letter:uppercase">{statusLabel}</span></Chip>
      </div>
      {history || row.moderationState !== 'awaiting_review' ? (
        <>
          <p className="mt-3 leading-7 whitespace-pre-wrap text-penny-ink">{row.description}</p>
          {history ? <p className="mt-3 text-sm text-penny-muted">{historyDescriptions[history]}</p> : null}
          {row.reason ? <p className="mt-3 text-sm text-penny-muted"><span className={dataLabelClass}>Review reason</span><br />{row.reason}</p> : null}
        </>
      ) : <ReviewForm row={row} report={report} />}
      <OperatorRequestControls slug={row.slug} />
    </OperatorCard>
  )
}

function ReviewForm({ row, report }: { row: QueueRequest; report: (message: string) => void }) {
  const [boards] = usePublicResource<{ slug: string; name: string }[]>('/api/public/boards')
  const [busy, setBusy] = useState(false), router = useRouter()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, data = new FormData(form)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const verdict = submitter?.value === 'rejected' ? 'rejected' : 'approved'
    if (verdict === 'rejected' && !String(data.get('reason') ?? '').trim()) { report('A rejection needs a reason.'); return }
    setBusy(true); report('')
    try {
      await postJson(`/api/operator/moderation/${row.slug}`, verdict === 'rejected' ? { verdict, reason: data.get('reason'), notifyAuthor: data.get('notifyAuthor') === 'on' } : { verdict, title: data.get('title'), description: data.get('description'), boardSlug: data.get('boardSlug'), displayName: data.get('displayName') })
      await router.invalidate()
      report(verdict === 'approved' ? 'Approved wording is now public.' : data.get('notifyAuthor') === 'on' ? 'Feedback rejected. The private author notice is queued for eligibility and delivery checks.' : 'Feedback rejected without an email notice.')
    } catch (error) { report(error instanceof Error ? error.message : 'Review failed.') } finally { setBusy(false) }
  }
  return (
    <form className="mt-5 max-w-3xl space-y-4 border-t border-penny-line pt-5" onSubmit={submit}>
      <label className={fieldLabelClass}>Public title<input name="title" defaultValue={row.title} className={fieldClass} required maxLength={200} /></label>
      <label className={fieldLabelClass}>Public description<textarea name="description" defaultValue={row.description} className={fieldClass} required rows={4} maxLength={10000} /></label>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={fieldLabelClass}>Public board<select name="boardSlug" defaultValue={row.boardSlug} className={fieldClass} required>{boards.kind === 'ready' ? boards.data.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>) : <option value="">Loading boards…</option>}</select></label>
        <label className={fieldLabelClass}>Approved display name<input name="displayName" defaultValue={row.displayName ?? 'Customer'} className={fieldClass} required maxLength={160} /></label>
      </div>
      <label className={fieldLabelClass}>Reason (required for rejection)<textarea name="reason" className={fieldClass} rows={2} maxLength={2000} /></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-penny-ink"><input type="checkbox" name="notifyAuthor" className="mt-1 size-4" />Email the author this rejection reason</label>
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} value="approved" disabled={busy}>Approve and publish</button>
        <button className={secondaryButtonClass} value="rejected" disabled={busy} formNoValidate>Reject feedback</button>
      </div>
    </form>
  )
}
