import { buttonClass, fieldClass } from '@/core/features/auth/client-mutations'
import { disclosureChevronClass, fieldLabelClass, fileInputClass } from '@/core/ui/app/classes'
import { mutate, type Receipt } from './data-actions'
import { card, heading, lede, note, type DataPageActions } from './data-page-parts'
import { StatusLine } from './status-line'

/** Restore a backup into this empty workspace. A backup downloaded here carries its journal. */
export function RestoreCard({ actions, pendingRestore, locked, onRestored }: { actions: DataPageActions; pendingRestore: string | null; locked: boolean; onRestored: (receipt: Receipt) => Promise<void> }) {
  const { busy, perform, status } = actions
  return <details className={`group ${card}`} open={!!pendingRestore || status?.scope === 'restore'}><summary className={`${disclosureChevronClass} ${heading}`}>Restore a backup</summary><p className={lede}>Restore only into an empty, migrated workspace. Existing records and files are never overwritten. Penny restores on the server, so you can close this page once it starts.</p><p className={note}>The backup file from “Download backup” already holds its erasure journal. If anyone was erased in the source workspace after this backup was made, Penny refuses it once you also choose the source’s latest journal, so erased people never come back. Download a fresh backup from the source and restore that instead.</p>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget
      void perform('Checking the backup and starting the restore…', async () => {
        const values = new FormData(form), archiveFile = values.get('archive') as File, journalFile = values.get('journal') as File | null
        const separate = journalFile && journalFile.size > 0 ? journalFile : null
        if (archiveFile.size + (separate?.size ?? 0) > 32 * 1024 * 1024) throw new Error('The selected files exceed the 32 MiB archive limit.')
        let decoded: { archive?: unknown; journal?: unknown }, journal: unknown
        try { decoded = JSON.parse(await archiveFile.text()) as typeof decoded; journal = separate ? JSON.parse(await separate.text()) : decoded.journal } catch { throw new Error('Choose the .json backup file Penny downloaded, and the source’s latest journal if you have one.') }
        if (!journal) throw new Error('This backup file has no erasure journal inside. Also choose the source workspace’s latest journal.')
        const result = await mutate<Receipt>('import', { archive: decoded.archive ?? decoded, journal, ...(pendingRestore ? { resumeOperationId: pendingRestore } : {}) })
        await onRestored(result)
      }, 'restore')
    }}><label className={fieldLabelClass}>Backup file<input className={`${fieldClass} ${fileInputClass}`} type="file" name="archive" accept="application/json,.json" required disabled={busy} /></label><label className={fieldLabelClass}>Source’s latest erasure journal (optional)<input className={`${fieldClass} ${fileInputClass}`} type="file" name="journal" accept="application/json,.json" disabled={busy} /></label><button className={buttonClass} disabled={busy || (locked && !pendingRestore)}>{busy && status?.scope === 'restore' ? 'Restoring…' : pendingRestore ? 'Resume this restore' : 'Check and restore'}</button>{status?.scope === 'restore' ? <StatusLine status={status}/> : null}</form>
  </details>
}
