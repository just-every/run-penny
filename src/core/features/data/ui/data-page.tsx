import { HostedExport } from './hosted-export'
import { useState } from 'react'
import { ImportPanel } from '../../imports/ui/import-panel'
import { Link, useRouter } from '@tanstack/react-router'
import { buttonClass } from '@/core/features/auth/client-mutations'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { disclosureChevronClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { downloadPrivate, mutate, type Overview, type Receipt } from './data-actions'
import { card, heading, lede, note, type DataPageActions, type Status } from './data-page-parts'
import { RestoreCard } from './restore-card'
import { ErasureCard } from './erasure-card'

/** Backup, restore, erasure and saved-feedback import, in the app on local and hosted copies alike. */
export function DataPage() {
  const [resource, retry] = useOperatorResource<Overview>('/api/operator/data/overview')
  const [status, setStatus] = useState<Status>(null), [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false), [journalNeeded, setJournalNeeded] = useState(false)
  const router = useRouter(), overview = resource.kind === 'ready' ? resource.data : null
  const operation = overview?.operation, pendingRestore = operation?.kind === 'restore' && operation.status === 'pending' ? operation.id : null
  const unavailable = busy || !!operation
  const perform = async (progress: string, action: () => Promise<void>) => {
    setBusy(true); setStatus({ kind: 'working', text: progress })
    try { await action() } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Data action failed. Please retry.' })
    } finally { setBusy(false) }
  }
  const actions: DataPageActions = { busy, status, perform }
  // Retained-history cleanup runs in bounded steps; keep stepping while this page is open.
  const finishErasure = async (operationId: string, status: string) => {
    for (let step = 1; status !== 'complete'; step++) {
      setStatus({ kind: 'working', text: `Removing retained history and original files… step ${step}. Keep this page open.` })
      status = (await mutate<Receipt>('operations/' + operationId + '/resume', {})).status
    }
    setJournalNeeded(true); setStatus({ kind: 'success', text: 'Erased. The record, its history and original files are gone. Save the updated journal with your backups.' }); await router.invalidate()
  }
  const saveJournal = () => perform('Preparing the current erasure journal…', async () => {
    await downloadPrivate('journal', 'penny-erasure-journal.json'); setJournalNeeded(false)
    setStatus({ kind: 'success', text: 'Current journal ready to save. Keep it with your backups.' })
  })
  if (restored) return <section><OperatorPageHeader eyebrow="Workspace data" title="Restore complete">Your records and original files are restored. Previous sessions and sign-in links are disabled.</OperatorPageHeader><Link to="/signin" className={buttonClass + ' mt-6'}>Sign in again</Link></section>
  return <section aria-busy={busy}>
    <OperatorPageHeader eyebrow="Backup and privacy" title={overview?.hosted ? 'Hosted workspace data' : 'Workspace data'} art={resource.kind === 'error' ? null : { note: 'Yours to keep.' }}>Keep a private backup of your records and original files, restore one, erase a person’s data or move saved feedback in.</OperatorPageHeader>
    <div className="mt-6 sm:mt-8"><ImportPanel disabled={unavailable}/></div>
    {status ? <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-lg border bg-penny-card p-4 text-sm leading-6 font-medium text-penny-ink ${status.kind === 'error' ? 'border-penny-danger' : 'border-penny-line-strong/60'}`}>{status.text}</p> : null}
    {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading workspace data…"/> : resource.kind === 'session_expired' ? <OperatorSessionExpired/> : resource.kind === 'not_found' ? <OperatorResourceNotFound title="Workspace data unavailable">This data route is unavailable.</OperatorResourceNotFound> : resource.kind === 'error' ? <OperatorResourceFailure title="Workspace data could not be loaded." status={resource.status} message={resource.message} onRetry={retry}/> : overview ? <div className="mt-6 space-y-5">
      {overview.hosted ? <article className={card}><h2 className={heading}>Current data state</h2><p className={lede}>Erasure epoch {overview.epoch}. {operation ? `${operation.kind} operation ${operation.status}.` : 'No data operation is active.'}</p>{operation ? <p className={note}>Operation ID: <span className="break-all">{operation.id}</span></p> : null}</article> : null}
      {operation ? <article className={card}>
        <h2 className={heading}>{operation.kind === 'restore' ? 'Restore in progress' : operation.kind === 'erase' ? 'Erasure in progress' : 'Backup in progress'}</h2>
        {operation.kind === 'erase' && ['pending_r2','pending_import'].includes(operation.status) ? <><p className={lede}>Erasure is paused while retained history and original files are removed. The workspace stays locked until cleanup completes.</p><button className={buttonClass + ' mt-4'} disabled={busy} onClick={() => void perform('Removing the remaining retained copies…', () => finishErasure(operation.id, operation.status))}>Resume erasure</button></> : pendingRestore ? <><p className={lede}>Select the same backup and journal below to resume. Or remove this restore’s staged files and release the workspace.</p><button className={secondaryButtonClass + ' mt-4'} disabled={busy} onClick={() => void perform('Removing this restore’s staged files…', async () => {
          await mutate<null>('operations/' + operation.id + '/abort-restore', {}); setStatus({ kind: 'success', text: 'Restore cancelled. Its staged files are removed; your backup is unchanged.' }); await router.invalidate()
        })}>Cancel this restore</button></> : <p className={lede}>A previous data operation is still running or stopped unexpectedly. Other data actions are paused until it is safely recovered.</p>}
        <details className="group mt-4 text-sm text-penny-muted"><summary className={disclosureChevronClass}>Operation details</summary><p className="mt-2 break-all tabular-nums">{operation.id} · {operation.status}</p></details>
      </article> : null}
      {journalNeeded ? <article className={card}><h2 className={heading}>Save the updated erasure journal</h2><p className={lede}>Keep the current journal separately from older backups.</p><button className={buttonClass + ' mt-4'} disabled={busy} onClick={() => void saveJournal()}>Download current journal</button></article> : null}
      <article className={card}><h2 className={heading}>Back up this workspace</h2><p className={lede}>One private file contains the archive and its erasure journal. Restore it here or into another Penny.</p><button className={buttonClass + ' mt-4'} disabled={unavailable} onClick={() => void perform('Preparing your private backup…', async () => {
        await downloadPrivate('export', 'penny-data-bundle.json'); setStatus({ kind: 'success', text: 'Backup ready to save. Keep the file private.' })
      })}>{busy && status?.text === 'Preparing your private backup…' ? 'Preparing backup…' : 'Download backup'}</button>
        <details className="group mt-4 text-sm text-penny-muted"><summary className={disclosureChevronClass}>Backup limits and journal</summary><p className="mt-2 leading-6">Format v1: 2,000 records, 4 MiB of record data, 20 MiB of original files. Erasure epoch {overview.epoch}.</p><button className={secondaryButtonClass + ' mt-3'} disabled={busy} onClick={() => void saveJournal()}>Download current journal separately</button></details>
      </article>
      {overview.hosted && overview.canExport ? <HostedExport disabled={!!operation} interrupted={overview.ownExport && operation ? { operationId: operation.id, status: operation.status, ...overview.ownExport } : null} onSettled={retry}/> : null}
      <RestoreCard actions={actions} pendingRestore={pendingRestore} locked={!!operation} onRestored={async complete => {
        if (complete) setRestored(true)
        else { setStatus({ kind: 'success', text: 'Restore paused. Keep the original backup and journal to resume, or cancel its staged files.' }); await router.invalidate() }
      }}/>
      <ErasureCard overview={overview} actions={actions} unavailable={unavailable} onErasing={receipt => finishErasure(receipt.operationId, receipt.status)}/>
    </div> : null}
  </section>
}
