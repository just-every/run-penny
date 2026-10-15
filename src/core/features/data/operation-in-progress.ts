import { NativeError } from '../auth/native-tokens'

const next: Record<string, string> = {
 export: 'A workspace export is in progress. Resume or abort it on the Data page, then try again.',
 restore: 'A workspace restore is in progress. Resume or cancel it on the Data page, then try again.',
 erase: 'A data erasure is in progress. Resume it on the Data page, then try again.',
}

/** A transaction guard also requires idle data custody. When a data operation
 * holds the lock, that operation is the cause the operator can act on. */
export async function dataOperationInProgress(db: D1Database): Promise<NativeError | null> {
 const held = await db.prepare("SELECT o.kind FROM data_state s LEFT JOIN data_operations o ON o.id=s.lock_id WHERE s.singleton=1 AND s.phase<>'idle'").first<{ kind: string | null }>()
 if (!held) return null
 return new NativeError('data_operation_in_progress', 409, next[held.kind ?? ''] ?? 'A data operation is in progress. Finish it on the Data page, then try again.')
}
