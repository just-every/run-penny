import { useState, type FormEvent } from 'react'
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import type { Appeal, ModeratedItem } from './held-context'
import { quietButtonClass, subformClass } from './form-classes'

type Act = (path: string, body: unknown, method?: string, inline?: boolean) => Promise<string | null>

// The server refuses a public comment without an approved author name; say so beside the field.
const nameRequired = /public author name/i

export function AppealReview({ appeal, act, canReview }: { appeal: Appeal; act: Act; canReview: boolean }) {
  return (
    <div className={subformClass}>
      <p className="text-sm text-penny-ink">Appeal ({appeal.state}): {appeal.body}</p>
      {appeal.state === 'open' && canReview ? (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(`/api/operator/appeals/${appeal.id}/review`, { resolution: (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value'), reason: data.get('reason') }) }}>
          <label className={fieldLabelClass}>Appeal decision reason<textarea name="reason" required className={fieldClass} /></label>
          <div className="flex flex-wrap gap-3"><button className={primaryButtonClass} value="reopen">Reopen for moderation</button><button className={secondaryButtonClass} value="dismiss">Keep rejection</button></div>
        </form>
      ) : <p className="mt-1 text-sm text-penny-muted">{appeal.state === 'open' ? 'Retained as history. This request is not eligible for appeal review.' : `${appeal.resolution}: ${appeal.resolution_reason}`}</p>}
    </div>
  )
}

export function HeldItemForm({ item, path, label, act, canReview }: { item: ModeratedItem; path: string; label: string; act: Act; canReview: boolean }) {
  if (!canReview) return <article className={`${subformClass} space-y-3`}>
    <h3 className="font-bold text-penny-ink">{label}</h3>
    <p className="break-words whitespace-pre-wrap text-penny-ink">{item.title} {item.body ?? item.description ?? item.original_filename}</p>
    {label === 'Attachment' ? <a className="underline" href={`/api/operator/attachments/${item.id}`}>Download private attachment</a> : null}
    <p className="text-sm text-penny-muted">Retained as history. This request is not eligible for moderation.</p>
  </article>
  return <HeldItemReview item={item} path={path} label={label} act={act} />
}

function HeldItemReview({ item, path, label, act }: { item: ModeratedItem; path: string; label: string; act: Act }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  // Only a comment carries a public author name; edits keep the name already approved.
  const named = label === 'Comment'
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget), verdict = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'approved'
    if (verdict === 'rejected' && !String(d.get('reason') ?? '').trim()) { setError('A rejection needs a reason.'); return }
    setBusy(true); setError('')
    const failure = await act(path, { verdict, ...(verdict === 'rejected' ? { reason: d.get('reason'), ...(label !== 'Attachment' ? { notifyAuthor: d.get('notifyAuthor') === 'on' } : {}) } : named ? { publicAuthorDisplayName: String(d.get('displayName') ?? '').trim() || undefined } : {}) }, 'POST', true)
    setBusy(false)
    if (failure) setError(nameRequired.test(failure) ? 'Enter the name to show publicly with this comment, then approve it.' : failure)
  }
  return (
    <form className={`${subformClass} space-y-3`} onSubmit={(e) => void submit(e)} aria-busy={busy}>
      <h3 className="font-bold text-penny-ink">{label}</h3>
      <p className="break-words whitespace-pre-wrap text-penny-ink">{item.title} {item.body ?? item.description ?? item.original_filename}</p>
      {label === 'Attachment' ? <a className="inline-flex min-h-11 items-center font-semibold break-words text-penny-ink underline decoration-penny-ink/40 underline-offset-4 hover:decoration-penny-copper" href={`/api/operator/attachments/${item.id}`}>Download for review</a> : null}
      {named ? <label className={fieldLabelClass}>Approved display name<input name="displayName" defaultValue={item.public_author_display_name ?? item.requester_display_name ?? 'Customer'} className={fieldClass} maxLength={160} aria-describedby={`held-${item.id}-error`} /></label> : null}
      <label className={fieldLabelClass}>Rejection reason<input name="reason" className={fieldClass} /></label>
      {label !== 'Attachment' ? <label className="flex items-start gap-3 text-sm leading-6 text-penny-ink"><input type="checkbox" name="notifyAuthor" className="mt-1 size-4" />Email the author this rejection reason</label> : null}
      <p id={`held-${item.id}-error`} role="alert" className="text-sm font-semibold text-penny-danger empty:hidden">{error}</p>
      <div className="flex flex-wrap items-center gap-3"><button className={primaryButtonClass} value="approved" disabled={busy}>Approve {label.toLowerCase()}</button><button className={quietButtonClass} value="rejected" disabled={busy}>Reject</button></div>
    </form>
  )
}
