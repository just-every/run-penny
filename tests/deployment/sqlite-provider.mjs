import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { cloudflare } from '../../base/modules/deploy-kit/provider.mjs'

// Test-only HTTP capture backed by SQLite. This exercises the shipped serializer
// and migration controller; it does not establish hosted D1 batch behavior.
export function sqliteProvider(t, { rejectSql = () => false } = {}) {
 const db = new DatabaseSync(':memory:')
 t.after(() => db.close())
 db.exec('PRAGMA foreign_keys = ON')
 const calls = [], writes = []
 const accountId = 'a'.repeat(32), id = 'penny-test-db'
 const api = cloudflare({ accountId, token: 'test-only-token', fetch: async (url, init) => {
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${id}/query`)
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, 'Bearer test-only-token')
  const { sql } = JSON.parse(init.body)
  calls.push(sql)
  let results = []
  if (/^SELECT /i.test(sql)) results = db.prepare(sql).all()
  else {
   writes.push(sql)
   if (rejectSql(sql)) return Response.json({ success: false, errors: [{ code: 7500 }] }, { status: 400 })
   db.exec('BEGIN')
   try { db.exec(sql); db.exec('COMMIT') }
   catch (error) { db.exec('ROLLBACK'); throw error }
  }
  return Response.json({ success: true, errors: [], result: [{ success: true, results }] })
 } })
 return { api, id, db, calls, writes }
}
