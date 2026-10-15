import { useEffect, useState } from 'react'
import { archiveJournal } from '../../../../../scripts/portability/archive-journal.mjs'
import { buttonClass } from '../../auth/client-mutations'
import { paperCardClass, secondaryButtonClass } from '../../../ui/app/classes'
import { DataActionError } from './data-actions'
/** The owner's own export that still holds the data lock, from the overview. */
export type InterruptedExport = { operationId: string; status: string; jobId: string | null }
const refusals: Record<string, string> = {
 data_runner_busy: 'This export step is still running. Wait a moment, then try again.',
 data_operation_changed: 'This export changed in another tab or device. Reload the page to see its current state.',
 native_owner_session_required: 'Your owner session has ended. Sign in again, then resume or abort the export.',
 unauthenticated: 'Your owner session has ended. Sign in again, then resume or abort the export.',
 archive_limit: 'This workspace holds more records than one export archive can carry.',
}
async function call(url: string, body?: unknown) {
 const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
 if (!response.ok) throw new DataActionError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `http_${response.status}`, response.status)
 return response
}
const request = (path: string, body?: unknown) => call('/api/portability/exports' + path, body)
const operationAction = (operationId: string, action: string, body: unknown) => call(`/api/operator/data/operations/${operationId}/${action}`, body)
// Name the refusal the server gave; only a refused session is a session problem.
const failure = (error: unknown) => error instanceof DataActionError && refusals[error.code]
 || (error instanceof Error && error.message === 'export_cleanup_unconfirmed' ? 'Export cleanup could not be confirmed. Reload this page, then abort the export.'
 : `The export stopped before it finished${error instanceof DataActionError ? ` (${error.code.replaceAll('_', ' ')})` : ''}. Reload this page: if it shows an export in progress, resume or abort it there; otherwise export again.`)
export function HostedExport({ disabled, interrupted, onSettled }: { disabled: boolean; interrupted: InterruptedExport | null; onSettled: () => void }) {
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
 const [files, setFiles] = useState<{ archive: string; journal: string } | null>(null)
 useEffect(() => () => { if (files) { URL.revokeObjectURL(files.archive); URL.revokeObjectURL(files.journal) } }, [files])
 async function act(progress: string, action: () => Promise<string>) {
  setBusy(true); setFailed(false); setMessage(progress)
  try { setMessage(await action()) } catch (error) { setFailed(true); setMessage(failure(error)) } finally { setBusy(false); onSettled() }
 }
 // An interrupted step's runner never released; the owner's button press is the
 // same stopped-runner confirmation the guarded recovery command requires.
 async function releaseStoppedStep() {
  if (interrupted?.status === 'running') await operationAction(interrupted.operationId, 'recover-runner', { expectedStatus: 'running', confirmPriorRunnerStopped: true })
 }
 async function build(resumeId?: string) {
  setFiles(null)
  // A failed fresh export is cleaned up here; a resumed one stays for the owner to resume or abort.
  let id = resumeId, cleanup: string | undefined
  try {
   if (!id) cleanup = id = (await (await request('', {})).json() as { id: string }).id
   let status = await (await request('/' + id)).json() as { phase: string; completed: number }
   while (status.phase === 'building') status = await (await request('/' + id + '/advance', { expectedPart: status.completed, maxParts: 16 })).json() as typeof status
   if (status.phase !== 'complete') throw new Error('The export did not complete.')
   const archive = await (await request('/' + id + '/download')).blob()
   const { journal } = await archiveJournal(archive.stream())
   await request('/' + id + '/abort', {}); cleanup = undefined
   setFiles({ archive: URL.createObjectURL(archive), journal: URL.createObjectURL(new Blob([JSON.stringify(journal) + '\n'], { type: 'application/json' })) })
   return 'Your export is ready. Download both files and keep them together privately.'
  } catch (error) {
   if (cleanup) try { await request('/' + cleanup + '/abort', {}) } catch { throw new Error('export_cleanup_unconfirmed') }
   throw error
  }
 }
 const prepare = () => act('Preparing your private workspace export…', () => build())
 const resume = () => act('Resuming your private workspace export…', async () => { await releaseStoppedStep(); return build(interrupted!.jobId!) })
 const abort = () => act('Aborting the export and releasing the workspace…', async () => {
  await releaseStoppedStep(); await operationAction(interrupted!.operationId, 'abort-export', { confirmPriorRunnerStopped: true })
  return 'Export aborted. Its partial snapshot is removed and the workspace is released.'
 })
 return <article className={paperCardClass + ' mt-6 p-5 sm:p-7'} aria-busy={busy}>
  {interrupted ? <>
   <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">Export in progress</h2>
   <p className="mt-3 leading-7 text-penny-ink">Your export stopped before it finished, for example because its browser tab closed. Other data changes wait until it finishes or is aborted. {interrupted.jobId ? 'Resume it to download the files, or abort it to remove the partial snapshot and release the workspace.' : 'It stopped before its snapshot started, so it cannot be resumed: abort it to release the workspace, then export again.'}</p>
   <p className="mt-3 text-sm leading-6 text-penny-muted">Use these only when no other tab or device is still preparing this export.</p>
   <div className="mt-4 flex flex-wrap gap-3">
    {interrupted.jobId ? <button className={buttonClass} disabled={busy} onClick={() => void resume()}>{busy ? 'Working…' : 'Resume export'}</button> : null}
    <button className={secondaryButtonClass} disabled={busy} onClick={() => void abort()}>Abort export</button>
   </div>
  </> : <>
   <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">Export this workspace</h2>
   <p className="mt-3 leading-7 text-penny-ink">Download your records, original files and matching erasure journal for restore into an empty local Penny installation.</p>
   <button className={buttonClass + ' mt-4'} disabled={disabled || busy} onClick={() => void prepare()}>{busy ? 'Preparing export…' : 'Export workspace'}</button>
  </>}
  {message ? <p role={failed ? 'alert' : 'status'} className="mt-3 text-sm leading-6 text-penny-muted">{message}</p> : null}
  {files ? <div className="mt-4 flex flex-wrap gap-3"><a className={secondaryButtonClass} href={files.archive} download="penny.rer">Download archive</a><a className={secondaryButtonClass} href={files.journal} download="penny.rer.erasure-journal.json">Download erasure journal</a></div> : null}
 </article>
}
