import { buttonClass, fieldClass } from '@/core/features/auth/client-mutations'
import { disclosureChevronClass, fieldLabelClass, fileInputClass } from '@/core/ui/app/classes'
import { mutate, type Receipt } from './data-actions'
import { card, heading, lede, note, type DataPageActions } from './data-page-parts'

/** Restore a backup into this empty workspace. A backup downloaded here carries its journal; a newer journal replaces it. */
export function RestoreCard({ actions, pendingRestore, locked, onRestored }: { actions: DataPageActions; pendingRestore: string | null; locked: boolean; onRestored: (complete: boolean) => Promise<void> }) {
  const { busy, perform, status } = actions
  return <details className={`group ${card}`} open={!!pendingRestore}><summary className={`${disclosureChevronClass} ${heading}`}>Restore a backup</summary><p className={lede}>Restore only into an empty, migrated workspace. Existing records and files are never overwritten.</p><p className={note}>The backup file from “Download backup” already holds its erasure journal. If anyone erased records in the source workspace after that backup, also choose the source’s latest journal (Download current journal) so those erasures stay erased.</p>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget
      void perform('Checking the backup and restoring records and files…', async () => {
        const values = new FormData(form), archiveFile = values.get('archive') as File, journalFile = values.get('journal') as File | null
        const separate = journalFile && journalFile.size > 0 ? journalFile : null
        if (archiveFile.size + (separate?.size ?? 0) > 32 * 1024 * 1024) throw new Error('The selected files exceed the 32 MiB archive limit.')
        let decoded: { archive?: unknown; journal?: unknown }, journal: unknown
        try { decoded = JSON.parse(await archiveFile.text()) as typeof decoded; journal = separate ? JSON.parse(await separate.text()) : decoded.journal } catch { throw new Error('Choose the .json backup file Penny downloaded, and its journal if you have a newer one.') }
        if (!journal) throw new Error('This backup file has no erasure journal inside. Also choose the source workspace’s latest journal.')
        const result = await mutate<Receipt>('import', { archive: decoded.archive ?? decoded, journal, ...(pendingRestore ? { resumeOperationId: pendingRestore } : {}) })
        await onRestored(result.status === 'complete')
      })
    }}><label className={fieldLabelClass}>Backup file<input className={`${fieldClass} ${fileInputClass}`} type="file" name="archive" accept="application/json,.json" required disabled={busy} /></label><label className={fieldLabelClass}>Newer erasure journal (optional)<input className={`${fieldClass} ${fileInputClass}`} type="file" name="journal" accept="application/json,.json" disabled={busy} /></label><button className={buttonClass} disabled={busy || (locked && !pendingRestore)}>{busy && status?.text.startsWith('Checking the backup') ? 'Restoring…' : pendingRestore ? 'Resume this restore' : 'Check and restore'}</button></form>
  </details>
}
