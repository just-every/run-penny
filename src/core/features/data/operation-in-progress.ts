import { NativeError } from '../auth/native-tokens'

type HeldOperation = { id: string | null; kind: string | null; status: string | null }
function next(operation: HeldOperation): string {
 if (operation.kind === 'export') return 'A workspace export is in progress. Finish or abort it on the Data page, then try again.'
 const label = operation.kind === 'restore' ? 'A workspace restore' : operation.kind === 'erase' ? 'A data erasure' : 'A data operation'
 return `${label} is in progress. Penny finishes it on the server; the Data page shows its progress. Try again once it is done.`
}

/** A transaction guard also requires idle data custody. When a data operation
 * holds the lock, that operation is the cause the operator can act on. */
export async function dataOperationInProgress(db: D1Database): Promise<NativeError | null> {
 const held = await db.prepare("SELECT s.lock_id AS id,o.kind,o.status FROM data_state s LEFT JOIN data_operations o ON o.id=s.lock_id WHERE s.singleton=1 AND s.phase<>'idle'").first<HeldOperation>()
 if (!held) return null
 return new NativeError('data_operation_in_progress', 409, next(held))
}
