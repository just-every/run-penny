import { auditCursor, type AuditQuery } from './input'

// Match the existing agent audit projection. Never load details, person records,
// customer wording, commercial context or credential tables into this reader.
export const auditColumns = [
  'id', 'actor_type', 'actor_id', 'action', 'entity_type', 'entity_id', 'occurred_at',
  'agent_id', 'agent_name', 'sponsor_native_id', 'prepared_by', 'approvers_json', 'door_operation_id',
] as const
export type AuditEntry = Record<typeof auditColumns[number], string | null>

export async function readAudit(db: D1Database, input: AuditQuery) {
  // A rowid high-water mark also excludes later appends with backdated or equal
  // timestamps. It is pagination metadata only, never an event identity.
  const ceiling = input.cursor?.ceiling ?? await db.prepare('SELECT COALESCE(MAX(rowid),0) AS ceiling FROM audit_entries').first<number>('ceiling') ?? 0
  const conditions = ['rowid <= ?'], params: (string | number)[] = [ceiling]
  for (const [key, column] of [['actor', 'actor_id'], ['action', 'action'], ['subject', 'entity_id'], ['subjectType', 'entity_type']] as const) {
    if (input[key]) { conditions.push(`${column} = ?`); params.push(input[key]) }
  }
  if (input.from) { conditions.push('occurred_at >= ?'); params.push(input.from) }
  if (input.to) { conditions.push('occurred_at <= ?'); params.push(input.to) }
  const count = db.prepare(`SELECT COUNT(*) AS total FROM audit_entries WHERE ${conditions.join(' AND ')}`).bind(...params)
  if (input.cursor) {
    conditions.push('(occurred_at < ? OR (occurred_at = ? AND id < ?))')
    params.push(input.cursor.occurredAt, input.cursor.occurredAt, input.cursor.id)
  }
  const [counted, rows] = await db.batch<AuditEntry & { total: number }>([
    count,
    db.prepare(`SELECT ${auditColumns.join(',')} FROM audit_entries WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC,id DESC LIMIT ?`).bind(...params, input.limit + 1),
  ])
  const items: AuditEntry[] = rows.results.slice(0, input.limit), last = items.at(-1)
  const nextCursor = rows.results.length > input.limit && last ? auditCursor({ version: 1, ceiling, filter: input.filter, occurredAt: last.occurred_at!, id: last.id! }) : null
  return { items, total: counted.results[0].total, nextCursor }
}

const cell = (value: string | null) => {
  const text = value ?? ''
  return '"' + (/^\s*[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
}
export function auditCsv(items: AuditEntry[]): string {
  return [auditColumns.map(cell).join(','), ...items.map(row => auditColumns.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n'
}
