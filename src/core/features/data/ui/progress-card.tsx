import { buttonClass } from '@/core/features/auth/client-mutations'
import { formatMoment } from '@/core/app/ui/operator-format'
import { secondaryButtonClass } from '@/core/ui/app/classes'
import { reasonText, type Overview, type Progress } from './data-actions'
import { card, heading, lede, note, type DataPageActions } from './data-page-parts'

const stages: Record<Progress['stage'], string> = {
  records: 'Removing the reviewed records.',
  imports: 'Removing this person from saved imports.',
  files: 'Deleting original files.',
  restore: 'Restoring records and original files.',
}

/** The erasure or restore holding the workspace, as Penny's server runner
 * reports it: what it is doing now, and Resume or Cancel when it needs a person. */
export function ProgressCard({ operation, actions, onResume, onCancel }: { operation: NonNullable<Overview['operation']>; actions: DataPageActions; onResume: () => void; onCancel: () => void }) {
  const progress = operation.progress!, restore = operation.kind === 'restore', { busy } = actions
  const title = restore ? 'Restoring a backup' : 'Erasing personal data'
  const step = progress.steps > 1 ? ` Step ${progress.steps}.` : ''
  const body = progress.state === 'working'
    ? <p className={lede}>{stages[progress.stage]}{step} Penny does this on the server: you can close this page and come back. Other data actions wait until it finishes.</p>
    : progress.state === 'retrying'
      ? <p className={lede}>{stages[progress.stage]} The last step did not finish: {reasonText(progress.reason)} Penny tries again automatically.</p>
      : progress.state === 'waiting'
        ? <p className={lede}>{stages[progress.stage]} It is waiting to continue. Resume it to carry on now.</p>
        : <p className={lede}>{restore ? 'This restore' : 'This erasure'} has stopped. {reasonText(progress.reason)}</p>
  // Records already removed cannot come back, so an erasure past its first step can only finish.
  const finishOnly = !restore && !progress.canCancel && operation.status !== 'pending'
  return <article className={card} aria-live="polite">
    <h2 className={heading}>{title}</h2>
    {body}
    {finishOnly && progress.state !== 'working' ? <p className={note}>The person’s records are already gone. Resuming removes the remaining copies and files.</p> : null}
    {restore && progress.needsBackup && progress.state !== 'working' ? <p className={note}>Penny no longer has this backup’s upload. Choose the same backup file under Restore a backup to resume, or cancel to release the workspace.</p> : null}
    {progress.state === 'working' ? null : <div className="mt-4 flex flex-wrap gap-3">
      {restore && progress.needsBackup ? null : <button className={buttonClass} disabled={busy} onClick={onResume}>{progress.state === 'stopped' ? 'Resume' : 'Resume now'}</button>}
      {progress.canCancel ? <button className={secondaryButtonClass} disabled={busy} onClick={onCancel}>{restore ? 'Cancel this restore' : 'Cancel this erasure'}</button> : null}
    </div>}
  </article>
}

/** How the last erasure or restore ended, for a person who closed the tab. */
export function OutcomeCard({ recent, onSaveJournal, busy }: { recent: NonNullable<Overview['recent']>; onSaveJournal: () => void; busy: boolean }) {
  const when = formatMoment(recent.finishedAt), erase = recent.kind === 'erase'
  const text = recent.result === 'complete'
    ? erase ? `Erasure finished ${when}. The record, its history and original files are gone; records other people share stay without its words. Save the updated erasure journal with your backups.` : `Restore finished ${when}. Records and original files are restored. Earlier sign-in links from the backup are disabled.`
    : recent.reason ? `${erase ? 'The erasure' : 'The restore'} did not run (${when}): ${reasonText(recent.reason)} Nothing was ${erase ? 'removed' : 'restored'}.` : `${erase ? 'The erasure' : 'The restore'} was cancelled ${when}. Nothing was ${erase ? 'removed' : 'restored'}.`
  return <article className={card}>
    <h2 className={heading}>{erase ? 'Last erasure' : 'Last restore'}</h2>
    <p className={lede}>{text}</p>
    {erase && recent.result === 'complete' ? <button className={buttonClass + ' mt-4'} disabled={busy} onClick={onSaveJournal}>Download current journal</button> : null}
  </article>
}
