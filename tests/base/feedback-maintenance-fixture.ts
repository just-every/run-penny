import {expect} from 'vitest'
import {env} from './support'
import type {Row} from '@/core/features/data/archive'

// Exercise the retained product storage itself with populated rows. A phase
// change without the operation's durable claim must never open its write fence.
export async function checkFeedbackMaintenance() {
 const tables=['feedback_import_bundles','feedback_import_original_chunks','feedback_import_receipt_notes']
 const read=async()=>Promise.all(tables.map(async table=>(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all<Row>()).results))
 const before=await read()
 const statements=before.flatMap((rows,index)=>{
  expect(rows.length,tables[index]).toBeGreaterThan(0)
  const row=rows[0],columns=Object.keys(row),table=tables[index]
  const insert=()=>env.DB.prepare(`INSERT OR IGNORE INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(column=>row[column]))
  const update=()=>env.DB.prepare(`UPDATE ${table} SET ${columns.at(-1)}=${columns.at(-1)}`)
  const remove=()=>env.DB.prepare(`DELETE FROM ${table}`)
  return [insert,update,remove]
 })
 await env.DB.batch([
  env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('maintenance-upgrade','restore','running','{}','2026-01-01','2026-01-01')"),
  env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('other-maintenance','restore','running','{}','2026-01-01','2026-01-01')"),
  env.DB.prepare("INSERT INTO data_apply_claims(operation_id) VALUES('other-maintenance')"),
 ])
 try {
  for(const phase of ['locked','applying']) {
   await env.DB.prepare("UPDATE data_state SET phase=?,lock_id='maintenance-upgrade' WHERE singleton=1").bind(phase).run()
   for(const statement of statements)await expect(statement().run()).rejects.toThrow('data_maintenance')
   expect(await read()).toEqual(before)
  }
  await env.DB.prepare("INSERT INTO data_apply_claims(operation_id) VALUES('maintenance-upgrade')").run()
  // A real restore/erasure claim permits writes without changing the originals.
  for(let index=0;index<statements.length;index+=3){await statements[index]().run();await statements[index+1]().run()}
  expect(await read()).toEqual(before)
 } finally {
  await env.DB.batch([
   env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1"),
   env.DB.prepare("DELETE FROM data_apply_claims WHERE operation_id IN ('maintenance-upgrade','other-maintenance')"),
   env.DB.prepare("DELETE FROM data_operations WHERE id IN ('maintenance-upgrade','other-maintenance')"),
  ])
 }
}
