import { importWorkId, readClaim } from './claims'
import { state, type WorkProgress } from './status'

/** Whether the server is carrying a saved import: null once it has settled or
 * was never handed to the server. */
export async function importWorkProgress(db: D1Database, job: string): Promise<Pick<WorkProgress, 'state' | 'reason' | 'steps'> | null> {
 const row = await readClaim(db, importWorkId(job))
 if (!row || row.finished_at !== null) return null
 return { ...state(row, Date.now()), steps: row.steps }
}
