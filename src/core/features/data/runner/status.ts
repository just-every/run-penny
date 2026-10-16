import { restoreStagingKey } from '../archive'
import { LEASE_MS, readClaim, type ClaimRow } from './claims'

/** What the Data page shows for the operation holding the workspace, in the
 * page's own words (data/ui/progress-card.tsx); never a raw state name. */
export type WorkProgress = {
 stage: 'records' | 'imports' | 'files' | 'restore'
 /** working: a step is running or the next one is due; retrying: the last
  * step failed and will be tried again; waiting: no runner has picked it up;
  * stopped: it needs a person (Resume, or Cancel where nothing changed yet). */
 state: 'working' | 'retrying' | 'waiting' | 'stopped'
 steps: number
 reason: string | null
 canCancel: boolean
 needsBackup: boolean
}
type Operation = { id: string; kind: string; status: string }
const stage = (operation: Operation): WorkProgress['stage'] => operation.kind === 'restore' ? 'restore'
 : operation.status.endsWith('_import') ? 'imports' : operation.status.endsWith('_r2') ? 'files' : 'records'

export function state(row: ClaimRow | null, now: number): Pick<WorkProgress, 'state' | 'reason'> {
 // An operation started before the server runner existed waits for a person.
 if (!row) return { state: 'stopped', reason: 'stopped_before_upgrade' }
 if (row.stopped_at !== null) return { state: 'stopped', reason: row.last_error }
 if (row.runner && row.lease_until > now) return { state: 'working', reason: null }
 if (row.failures) return { state: 'retrying', reason: row.last_error }
 return { state: now - row.updated_at > LEASE_MS ? 'waiting' : 'working', reason: null }
}

export async function operationProgress(db: D1Database, bucket: R2Bucket, operation: Operation): Promise<WorkProgress> {
 const row = await readClaim(db, operation.id), current = state(row, Date.now())
 const restore = operation.kind === 'restore'
 // Cancelling is offered only before anything changed: an erasure whose records
 // are not yet removed, or a restore that has not applied its records.
 return { stage: stage(operation), ...current, steps: row?.steps ?? 0, canCancel: operation.status === 'pending' && current.state !== 'working', needsBackup: restore && !await bucket.head(restoreStagingKey(operation.id)) }
}

/** The latest erasure or restore that ended in the last day, so a person who
 * closed the tab sees how it finished. */
export async function recentOutcome(db: D1Database): Promise<{ id: string; kind: string; result: 'complete' | 'aborted'; reason: string | null; finishedAt: number } | null> {
 const row = await db.prepare("SELECT o.id,o.kind,o.status,c.last_error,c.finished_at FROM data_runner_claims c JOIN data_operations o ON o.id=c.work_id WHERE c.kind='operation' AND c.finished_at>? AND o.kind IN ('erase','restore') AND o.status IN ('complete','aborted') ORDER BY c.finished_at DESC LIMIT 1").bind(Date.now() - 86_400_000).first<{ id: string; kind: string; status: 'complete' | 'aborted'; last_error: string | null; finished_at: number }>()
 return row ? { id: row.id, kind: row.kind, result: row.status, reason: row.last_error, finishedAt: row.finished_at } : null
}

/** True when a confirmed erasure or restore is due and no runner holds it:
 * reading the Data page then wakes the runner itself (local dev has no Cron; a
 * Queue message can be lost). Saved imports continue from Queue and Cron. */
export async function dataWorkDue(db: D1Database): Promise<boolean> {
 return !!await db.prepare("SELECT 1 FROM data_runner_claims WHERE kind='operation' AND finished_at IS NULL AND stopped_at IS NULL AND (runner IS NULL OR lease_until<?) AND updated_at<? LIMIT 1").bind(Date.now(), Date.now() - 3000).first()
}
