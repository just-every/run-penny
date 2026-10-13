import { OperatorCard } from '@/core/app/ui/operator-primitives'
import { Chip, type ChipTone } from '@/core/ui/app/Chip'
import { dataLabelClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass, postJson } from '@/core/features/auth/client-mutations'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { OperatorRequestControls } from './operator-request-controls'

export interface QueueRequest { slug: string; title: string; description: string; boardSlug: string; displayName: string | null; moderationState: string; reason: string | null }

const stateTones: Record<string, ChipTone> = { awaiting_review: 'copper', approved: 'moss', rejected: 'muted' }

export function ModerationCard({ row, report }: { row: QueueRequest; report: (message: string) => void }) {
  return (
    <OperatorCard as="article" id={`request-${row.slug}`} className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold tracking-[-0.02em] break-words text-penny-ink">{row.title}</h2>
        <Chip tone={stateTones[row.moderationState] ?? 'neutral'}><span className="first-letter:uppercase">{row.moderationState.replaceAll('_', ' ')}</span></Chip>
      </div>
      {row.moderationState !== 'awaiting_review' ? (
        <>
          <p className="mt-3 leading-7 whitespace-pre-wrap text-penny-ink">{row.description}</p>
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
      await postJson(`/api/operator/moderation/${row.slug}`, verdict === 'rejected' ? { verdict, reason: data.get('reason') } : { verdict, title: data.get('title'), description: data.get('description'), boardSlug: data.get('boardSlug'), displayName: data.get('displayName') })
      await router.invalidate()
      report(verdict === 'approved' ? 'Approved wording is now public.' : 'Feedback rejected with its reason retained.')
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
      <div className="flex flex-wrap gap-3">
        <button className={primaryButtonClass} value="approved" disabled={busy}>Approve and publish</button>
        <button className={secondaryButtonClass} value="rejected" disabled={busy} formNoValidate>Reject feedback</button>
      </div>
    </form>
  )
}
