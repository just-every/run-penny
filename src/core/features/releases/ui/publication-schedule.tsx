import { useEffect, useRef, useState } from 'react'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { operatorMutation } from '@/core/features/requests/ui/operator-client'
import { fieldLabelClass, inputClass, secondaryButtonClass, textLinkClass } from '@/core/ui/app/classes'

interface ScheduleResource {
  timezone: string
  schedule: null | {
    id: string
    scheduledAt: string
    timeZone: string
    state: 'scheduled' | 'published' | 'failed' | 'cancelled' | 'held'
    lastError: string | null
  }
}

export function PublicationSchedule({ path, subject, revision, disabled = false, canSchedule = true }: {
  readonly path: string
  readonly subject: 'Release' | 'Status update'
  readonly revision: unknown
  readonly disabled?: boolean
  readonly canSchedule?: boolean
}) {
  const [resource, reload, request] = useOperatorResource<ScheduleResource>(path)
  const previousRevision = useRef(revision)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (previousRevision.current !== revision) { previousRevision.current = revision; reload() }
  }, [revision, reload])

  async function act(localTime: string | null) {
    setBusy(true); setMessage(''); setError('')
    try {
      await operatorMutation(localTime === null ? `${path}/cancel` : path, localTime === null ? {} : { localTime })
      setMessage(localTime === null ? 'Publication schedule cancelled.' : 'Publication scheduled.')
      reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Publication schedule could not be saved.') }
    finally { setBusy(false) }
  }

  const schedule = resource.kind === 'ready' ? resource.data.schedule : null
  const active = schedule?.state === 'scheduled'
  return <section aria-label={`${subject} publication schedule`} className="mt-5 min-w-0 border-t border-penny-line pt-4">
    <h3 className="font-bold text-penny-ink">Schedule publication</h3>
    {resource.kind === 'loading' ? <p role="status" className="mt-2 text-sm text-penny-muted">Loading publication schedule…</p> : null}
    {resource.kind === 'session_expired' ? <OperatorSessionExpired /> : null}
    {resource.kind === 'error' || resource.kind === 'not_found' ? <div className="mt-2 text-sm"><p role="alert">{resource.kind === 'error' && resource.message ? resource.message : 'Publication schedule could not be loaded.'}</p><button type="button" className={`${textLinkClass} mt-2 min-h-11`} onClick={reload}>Retry schedule</button></div> : null}
    {resource.kind === 'ready' ? <>
      <p className="mt-2 break-words text-sm text-penny-muted">Workspace timezone: {resource.data.timezone}</p>
      {schedule ? <div className="mt-3 text-sm leading-6">
        <p className="font-semibold text-penny-ink">{schedule.state === 'scheduled' ? 'Scheduled for' : schedule.state === 'failed' ? 'Publication failed for' : schedule.state === 'cancelled' ? 'Cancelled publication for' : schedule.state === 'held' ? 'Publication held for' : 'Published from schedule for'} <time dateTime={schedule.scheduledAt}>{new Intl.DateTimeFormat('en', { timeZone: schedule.timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(schedule.scheduledAt))}</time> <span className="break-words">({schedule.timeZone})</span></p>
        {schedule.state === 'failed' || schedule.state === 'held' ? <p role="alert" className="mt-2 break-words text-penny-danger">{schedule.lastError ?? 'The publication checks failed. Review the draft before scheduling it again.'}</p> : null}
      </div> : null}
      {active ? <button type="button" disabled={busy || request.pending || disabled} onClick={() => void act(null)} className={`${secondaryButtonClass} mt-4 w-full sm:w-auto`}>{busy ? 'Cancelling…' : 'Cancel schedule'}</button> : canSchedule && schedule?.state !== 'published' ? <form aria-label={`Schedule ${subject.toLowerCase()}`} className="mt-4 space-y-3" onSubmit={event => {
        event.preventDefault()
        if (busy || request.pending || disabled) return
        void act(String(new FormData(event.currentTarget).get('localTime')))
      }}>
        <label className={fieldLabelClass}>Publish at ({resource.data.timezone})<input required type="datetime-local" name="localTime" disabled={busy || request.pending || disabled} className={`${inputClass} mt-2 max-w-full`} /></label>
        <p className="text-sm leading-6 text-penny-muted">Save any wording changes first. Publication checks run again at the scheduled time.</p>
        <button disabled={busy || request.pending || disabled} className={`${secondaryButtonClass} w-full sm:w-auto`}>{busy ? 'Scheduling…' : 'Schedule publication'}</button>
      </form> : null}
    </> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-penny-ink">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 break-words text-sm text-penny-danger">{error}</p> : null}
  </section>
}
