import { useCallback, useState } from 'react'
import { buttonClass } from '../../auth/client-mutations'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import type { SavedFeedbackInput } from '../types'
import { paperCardClass } from '@/core/ui/app/classes'
import { SourceBuilder } from './source-builder'
import { JobReceiptPanel, ReceiptContent, type ImportReceipt } from './receipt-panel'

interface Preview {
  fingerprint: string
  counts: { input: number; mapped: number; rejected: number; unmapped: number; byKind: Record<string, number> }
  diagnostics: { severity: string; code: string; message: string; field?: string }[]
  rows: { kind: string; sourceId: string; rejection: string | null; omissions: { field?: string; reason: string }[] }[]
  rowsTruncated?: boolean
  rowsTotal?: number
  erasedRecords?: number
  receipt: ImportReceipt
}

interface Job { id: string; state: string; checkpoint: number; total: number }
const mebibyte = 1024 * 1024
const sourceFileLimit = 4 * mebibyte
const sourceBundleLimit = 24 * mebibyte
const preparedBundleLimit = 34 * mebibyte
const sourceLimitDescription = `Decoded source data is limited to ${sourceFileLimit / mebibyte} MiB per file and ${sourceBundleLimit / mebibyte} MiB total.`
const requestLimitDescription = `Preview and apply JSON requests are limited to ${preparedBundleLimit / mebibyte} MiB.`

class ImportActionError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function action<T>(path: string, value: unknown): Promise<T> {
  const body = JSON.stringify(value)
  if (new TextEncoder().encode(body).byteLength > preparedBundleLimit) throw new Error(`${requestLimitDescription} ${sourceLimitDescription}`)
  const response = await fetch('/api/operator/feedback-import/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body,
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as unknown
    const body = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail as Record<string, unknown> : {}
    const headingValues = Array.isArray(body.headings) ? body.headings : Array.isArray(body.omissions) ? body.omissions : []
    const headings = headingValues.filter((heading): heading is string => typeof heading === 'string').slice(0, 12)
    const responseMessage = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : ''
    const serverMessage = responseMessage.slice(0, 1000)
    const namedServerMessage = /\s/.test(serverMessage) ? serverMessage : ''
    throw new ImportActionError(response.status, response.status === 401
      ? 'Your operator session has expired.'
      : response.status === 409
        ? 'Import refused. The source, current authority or later native work conflicts with this action.'
        : [413, 422].includes(response.status) && namedServerMessage
          ? `${namedServerMessage}${headings.length ? ` Headings: ${headings.join(', ')}${headingValues.length > headings.length ? ', …' : ''}.` : ''}`
          : 'The saved files or mapping could not be accepted. Review the source and try again.')
  }
  return response.json() as Promise<T>
}

async function readJob(id: string): Promise<Job> {
  const response = await fetch('/api/operator/feedback-import/jobs/' + encodeURIComponent(id), {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) throw new ImportActionError(response.status, response.status === 401
    ? 'Your operator session has expired.'
    : 'The saved import status could not be refreshed.')
  const value = await response.json() as Partial<Job>
  if (value.id !== id || typeof value.state !== 'string' || typeof value.checkpoint !== 'number' || !Number.isFinite(value.checkpoint) || typeof value.total !== 'number' || !Number.isFinite(value.total)) {
    throw new Error('The saved import status could not be refreshed.')
  }
  return { id, state: value.state, checkpoint: value.checkpoint, total: value.total }
}

export function ImportPanel({ disabled = false }: { disabled?: boolean }) {
  const [source, setSource] = useState<SavedFeedbackInput | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [actionExpired, setActionExpired] = useState(false)
  const receiveSource = useCallback((next: SavedFeedbackInput | null) => { setSource(next); setPreview(null) }, [])
  const [jobs, reloadJobs] = useOperatorResource<Job[]>('/api/operator/feedback-import/jobs')

  const perform = async (work: () => Promise<void>, refreshJobAfterConflictId?: string) => {
    setBusy(true)
    setError('')
    setActionExpired(false)
    setMessage('')
    try {
      await work()
      reloadJobs()
    } catch (caught) {
      if (caught instanceof ImportActionError && caught.status === 401) setActionExpired(true)
      else {
        const failure = caught instanceof Error ? caught.message : 'Saved feedback action failed.'
        setError(failure)
        if (refreshJobAfterConflictId && caught instanceof ImportActionError && caught.status === 409) {
          reloadJobs()
          try {
            const refreshed = await readJob(refreshJobAfterConflictId)
            setJob(current => current?.id === refreshJobAfterConflictId ? refreshed : current)
          } catch (refreshError) {
            if (refreshError instanceof ImportActionError && refreshError.status === 401) setActionExpired(true)
            else setError(`${failure} The saved import status could not be refreshed.`)
          }
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const receiveJob = (next: Job) => {
    setJob(next)
    setMessage(next.state === 'completed'
      ? 'Import complete. Historical people have no sign-in or email permissions.'
      : next.state === 'undone'
        ? 'Imported effects removed. Source originals remain private unless erased.'
        : next.state === 'rolled_back'
          ? 'Applied import effects rolled back.'
          : 'Import paused with a saved checkpoint. Continue this saved job when ready.')
  }

  const showJobs = () => {
    if (jobs.kind === 'loading') return <OperatorResourceLoading label="Loading saved imports…"/>
    if (jobs.kind === 'session_expired') return <OperatorSessionExpired/>
    if (jobs.kind === 'not_found') return <OperatorResourceNotFound title="Saved imports unavailable">This saved import list is unavailable.</OperatorResourceNotFound>
    if (jobs.kind === 'error') return <OperatorResourceFailure title="Saved imports could not be loaded." status={jobs.status} message={jobs.message} onRetry={reloadJobs}/>
    if (!jobs.data.length) return <p className="mt-5 text-sm leading-6 text-penny-muted">No saved imports yet.</p>
    return <details className="mt-5">
      <summary className="cursor-pointer py-2 font-bold">Your saved imports</summary>
      <ul className="space-y-3">
        {jobs.data.map(item => <li key={item.id}>
          <button type="button" className="min-h-11 break-all text-left text-sm underline" disabled={busy} onClick={() => setJob(item)}>
            {item.state} · {item.checkpoint}/{item.total} · {item.id}
          </button>
        </li>)}
      </ul>
    </details>
  }

  return <article className={`${paperCardClass} min-w-0 p-5 sm:p-7`} aria-busy={busy}>
    <h2 className="text-lg font-bold text-penny-ink">Move saved feedback in</h2>
    <p className="mt-3 leading-7 text-penny-ink">Choose the CSV file Canny or UserVoice gave you; Penny reads it here and shows a preview before anything is saved. Imported requests and comments await native moderation. Internal and private comments stay private.</p>
    <p className="mt-2 text-sm leading-6 text-penny-muted">The full source is checked before anything is written. The preview names aggregates, omissions and unresolved references.</p>

    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault()
      if (source) void perform(async () => {
        setPreview(await action<Preview>('preview', source))
        setJob(null)
      })
    }}>
      <SourceBuilder disabled={busy || disabled} onSource={receiveSource}/>
      <p className="text-sm leading-6 text-penny-muted">{sourceLimitDescription}</p>
      <button className={buttonClass} disabled={busy || disabled || !source}>Preview saved feedback</button>
    </form>

    {actionExpired ? <div className="mt-4"><OperatorSessionExpired/></div> : error ? <p role="alert" className="mt-4 break-words leading-6">{error}</p> : message ? <p role="status" className="mt-4 leading-6">{message}</p> : null}

    {preview ? <div className="mt-5 space-y-5">
      <div className="space-y-3">
        <h3 className="font-bold text-penny-ink">Review the import</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {Object.entries(preview.counts.byKind).map(([kind, count]) => <div key={kind} className="flex justify-between gap-4 text-sm"><dt>{kind}</dt><dd className="tabular-nums">{count}</dd></div>)}
        </dl>
        <p className="text-sm leading-6">{preview.counts.mapped} mapped; {preview.counts.rejected} rejected; {preview.counts.unmapped} source records omitted.</p>
        {preview.erasedRecords ? <p className="text-sm leading-6">{preview.erasedRecords} {preview.erasedRecords === 1 ? 'record' : 'records'} in this file {preview.erasedRecords === 1 ? 'was' : 'were'} erased earlier, so applying it will be refused. An erased person or request cannot be brought back from a saved file.</p> : null}
      </div>

      <div className="rounded-lg border border-penny-line p-4 sm:p-5">
        <ReceiptContent receipt={preview.receipt} title="Preview receipt"/>
      </div>

      <details>
        <summary className="cursor-pointer py-2 font-bold">Mapping errors and omitted fields</summary>
        {preview.rows.length ? <ul className="space-y-3 text-sm leading-6">
          {preview.rows.filter(row => row.rejection || row.omissions.length).map((row, index) => <li key={`${row.kind}-${row.sourceId}-${index}`} className="break-words">
            <span className="font-bold">{row.kind} · <span className="break-all">{row.sourceId}</span></span>
            {row.rejection ? <p>{row.rejection}</p> : null}
            {row.omissions.map((item, omissionIndex) => <p key={omissionIndex}>{item.field ? item.field + ': ' : ''}{item.reason}</p>)}
          </li>)}
        </ul> : <p className="text-sm text-penny-muted">No row-level mapping issues were reported.</p>}
        {preview.rowsTruncated ? <p className="mt-3 text-sm leading-6 text-penny-muted">Showing {preview.rows.length} row examples{preview.rowsTotal === undefined ? '' : ` of ${preview.rowsTotal}`}. Receipt totals include the full source.</p> : null}
      </details>

      {preview.diagnostics.filter(item => !['UNMAPPED', 'REJECTED'].includes(item.code)).map((item, index) => <p key={index} className="break-words text-sm leading-6">{item.field ? item.field + ': ' : ''}{item.message}</p>)}

      <button className={buttonClass} disabled={busy || disabled || preview.counts.rejected > 0 || preview.diagnostics.some(item => item.severity === 'error') || !source} onClick={() => void perform(async () => {
        const next = await action<Job>('apply', { source, fingerprint: preview.fingerprint })
        setPreview(null)
        receiveJob(next)
      })}>Apply reviewed import</button>
    </div> : null}

    {job ? <div className="mt-5 space-y-3">
      <div className="space-y-2">
        <h3 className="font-bold text-penny-ink">Saved import</h3>
        <p className="break-all text-sm">{job.id}</p>
        <p className="text-sm">{job.state} · {job.checkpoint} of {job.total} source records</p>
        <div className="flex flex-wrap gap-3">
          {!['completed', 'undone', 'rolled_back'].includes(job.state) ? <button className={buttonClass} disabled={busy || disabled} onClick={() => void perform(async () => receiveJob(await action<Job>('jobs/' + encodeURIComponent(job.id) + '/resume', {})))}>Resume saved import</button> : null}
          {['completed', 'undoing'].includes(job.state) ? <button className={buttonClass} disabled={busy || disabled} onClick={() => void perform(async () => receiveJob(await action<Job>('jobs/' + encodeURIComponent(job.id) + '/undo', {})), job.id)}>Undo unchanged imported effects</button> : null}
          {['applying', 'failed', 'rolling_back'].includes(job.state) ? <button className={buttonClass} disabled={busy || disabled} onClick={() => void perform(async () => receiveJob(await action<Job>('jobs/' + encodeURIComponent(job.id) + '/rollback', {})))}>Roll back applied import effects</button> : null}
        </div>
      </div>
      <JobReceiptPanel key={`${job.id}-${job.state}-${job.checkpoint}`} jobId={job.id}/>
    </div> : null}

    {showJobs()}
  </article>
}
