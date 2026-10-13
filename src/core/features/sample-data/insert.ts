import { getTableColumns, getTableName } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

/** Sample v1 writes only fields it owns. Later nullable/defaulted schema columns
 * must not turn a prior-version sample import into a current-schema-only write. */
export async function insertSampleRows(db: D1Database, table: SQLiteTable, records: readonly Record<string, unknown>[]) {
 if (!records.length) return
 const columns = getTableColumns(table)
 const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
 await db.batch(records.map(record => {
  const keys = Object.keys(record)
  const names = keys.map(key => {
   if (!columns[key]) throw new Error(`Unknown sample field: ${getTableName(table)}.${key}`)
   return quote(columns[key].name)
  })
  return db.prepare(`INSERT INTO ${quote(getTableName(table))}(${names.join(',')}) VALUES(${keys.map(() => '?').join(',')}) ON CONFLICT DO NOTHING`)
   .bind(...keys.map(key => typeof record[key] === 'boolean' ? Number(record[key]) : record[key]))
 }))
}
