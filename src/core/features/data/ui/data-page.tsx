import { HostedExport } from './hosted-export'
import { useState } from 'react'
import { ImportPanel } from '../../imports/ui/import-panel'
import { Link, useRouter } from '@tanstack/react-router'
import { buttonClass, fieldClass } from '@/core/features/auth/client-mutations'
import { OperatorPageHeader } from '@/core/app/ui/operator-page-header'
import { dangerButtonClass, disclosureChevronClass, fieldLabelClass, fileInputClass, paperCardClass, secondaryButtonClass } from '@/core/ui/app/classes'
import { useOperatorResource } from '@/core/app/ui/operator-resource'
import { AuditCopyChoices } from './audit-copy-choices'
import { OperatorResourceFailure, OperatorResourceLoading, OperatorResourceNotFound, OperatorSessionExpired } from '@/core/app/ui/operator-resource-state'
import { DataActionError, auditCopyId, downloadPrivate, entityLabels, mutate, previewErasure, recordLabel, type AuditChoices, type Overview, type Plan, type Receipt } from './data-actions'
const card = `${paperCardClass} p-5 sm:p-7`
const secondary = secondaryButtonClass
const heading = 'text-lg font-bold tracking-[-0.01em] text-penny-ink'
const lede = 'mt-3 leading-7 text-penny-ink'
const note = 'mt-3 text-sm leading-6 text-penny-muted'
type Status = { kind: 'working' | 'success' | 'error'; text: string } | null
export function DataPage() {
  const [resource,retry] = useOperatorResource<Overview>('/api/operator/data/overview')
  const [status, setStatus] = useState<Status>(null), [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null), [target, setTarget] = useState(''), [auditChoices, setAuditChoices] = useState<AuditChoices>({})
  const [restored, setRestored] = useState(false), [journalNeeded, setJournalNeeded] = useState(false)
  const router = useRouter(), overview = resource.kind === 'ready' ? resource.data : null
  const operation = overview?.operation, pendingRestore = operation?.kind === 'restore' && operation.status === 'pending' ? operation.id : null
  const unavailable = busy || !!operation
  const perform = async (progress: string, action: () => Promise<void>) => {
    setBusy(true); setStatus({ kind: 'working', text: progress })
    try { await action() } catch (error) {
      if (error instanceof DataActionError && error.code === 'erasure_plan_changed') setPlan(null)
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Data action failed. Please retry.' })
    } finally { setBusy(false) }
  }
  const saveJournal = () => perform('Preparing the current erasure journal…', async () => {
    await downloadPrivate('journal', 'penny-erasure-journal.json'); setJournalNeeded(false)
    setStatus({ kind: 'success', text: 'Current journal ready to save. Keep it with your backups.' })
  })
  if (overview?.hosted) return <HostedData overview={overview}/>
  if (restored) return <section><OperatorPageHeader eyebrow="Workspace data" title="Restore complete">Your records and original files are restored. Previous sessions and sign-in links are disabled.</OperatorPageHeader><Link to="/signin" className={buttonClass + ' mt-6'}>Sign in again</Link></section>
  return <section aria-busy={busy}>
    <OperatorPageHeader eyebrow="Backup and privacy" title="Workspace data" art={resource.kind === 'error' ? null : { note: 'Yours to keep.' }}>Keep a private backup of your records and original files.</OperatorPageHeader>
    <div className="mt-6 sm:mt-8"><ImportPanel disabled={unavailable}/></div>
    {status ? <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-lg border bg-penny-card p-4 text-sm leading-6 font-medium text-penny-ink ${status.kind === 'error' ? 'border-penny-danger' : 'border-penny-line-strong/60'}`}>{status.text}</p> : null}
    {resource.kind === 'loading' ? <OperatorResourceLoading label="Loading workspace data…"/> : resource.kind === 'session_expired' ? <OperatorSessionExpired/> : resource.kind === 'not_found' ? <OperatorResourceNotFound title="Workspace data unavailable">This data route is unavailable.</OperatorResourceNotFound> : resource.kind === 'error' ? <OperatorResourceFailure title="Workspace data could not be loaded." status={resource.status} onRetry={retry}/> : overview ? <div className="mt-6 space-y-5">
      {operation ? <article className={card}>
        <h2 className={heading}>{operation.kind === 'restore' ? 'Restore in progress' : operation.kind === 'erase' ? 'Erasure in progress' : 'Backup in progress'}</h2>
        {operation.kind === 'erase' && ['pending_r2','pending_import'].includes(operation.status) ? <><p className={lede}>Erasure is paused while retained history and original files are removed. The workspace stays locked until cleanup completes.</p><button className={buttonClass + ' mt-4'} disabled={busy} onClick={() => void perform('Removing the remaining retained copies…', async () => {
          const result = await mutate<Receipt>('operations/' + operation.id + '/resume', {})
          setJournalNeeded(true); setStatus({ kind: 'success', text: result.status === 'complete' ? 'Erasure complete. Save the updated journal with your backups.' : 'More retained copies remain. Resume erasure to continue the saved operation.' }); await router.invalidate()
        })}>Resume erasure</button></> : pendingRestore ? <><p className={lede}>Select the same backup and journal below to resume. Or remove this restore’s staged files and release the workspace.</p><button className={secondary + ' mt-4'} disabled={busy} onClick={() => void perform('Removing this restore’s staged files…', async () => {
          await mutate<null>('operations/' + operation.id + '/abort-restore', {}); setStatus({ kind: 'success', text: 'Restore cancelled. Its staged files are removed; your backup is unchanged.' }); await router.invalidate()
        })}>Cancel this restore</button></> : <p className={lede}>A previous data operation is still running or stopped unexpectedly. Other data actions are paused until it is safely recovered.</p>}
        <details className="group mt-4 text-sm text-penny-muted"><summary className={disclosureChevronClass}>Operation details</summary><p className="mt-2 break-all tabular-nums">{operation.id} · {operation.status}</p></details>
      </article> : null}
      {journalNeeded ? <article className={card}><h2 className={heading}>Save the updated erasure journal</h2><p className={lede}>Keep the current journal separately from older backups.</p><button className={buttonClass + ' mt-4'} disabled={busy} onClick={() => void saveJournal()}>Download current journal</button></article> : null}
      <article className={card}><h2 className={heading}>Back up this workspace</h2><p className={lede}>One private file contains the archive and its erasure journal.</p><button className={buttonClass + ' mt-4'} disabled={unavailable} onClick={() => void perform('Preparing your private backup…', async () => {
        await downloadPrivate('export', 'penny-data-bundle.json'); setStatus({ kind: 'success', text: 'Backup ready to save. Keep the file private.' })
      })}>{busy && status?.text === 'Preparing your private backup…' ? 'Preparing backup…' : 'Download backup'}</button>
        <details className="group mt-4 text-sm text-penny-muted"><summary className={disclosureChevronClass}>Backup limits and journal</summary><p className="mt-2 leading-6">Format v1: 2,000 records, 4 MiB of record data, 20 MiB of original files. Erasure epoch {overview.epoch}.</p><button className={secondary + ' mt-3'} disabled={busy} onClick={() => void saveJournal()}>Download current journal separately</button></details>
      </article>
      <details className={`group ${card}`} open={!!pendingRestore}><summary className={`${disclosureChevronClass} ${heading}`}>Restore a backup</summary><p className={lede}>Restore only into an empty, migrated workspace. Existing records and files are never overwritten.</p><p className={note}>A new workspace cannot verify journal freshness. Obtain the latest journal from the source before restoring; keep it separately from the backup.</p>
        <form className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget
          void perform('Checking the backup and restoring records and files…', async () => {
            const values = new FormData(form), archiveFile = values.get('archive') as File, journalFile = values.get('journal') as File
            if (archiveFile.size + journalFile.size > 32 * 1024 * 1024) throw new Error('The selected files exceed the 32 MiB archive limit.')
            const decoded = JSON.parse(await archiveFile.text()), journal = JSON.parse(await journalFile.text())
            const result = await mutate<Receipt>('import', { archive: decoded.archive ?? decoded, journal, ...(pendingRestore ? { resumeOperationId: pendingRestore } : {}) })
            if (result.status === 'complete') setRestored(true)
            else { setStatus({ kind: 'success', text: 'Restore paused. Keep the original backup and journal to resume, or cancel its staged files.' }); await router.invalidate() }
          })
        }}><label className={fieldLabelClass}>Backup file<input className={`${fieldClass} ${fileInputClass}`} type="file" name="archive" accept="application/json,.json" required disabled={busy} /></label><label className={fieldLabelClass}>Latest source erasure journal<input className={`${fieldClass} ${fileInputClass}`} type="file" name="journal" accept="application/json,.json" required disabled={busy} /></label><button className={buttonClass} disabled={busy || (!!operation && !pendingRestore)}>{busy && status?.text.startsWith('Checking the backup') ? 'Restoring…' : pendingRestore ? 'Resume this restore' : 'Check and restore'}</button></form>
      </details>
      <details className={`group ${card}`}><summary className={`${disclosureChevronClass} ${heading}`}>Erase personal data</summary><p className={lede}>Preview the record, its history and original files before permanently erasing them. Protected operator identities cannot be erased here.</p>
        <form className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault(); void perform('Checking dependent records and original files…', async () => {
            const selected = overview.targets.find(item => `${item.table}:${item.id}` === target)
            if (!selected) throw new Error('Choose a record first.')
            setPlan(await previewErasure(selected.table,selected.id)); setAuditChoices({}); setStatus(null)
          })
        }}><label className={fieldLabelClass}>Record<select className={fieldClass} required value={target} disabled={unavailable} onChange={event => { setTarget(event.target.value); setPlan(null) }}><option value="">Choose a record</option>{Object.entries(entityLabels).map(([table, label]) => <optgroup key={table} label={label}>{overview.targets.filter(item => item.table === table).map(item => <option key={item.id} value={`${table}:${item.id}`}>{item.label} · {item.id.slice(-8)}</option>)}</optgroup>)}</select></label><button className={secondary} disabled={unavailable}>Preview erasure</button></form>
        {plan ? <div className="mt-5 border-t border-penny-line pt-5"><h3 className="font-bold text-penny-ink">Confirm permanent erasure</h3><p className="mt-3 break-words text-base font-bold text-penny-ink">{overview.targets.find(item => item.table === plan.table && item.id === plan.id)?.label ?? "Selected record"}</p><p className="mt-2 break-all text-sm text-penny-muted">{entityLabels[plan.table]} · {plan.id}</p><dl className="mt-4 grid gap-x-8 gap-y-2 text-sm text-penny-ink sm:grid-cols-2">{Object.entries(plan.counts).map(([table, count]) => <div key={table} className="flex min-w-0 justify-between gap-3"><dt className="break-words">{recordLabel(table)}</dt><dd className="shrink-0 font-bold tabular-nums">{count}</dd></div>)}</dl><p className="mt-3 text-sm text-penny-ink">Original files to delete: {plan.fileCount}.</p>
          {plan.table === 'requesters' && plan.counts.requests ? <p className="mt-3 text-sm leading-6 text-penny-ink">This person created {plan.counts.requests === 1 ? 'a request' : `${plan.counts.requests} requests`}. Erasing them also removes {plan.counts.requests === 1 ? 'it' : 'those requests'} and every vote and comment other people added to {plan.counts.requests === 1 ? 'it' : 'them'}.</p> : null}
          {plan.blockedCopies.some(copy => !copy.resolvable) ? <p role="alert" className="mt-4 text-sm leading-6 font-semibold text-penny-danger">Erasure blocked: {plan.blockedCopies.filter(copy => !copy.resolvable).length} unrelated records contain copied wording. Review their provenance before proceeding.</p> : <><p className="mt-4 text-sm leading-6 text-penny-ink">This permanently removes the reviewed records and files. Retained audit references are anonymized.</p>{plan.blockedCopies.length ? <AuditCopyChoices copies={plan.blockedCopies} value={auditChoices} onChange={setAuditChoices} disabled={unavailable} /> : null}<button className={dangerButtonClass + ' mt-4'} disabled={unavailable || plan.blockedCopies.some(copy => !auditChoices[auditCopyId(copy)])} onClick={() => void perform('Erasing the reviewed records and original files…', async () => {
            const result = await mutate<Receipt>('erasure', { table: plan.table, id: plan.id, planHash: plan.planHash, ...(plan.blockedCopies.length ? { auditCopies: plan.blockedCopies.map(copy => ({ id: auditCopyId(copy), resolution: auditChoices[auditCopyId(copy)] })) } : {}) }); setPlan(null); setTarget(''); setJournalNeeded(true)
            setStatus({ kind: 'success', text: result.status === 'complete' ? 'Erasure complete. Save the updated journal with your backups.' : 'Native records are erased; retained history cleanup remains. Resume it above to complete erasure.' }); await router.invalidate()
          })}>Permanently erase reviewed data</button></>}
        </div> : null}
        <p className="mt-4 text-sm leading-6 text-penny-muted">The list shows the 100 most recent records for each entity.</p>
      </details>
    </div> : null}
  </section>
}

function HostedData({overview}:{overview:Overview}){
 return <section><OperatorPageHeader eyebrow="Backup and privacy" title="Hosted workspace data">Restore and erasure use the authenticated API and CLI with current operator authority.</OperatorPageHeader><article className={card+' mt-6'}><h2 className={heading}>Current data state</h2><p className={lede}>Erasure epoch {overview.epoch}. {overview.operation?`${overview.operation.kind} operation ${overview.operation.status}.`:'No data operation is active.'}</p>{overview.operation?<p className={note}>Operation ID: <span className="break-all">{overview.operation.id}</span></p>:null}<p className={note}>Use an owner-only session file. Restore requires an empty destination and the latest separate source erasure journal. Erasure requires a fresh preview hash.</p></article>{overview.canExport?<HostedExport disabled={!!overview.operation}/>:null}<article className={card+' mt-6'}><h2 className={heading}>Guarded commands</h2>{Object.entries(overview.commands).map(([name,command])=><div key={name} className="mt-5"><h3 className="text-sm font-bold capitalize">{name}</h3><code className="mt-2 block whitespace-pre-wrap break-all text-sm leading-6 text-penny-ink">{command}</code></div>)}<p className={note}>Replace ROOT_ID and OPERATION_ID with the reviewed record or active operation. These commands change the hosted installation when you run them.</p></article></section>
}
