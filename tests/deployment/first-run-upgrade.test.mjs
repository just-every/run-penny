import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { migrate } from '../../base/modules/deploy-kit/migrations.mjs'
import { sqliteProvider } from './sqlite-provider.mjs'

const directory = new URL('../../migrations/core/', import.meta.url)
const migrations = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql')).sort().map(async name => {
  const sql = await readFile(new URL(name, directory), 'utf8')
  return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') }
}))
const before = migrations.filter(migration => migration.name < '0027')

test('[BASE-OPS-002] an installation with an active owner upgrades with setup finished and every row kept; a new one starts unfinished', async t => {
  const used = sqliteProvider(t)
  await migrate(used.api, used.id, before)
  used.db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('later','later@penny.invalid','Later','owner','active',20),('first','first@penny.invalid','First','owner','active',10),('member','member@penny.invalid','Member','member','active',5)").run()
  used.db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','board','Board','public',0,'2026-10-10','2026-10-10')").run()
  const rows = table => used.db.prepare(`SELECT * FROM ${table}`).all()
  const kept = { oa_operators: rows('oa_operators'), boards: rows('boards') }
  await migrate(used.api, used.id, migrations)
  assert.deepEqual({ oa_operators: rows('oa_operators'), boards: rows('boards') }, kept)
  const [finished, ...extra] = rows('oa_first_run')
  assert.equal(extra.length, 0)
  assert.equal(finished.completed_by, 'first', 'the earliest active owner finished setup')
  assert.deepEqual(used.db.prepare('PRAGMA foreign_key_check').all(), [])
  const writes = used.writes.length
  assert.deepEqual((await migrate(used.api, used.id, migrations)).applied, [], 'a repeat applies nothing')
  assert.equal(used.writes.length, writes, 'a repeat performs no writes')
  assert.deepEqual(rows('oa_first_run'), [finished], 'a repeat keeps the original setup completion')
  assert.deepEqual({ oa_operators: rows('oa_operators'), boards: rows('boards') }, kept)

  const fresh = sqliteProvider(t)
  await migrate(fresh.api, fresh.id, migrations)
  assert.equal(fresh.db.prepare('SELECT COUNT(*) n FROM oa_first_run').get().n, 0)
})
