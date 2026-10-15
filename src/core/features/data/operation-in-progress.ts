import { NativeError } from '../auth/native-tokens'

type HeldOperation = { id: string | null; kind: string | null; status: string | null }
function next(operation: HeldOperation): string {
 const label = operation.kind === 'export' ? 'A workspace export' : operation.kind === 'restore' ? 'A workspace restore' : operation.kind === 'erase' ? 'A data erasure' : 'A data operation'
 let action = operation.id
  ? `Inspect operation ${operation.id} with pnpm run data:status; follow the guarded recovery steps if its runner stopped.`
  : 'Check the active operation on the Data page, then follow the guarded recovery steps.'
 if (operation.id && operation.kind === 'restore' && operation.status === 'pending') {
  action = `Resume with pnpm run data:import using --resume ${operation.id}, the same archive and latest source journal; or cancel with pnpm run data:abort-restore using ${operation.id}.`
 } else if (operation.id && operation.kind === 'erase' && ['pending_r2', 'pending_import'].includes(operation.status ?? '')) {
  action = `Resume with pnpm run data:resume-erasure using operation ${operation.id} and --journal-out.`
 }
 return `${label} is in progress. ${action} See docs/data-ownership.md for origin, owner-only session file and recovery requirements, then try again.`
}

/** A transaction guard also requires idle data custody. When a data operation
 * holds the lock, that operation is the cause the operator can act on. */
export async function dataOperationInProgress(db: D1Database): Promise<NativeError | null> {
 const held = await db.prepare("SELECT s.lock_id AS id,o.kind,o.status FROM data_state s LEFT JOIN data_operations o ON o.id=s.lock_id WHERE s.singleton=1 AND s.phase<>'idle'").first<HeldOperation>()
 if (!held) return null
 return new NativeError('data_operation_in_progress', 409, next(held))
}
