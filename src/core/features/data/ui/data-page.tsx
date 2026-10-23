import {privateViewsRefusal} from '../../views/export-refusal'
import { HostedExport } from './hosted-export'
import { useEffect, useState } from 'react'
import { ImportPanel } from '../../imports/ui/import-panel'
import { Link } from '@tanstack/react-router'
import { buttonClass } from '@/core/features/auth/client-mutations'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { disclosureChevronClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { downloadPrivate, mutate, type Overview, type Receipt } from './data-actions'
import { card, heading, lede, type DataPageActions, type Status } from './data-page-parts'
import { RestoreCard } from './restore-card'
import { ErasureCard } from './erasure-card'
import { OutcomeCard, ProgressCard } from './progress-card'
import { StatusLine } from './status-line'

/** How often the page re-reads progress while Penny's server runner works. */
const POLL_MS = 3000

/** Backup, restore, erasure and saved-feedback import, in the app on local and hosted copies alike. */
export function DataPage() {
  const [resource, retry] = useOperatorResource<Overview>('/api/operator/data/overview')
  const [status, setStatus] = useState<Status>(null), [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  // The operation this page just started: until its own outcome arrives, an older one is not shown.
  const [started, setStarted] = useState<string | null>(null)
  const overview = resource.kind === 'ready' ? resource.data : null
  const operation = overview?.operation, stepping = operation && operation.kind !== 'export'
  const unavailable = busy || !!operation
  // Confirmed work continues on the server; the page only reads its progress.
  useEffect(() => {
    if (!stepping) return
    const timer = setInterval(retry, POLL_MS)
    return () => clearInterval(timer)
  }, [stepping, retry])
  const perform = async (progress: string, action: () => Promise<void>, scope?: 'restore') => {
    setBusy(true); setStatus({ kind: 'working', text: progress, scope })
    try { await action() } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Data action failed. Please retry.', scope })
    } finally { setBusy(false) }
  }
  const actions: DataPageActions = { busy, status, perform }
  const settled = (receipt: Receipt, done: string) => {
    setStarted(receipt.operationId)
    setStatus(receipt.status === 'complete' ? { kind: 'success', text: done } : null)
    retry()
  }
  const saveJournal = () => perform('Preparing the current erasure journal…', async () => {
    await downloadPrivate('journal', 'penny-erasure-journal.json')
    setStatus({ kind: 'success', text: 'Current journal ready to save. Keep it with your backups.' })
  })
  const resume = (id: string) => perform('Resuming on the server…', async () => {
    settled(await mutate<Receipt>('operations/' + id + '/resume', {}), 'Finished. Save the updated erasure journal with your backups.')
  })
  const cancel = (id: string, kind: string) => perform(kind === 'restore' ? 'Removing this restore’s staged files…' : 'Cancelling this erasure…', async () => {
    await mutate<null>('operations/' + id + (kind === 'restore' ? '/abort-restore' : '/abort-pending-erasure'), kind === 'restore' ? {} : { confirmPriorRunnerStopped: true })
    setStatus({ kind: 'success', text: kind === 'restore' ? 'Restore cancelled. Its staged files are removed; your backup is unchanged.' : 'Erasure cancelled. Nothing was removed.' }); retry()
  })
  if (restored) return <section><OperatorPageHeader eyebrow="Workspace data" title="Restore complete">Your records and original files are restored. Previous sessions and sign-in links are disabled.</OperatorPageHeader><Link to="/signin" className={buttonClass + ' mt-6'}>Sign in again</Link></section>
  return <section aria-busy={busy}>
    <OperatorPageHeader eyebrow="Backup and privacy" title={overview?.hosted ? 'Hosted workspace data' : 'Workspace data'} art={resource.kind === 'error' ? null : { note: 'Yours to keep.' }}>Keep a private backup of your records and original files, restore one, erase a person’s data or move saved feedback in.</OperatorPageHeader>
    {overview?.canImport ? <div className="mt-6 sm:mt-8"><ImportPanel disabled={unavailable}/></div> : null}
    {status && status.scope !== 'restore' ? <StatusLine status={status} className="mt-5"/> : null}
    {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading workspace data…"/> : resource.kind === 'session_expired' ? <OperatorSessionExpired/> : resource.kind === 'not_found' ? <OperatorResourceNotFound title="Workspace data unavailable">This data route is unavailable.</OperatorResourceNotFound> : resource.kind === 'error' ? <OperatorResourceFailure title="Workspace data could not be loaded." status={resource.status} message={resource.message} onRetry={retry}/> : overview ? <div className="mt-6 space-y-5">
      {operation?.progress ? <ProgressCard operation={operation} actions={actions} onResume={() => void resume(operation.id)} onCancel={() => void cancel(operation.id, operation.kind)}/>
        : operation?.kind === 'export' && !overview.ownExport ? <article className={card}><h2 className={heading}>Backup in progress</h2><p className={lede}>A backup of this workspace is being prepared. Other data actions wait until it is finished.</p></article> : null}
      {!operation && !busy && overview.recent && (!started || overview.recent.id === started) ? <OutcomeCard recent={overview.recent} busy={busy} onSaveJournal={() => void saveJournal()}/> : null}
      <article className={card}><h2 className={heading}>Back up this workspace</h2>{!overview.canExport?<p className={lede}>Only the workspace Owner can download a backup.</p>:null}{overview.blockedPrivateViews?<><p role="alert" data-private-view-refusal className="mt-3 text-sm leading-6 text-penny-muted">{privateViewsRefusal(overview.blockedPrivateViews)}</p><button type="button" className={secondaryButtonClass+' mt-3'} onClick={retry}>Refresh backup availability</button></>:null}<p className={lede}>One private file contains the archive and its erasure journal. Restore it here or into another Penny.</p><button className={buttonClass + ' mt-4'} disabled={unavailable||!overview.canExport||!!overview.blockedPrivateViews} onClick={() => void perform('Preparing your private backup…', async () => {
        await downloadPrivate('export', 'penny-data-bundle.json'); setStatus({ kind: 'success', text: 'Backup ready to save. Keep the file private.' })
      })}>{busy && status?.text === 'Preparing your private backup…' ? 'Preparing backup…' : 'Download backup'}</button>
        <details className="group mt-4 text-sm text-penny-muted"><summary className={disclosureChevronClass}>Backup limits and journal</summary><p className="mt-2 leading-6">One backup holds up to 2,000 records, 4 MiB of record data and 20 MiB of original files. The erasure journal lists who was erased, without their data, so an older backup can never bring them back.</p><button className={secondaryButtonClass + ' mt-3'} disabled={busy} onClick={() => void saveJournal()}>Download current journal separately</button></details>
      </article>
      {overview.hosted && overview.canExport ? <HostedExport disabled={!!operation||!!overview.blockedPrivateViews} interrupted={overview.ownExport && operation ? { operationId: operation.id, status: operation.status, ...overview.ownExport } : null} onSettled={retry}/> : null}
      <RestoreCard actions={actions} pendingRestore={operation?.kind === 'restore' && operation.progress?.needsBackup ? operation.id : null} locked={!!operation} onRestored={async receipt => {
        if (receipt.status === 'complete') setRestored(true)
        else { setStarted(receipt.operationId); setStatus({ kind: 'success', text: 'Penny is restoring this backup on the server. You can close this page; it finishes on its own.', scope: 'restore' }); retry() }
      }}/>
      <ErasureCard overview={overview} actions={actions} unavailable={unavailable} onErasing={async receipt => settled(receipt, 'Erased. The record, its history and original files are gone; records other people share stay without its words. Save the updated erasure journal with your backups.')}/>
    </div> : null}
  </section>
}
