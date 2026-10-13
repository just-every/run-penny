export const priorStamp: string
export const originalBytes: Uint8Array

export function priorClauseGraph(
 db: D1Database,
 bucket: R2Bucket,
 operatorId: string,
): Promise<{
 insert(table: string, row: Record<string, unknown>): Promise<void>
 stamped<T extends Record<string, unknown>>(row: T): Omit<T, 'created_at' | 'updated_at'> & {
  created_at: string
  updated_at: string
 }
}>
