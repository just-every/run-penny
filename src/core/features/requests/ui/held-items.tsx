import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import type { Appeal, ModeratedItem } from './held-context'
import { quietButtonClass, subformClass } from './form-classes'

type Act = (path: string, body: unknown, method?: string) => Promise<void>

export function AppealReview({ appeal, act }: { appeal: Appeal; act: Act }) {
  return (
    <div className={subformClass}>
      <p className="text-sm text-penny-ink">Appeal ({appeal.state}): {appeal.body}</p>
      {appeal.state === 'open' ? (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(`/api/operator/appeals/${appeal.id}/review`, { resolution: (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value'), reason: data.get('reason') }) }}>
          <label className={fieldLabelClass}>Appeal decision reason<textarea name="reason" required className={fieldClass} /></label>
          <div className="flex flex-wrap gap-3"><button className={primaryButtonClass} value="reopen">Reopen for moderation</button><button className={secondaryButtonClass} value="dismiss">Keep rejection</button></div>
        </form>
      ) : <p className="mt-1 text-sm text-penny-muted">{appeal.resolution}: {appeal.resolution_reason}</p>}
    </div>
  )
}

export function HeldItemForm({ item, path, label, act }: { item: ModeratedItem; path: string; label: string; act: Act }) {
  return (
    <form className={`${subformClass} space-y-3`} onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget), verdict = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'approved'; void act(path, { verdict, ...(verdict === 'rejected' ? { reason: d.get('reason'), ...(label !== 'Attachment' ? {notifyAuthor: d.get('notifyAuthor') === 'on'} : {}) } : { publicAuthorDisplayName: d.get('displayName') || undefined }) }) }}>
      <h3 className="font-bold text-penny-ink">{label}</h3>
      <p className="break-words whitespace-pre-wrap text-penny-ink">{item.title} {item.body ?? item.description ?? item.original_filename}</p>
      {label === 'Attachment' ? <a className="inline-flex min-h-11 items-center font-semibold break-words text-penny-ink underline decoration-penny-ink/40 underline-offset-4 hover:decoration-penny-copper" href={`/api/operator/attachments/${item.id}`}>Download for review</a> : null}
      <label className={fieldLabelClass}>Approved display name<input name="displayName" className={fieldClass} /></label>
      <label className={fieldLabelClass}>Rejection reason<input name="reason" className={fieldClass} /></label>
      {label !== 'Attachment' ? <label className="flex items-start gap-3 text-sm leading-6 text-penny-ink"><input type="checkbox" name="notifyAuthor" className="mt-1 size-4" />Email the author this rejection reason</label> : null}
      <div className="flex flex-wrap items-center gap-3"><button className={primaryButtonClass} value="approved">Approve {label.toLowerCase()}</button><button className={quietButtonClass} value="rejected">Reject</button></div>
    </form>
  )
}
