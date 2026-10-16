import { NativeError } from '../auth/native-tokens'
import { applyErasure, applyRestore, dataOperation, resumeErasure, startErasure, startRestore, state } from './archive'
import type { DataAuthority } from './authority'
import { applyOperatorErasure, startOperatorErasure, type AuditResolution, type OperatorErasurePayload } from './operator-erasure'
import { runSteps, type StepOutcome } from './runner/drive'

/** One bounded step of the erasure or restore that holds the data lock, run as
 * the holder of its claim (`db` is fenced to it). An erasure first applies its
 * one transaction over the records, then saved-import cleanup step by step,
 * then deletes original files; a restore applies its staged backup. Exports
 * are driven by their own download flow and are never stepped here. */
export async function operationStep(db: D1Database, bucket: R2Bucket, id: string, authority?: DataAuthority): Promise<StepOutcome> {
 const operation = await dataOperation(db, id)
 if (!operation || ['complete', 'aborted'].includes(operation.status) || operation.kind === 'export' || (await state(db))?.lock_id !== id) return { state: 'done' }
 try {
  if (operation.kind === 'restore') {
   const result = await applyRestore(db, bucket, id, authority)
   return result.status === 'complete' ? { state: 'done' } : { state: 'stalled', code: 'files_unavailable' }
  }
  if (operation.status === 'pending') {
   const payload = JSON.parse(operation.payload_json) as { table?: string }
   if (payload.table === 'operators') await applyOperatorErasure(db, id, payload as OperatorErasurePayload, authority)
   else await applyErasure(db, id, payload, authority)
   // Saved-import cleanup steps each fill one request's budget: start them fresh.
   return (await dataOperation(db, id))?.status === 'pending_import' ? { state: 'more', fresh: true } : { state: 'more' }
  }
  const result = await resumeErasure(db, bucket, id, authority)
  if (result.status === 'complete') return { state: 'done' }
  if (result.status === 'pending_r2' && operation.status === 'pending_r2') return { state: 'stalled', code: 'files_unavailable' }
  return operation.status === 'pending_import' ? { state: 'more', fresh: true } : { state: 'more' }
 } catch (error) {
  // A refused operation has ended (nothing more runs); its caller hears why.
  if (!(error instanceof NativeError && error.code === 'data_runner_superseded') && ['complete', 'aborted'].includes((await dataOperation(db, id))?.status ?? '')) return { state: 'done', error }
  throw error
 }
}

/** Runs an operation's steps in this invocation, up to a step that needs a
 * fresh one; the server's runner continues whatever is left (runner/advance.ts). */
export async function runOperation(db: D1Database, bucket: R2Bucket, id: string, authority?: DataAuthority): Promise<{ operationId: string; status: string }> {
 await runSteps(db, id, claim => operationStep(claim.db, bucket, id, authority))
 return { operationId: id, status: (await dataOperation(db, id))?.status ?? 'aborted' }
}

/** Start-to-finish forms for callers that drive the work themselves. */
export async function eraseEntity(db: D1Database, bucket: R2Bucket, tableName: string, entityId: string, planHash: string, authority?: DataAuthority) {
 return runOperation(db, bucket, await startErasure(db, tableName, entityId, planHash, authority), authority)
}
export async function eraseOperator(db: D1Database, bucket: R2Bucket, id: string, planHash: string, authority?: DataAuthority, resolutions: AuditResolution[] = []) {
 return runOperation(db, bucket, await startOperatorErasure(db, id, planHash, authority, resolutions), authority)
}
export async function restoreArchive(db: D1Database, bucket: R2Bucket, value: unknown, journalValue: unknown, resumeId?: string, authority?: DataAuthority) {
 return runOperation(db, bucket, await startRestore(db, bucket, value, journalValue, resumeId, authority), authority)
}
