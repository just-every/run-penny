import { useEffect, useState } from 'react'
import {dataChangesPause} from './maintenance-notice'
import { archiveJournal } from '../../../../../scripts/portability/archive-journal.mjs'
import { buttonClass } from '../../auth/client-mutations'
import { paperCardClass, secondaryButtonClass } from '../../../ui/app/classes'
import { DataActionError } from './data-actions'
/** Durable progress comes from the owner's locked Base job, including ready downloads. */
export type InterruptedExport = { operationId: string; status: string; jobId: string | null; phase: string | null; completed: number }
const refusals: Record<string, string> = {
 data_runner_busy: 'This export step is still running. Wait a moment, then try again.',
 data_operation_changed: 'This export changed in another tab or device. Reload the page to see its current state.',
 native_owner_session_required: 'Your owner session has ended. Sign in again, then resume or abort the export.',
 unauthenticated: 'Your owner session has ended. Sign in again, then resume or abort the export.',
 archive_limit: 'This workspace holds more records than one export archive can carry.',
}
async function call(url: string, body?: unknown) {
 const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
 if (!response.ok) {const body=await response.json().catch(() => ({})) as {error?:string;message?:string};throw new DataActionError(body.error??`http_${response.status}`,response.status,body.message)}
 return response
}
const request = (path: string, body?: unknown) => call('/api/portability/exports' + path, body)
const operationAction = (operationId: string, action: string, body: unknown) => call(`/api/operator/data/operations/${operationId}/${action}`, body)
const failure = (error: unknown) => error instanceof DataActionError&&error.code==='private_views_export_refused'?error.message:error instanceof DataActionError && refusals[error.code]
 || `The export stopped before it finished${error instanceof DataActionError ? ` (${error.code.replaceAll('_', ' ')})` : ''}. Reload this page to resume or abort the saved export.`
export function HostedExport({ disabled, interrupted, onSettled }: { disabled: boolean; interrupted: InterruptedExport | null; onSettled: () => void }) {
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
 const [elapsed, setElapsed] = useState(0)
 const [files, setFiles] = useState<{ archive: string; journal: string; jobId: string } | null>(null)
 useEffect(() => () => { if (files) { URL.revokeObjectURL(files.archive); URL.revokeObjectURL(files.journal) } }, [files])
 useEffect(() => {
  if (!busy) return
  const started = Date.now(), timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
  return () => clearInterval(timer)
 }, [busy])
 async function act(progress: string, action: () => Promise<string>) {
  setBusy(true); setFailed(false); setElapsed(0); setMessage(progress)
  try { setMessage(await action()) } catch (error) { setFailed(true); setMessage(failure(error)) } finally { setBusy(false); onSettled() }
 }
 // Only the owner's explicit confirmation recovers a stopped runner. Every old
 // runner remains fenced even if it resumes after this guarded transition.
 async function releaseStoppedStep() {
  if (interrupted?.status === 'running') await operationAction(interrupted.operationId, 'recover-runner', { expectedStatus: 'running', confirmPriorRunnerStopped: true })
 }
 async function build(resumeId?: string) {
  setFiles(null)
  const id = resumeId ?? (await (await request('', {})).json() as { id: string }).id
  let status = await (await request('/' + id)).json() as { phase: string; completed: number }
  while (status.phase === 'building') {
   setMessage(`Preparing archive: ${status.completed} parts saved. Snapshotting and checking private records and original files can take about two minutes; larger workspaces may take longer.`)
   status = await (await request('/' + id + '/advance', { expectedPart: status.completed, maxParts: 16 })).json() as typeof status
  }
  if (status.phase !== 'complete') throw new Error('The export did not complete.')
  setMessage(`All ${status.completed} archive parts prepared. Downloading and verifying the complete archive…`)
  const archive = await (await request('/' + id + '/download')).blob()
  setMessage('Checking the matching erasure journal…')
  const { journal } = await archiveJournal(archive.stream())
  // Retain the server job until the owner finishes. Blob URLs disappear on
  // reload; the durable snapshot is how the owner recovers these same files.
  setFiles({ jobId: id, archive: URL.createObjectURL(archive), journal: URL.createObjectURL(new Blob([JSON.stringify(journal) + '\n'], { type: 'application/json' })) })
  return 'Your export is ready. Save both files privately, then choose Finish export to release the workspace.'
 }
 const prepare = () => act('Taking a private workspace snapshot. This can take about two minutes; progress is saved if you reload.', () => build())
 const resume = () => act('Resuming the saved workspace export…', async () => { await releaseStoppedStep(); return build(interrupted!.jobId!) })
 const finish = () => act('Removing the saved snapshot and releasing the workspace…', async () => {
  await request('/' + files!.jobId + '/abort', {}); setFiles(null)
  return 'Export finished. The workspace is released. Keep the archive and erasure journal together privately.'
 })
 const abort = () => act('Aborting the export and releasing the workspace…', async () => {
  await releaseStoppedStep(); await operationAction(interrupted!.operationId, 'abort-export', { confirmPriorRunnerStopped: true })
  return 'Export aborted. Its saved snapshot is removed and the workspace is released.'
 })
 return <article className={paperCardClass + ' mt-6 p-5 sm:p-7'} aria-busy={busy}>
  {files ? <>
   <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">Export ready to save</h2>
   <p className="mt-3 leading-7 text-penny-ink">Download both files, then finish the export. Data changes stay paused until you finish. Reloading keeps this saved export available.</p>
   <div className="mt-4 flex flex-wrap gap-3"><a className={secondaryButtonClass} href={files.archive} download="penny.rer">Download archive</a><a className={secondaryButtonClass} href={files.journal} download="penny.rer.erasure-journal.json">Download erasure journal</a><button className={buttonClass} disabled={busy} onClick={() => void finish()}>Finish export</button></div>
  </> : interrupted ? <>
   <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">{interrupted.phase === 'complete' ? 'Export ready to download' : 'Export in progress'}</h2>
   <p className="mt-3 leading-7 text-penny-ink">{interrupted.completed} archive parts saved. {interrupted.phase === 'complete' ? 'Your complete snapshot is saved. Resume to verify and download both files, then finish the export.' : 'Your saved export can continue after a reload or a closed tab.'} Other data changes wait until it finishes or is aborted. {interrupted.jobId ? 'Resume the same export, or abort it to remove the snapshot and release the workspace.' : 'It stopped before its snapshot started, so it cannot be resumed: abort it to release the workspace, then export again.'}</p>
   <p className="mt-3 text-sm leading-6 text-penny-muted">Use these only when no other tab or device is still preparing this export.</p>
   <div className="mt-4 flex flex-wrap gap-3">
    {interrupted.jobId ? <button className={buttonClass} disabled={busy} onClick={() => void resume()}>{busy ? 'Working…' : 'Resume export'}</button> : null}
    <button className={secondaryButtonClass} disabled={busy} onClick={() => void abort()}>Abort export</button>
   </div>
  </> : <>
   <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">Export this workspace</h2>
   <p className="mt-3 leading-7 text-penny-ink">Download your records, original files and matching erasure journal for restore into an empty local Penny installation. Preparing and verifying the snapshot can take about two minutes; larger workspaces may take longer. Progress is saved if you reload. {dataChangesPause}</p>
   <button className={buttonClass + ' mt-4'} disabled={disabled || busy} onClick={() => void prepare()}>{busy ? 'Preparing export…' : 'Export workspace'}</button>
  </>}
  {message ? <p role={failed ? 'alert' : 'status'} className="mt-3 text-sm leading-6 text-penny-muted">{message}{busy ? ` Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s.` : ''}</p> : null}
 </article>
}
