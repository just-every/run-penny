import type { Row } from '../data/archive'
import { quote } from './native-keys'

/** Exact restoration, like Base portability, copies custody rather than
 * replaying its creation triggers. Drop/reinstall only import-kit triggers in
 * the same admitted transaction; Penny maintenance/authority fences stay live. */
export async function feedbackRestoreCustody(db:D1Database,data:Record<string,Row[]>):Promise<{before:D1PreparedStatement[];after:D1PreparedStatement[]}> {
 const {results}=await db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name GLOB 'ik_*' AND tbl_name GLOB 'ik_*' ORDER BY name").all<{name:string;sql:string}>()
 const checks:D1PreparedStatement[]=[]
 for(const [table,rows] of Object.entries(data).filter(([name])=>name.startsWith('ik_'))){
  checks.push(db.prepare(`SELECT CASE WHEN (SELECT COUNT(*) FROM ${quote(table)})=? THEN 1 ELSE json('IMPORT_RESTORE_CHANGED') END`).bind(rows.length))
  for(const row of rows){const columns=Object.keys(row);checks.push(db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quote(table)} WHERE ${columns.map(column=>quote(column)+' IS ?').join(' AND ')}) THEN 1 ELSE json('IMPORT_RESTORE_CHANGED') END`).bind(...columns.map(column=>row[column])))}
 }
 return {before:results.map(row=>db.prepare('DROP TRIGGER '+quote(row.name))),after:[...results.map(row=>db.prepare(row.sql)),...checks]}
}
