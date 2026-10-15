import { useEffect, useState } from 'react'
import { archiveJournal } from '../../../../../scripts/portability/archive-journal.mjs'
import { buttonClass } from '../../auth/client-mutations'
import { paperCardClass, secondaryButtonClass } from '../../../ui/app/classes'
import { DataActionError } from './data-actions'
async function request(path: string, body?: unknown) {
 const response = await fetch('/api/portability/exports' + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'same-origin', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
 if (!response.ok) throw new DataActionError('export_refused', response.status)
 return response
}
export function HostedExport({ disabled }: { disabled: boolean }) {
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false)
 const [files, setFiles] = useState<{ archive: string; journal: string } | null>(null)
 useEffect(() => () => { if (files) { URL.revokeObjectURL(files.archive); URL.revokeObjectURL(files.journal) } }, [files])
 async function prepare() {
  setBusy(true); setFailed(false); setFiles(null); setMessage('Preparing your private workspace export…')
  let id: string | undefined
  try {
   id = (await (await request('', {})).json() as { id: string }).id
   let status = await (await request('/' + id)).json() as { phase: string; completed: number }
   while (status.phase === 'building') status = await (await request('/' + id + '/advance', { expectedPart: status.completed, maxParts: 16 })).json() as typeof status
   if (status.phase !== 'complete') throw new Error('The export did not complete.')
   const archive = await (await request('/' + id + '/download')).blob()
   const { journal } = await archiveJournal(archive.stream())
   await request('/' + id + '/abort', {}); id = undefined
   setFiles({ archive: URL.createObjectURL(archive), journal: URL.createObjectURL(new Blob([JSON.stringify(journal) + '\n'], { type: 'application/json' })) })
   setMessage('Your export is ready. Download both files and keep them together privately.')
  } catch {
   setFailed(true); setMessage('Export could not complete. Check your owner session and the current data operation before trying again.')
  } finally {
   if (id) try { await request('/' + id + '/abort', {}) } catch { setFailed(true); setMessage('Export cleanup could not be confirmed. Recover the active export in Guarded commands before further data changes.') }
   setBusy(false)
  }
 }
 return <article className={paperCardClass + ' mt-6 p-5 sm:p-7'} aria-busy={busy}>
  <h2 className="text-lg font-bold tracking-[-0.01em] text-penny-ink">Export this workspace</h2>
  <p className="mt-3 leading-7 text-penny-ink">Download your records, original files and matching erasure journal for restore into an empty local Penny installation.</p>
  <button className={buttonClass + ' mt-4'} disabled={disabled || busy} onClick={() => void prepare()}>{busy ? 'Preparing export…' : 'Export workspace'}</button>
  {message ? <p role={failed ? 'alert' : 'status'} className="mt-3 text-sm leading-6 text-penny-muted">{message}</p> : null}
  {files ? <div className="mt-4 flex flex-wrap gap-3"><a className={secondaryButtonClass} href={files.archive} download="penny.rer">Download archive</a><a className={secondaryButtonClass} href={files.journal} download="penny.rer.erasure-journal.json">Download erasure journal</a></div> : null}
 </article>
}
