import { createPennyRuntime } from '@/core/app/runtime'
import { failureSummary } from '@/core/app/failure-log'
import type { AppBindings } from '@/core/shared/bindings'
import type { Session } from '../../../../../base/modules/operator-auth/index.mjs'
import type { DataAuthority } from '../authority'
import { operationStep } from '../operations'
import { LEASE_MS, type ClaimRow } from './claims'
import { runSteps } from './drive'
import { importStep } from './import-steps'
import { queueDataWork } from './queue'

/** Seconds before a failed or stalled step is tried again. */
const RETRY_SECONDS = 15

/** The confirming operator's standing, or `lost` when they were removed or
 * their role changed: the work then waits for an operator to resume it. */
async function standing(db: D1Database, row: ClaimRow): Promise<DataAuthority | undefined | 'lost'> {
 if (!row.operator_id) return row.kind === 'import' ? 'lost' : undefined
 const operator = await db.prepare('SELECT * FROM oa_operators WHERE id=?').bind(row.operator_id).first<Session['operator'] & { status: string }>()
 if (!operator || operator.status !== 'active' || operator.version !== row.operator_version) return 'lost'
 return { id: 'runner:' + row.work_id, operatorId: row.operator_id, operator, standing: true }
}

/** Steps every confirmed erasure, restore and saved import that is due, as the
 * operator who confirmed it, until the budget is spent; then wakes itself for
 * whatever remains. Queue messages, the minute Cron and the Data page's own
 * reads all call this; each step is claimed, so nothing runs twice. */
export async function advanceDataWork(bindings: AppBindings, budgetMs = 20_000): Promise<void> {
 const db = bindings.DB, started = Date.now()
 const rows = (await db.prepare('SELECT * FROM data_runner_claims WHERE finished_at IS NULL AND stopped_at IS NULL ORDER BY created_at LIMIT 20').all<ClaimRow>()).results
 let wake: number | undefined
 const later = (seconds: number) => { wake = Math.min(wake ?? seconds, seconds) }
 for (const row of rows) {
  const left = budgetMs - (Date.now() - started)
  if (left <= 0) { later(0); break }
  if (row.runner && row.lease_until > Date.now()) { later((row.lease_until - Date.now()) / 1000 + 1); continue }
  // Saved imports change records, so they wait while a data operation holds the workspace.
  if (row.kind === 'import' && (await db.prepare('SELECT phase FROM data_state WHERE singleton=1').first<string>('phase')) !== 'idle') { later(30); continue }
  const authority = await standing(db, row)
  try {
   const result = await runSteps(db, row.work_id, claim => authority === 'lost' ? Promise.resolve({ state: 'stopped', code: 'operator_authority_changed' } as const)
    : row.kind === 'operation' ? operationStep(claim.db, bindings.FILES, row.work_id, authority)
     : importStep(createPennyRuntime(bindings), claim, authority!))
   // A step that needed a fresh invocation continues in the next one.
   if (result === 'more') { later(0); break }
   else if (result === 'stalled') later(RETRY_SECONDS)
   else if (result === 'busy') later(LEASE_MS / 1000)
  } catch (error) {
   // The claim recorded this failure; after repeated failures the work stops for a person.
   console.error('Penny data step failed', JSON.stringify(failureSummary(error)))
   later(RETRY_SECONDS)
  }
 }
 if (wake !== undefined) await queueDataWork(bindings.JOBS, wake)
}

export async function runDataQueue(batch: MessageBatch<unknown>, bindings: AppBindings): Promise<void> {
 await advanceDataWork(bindings, 25_000)
 batch.ackAll()
}
