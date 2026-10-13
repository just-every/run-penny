import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { migrate } from '../../base/modules/deploy-kit/migrations.mjs'
import { sqliteProvider } from './sqlite-provider.mjs'

const directory = new URL('../../migrations/core/', import.meta.url)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
// This immutable 0009 delimiter/authority regression owns the original nine-migration profile.
// Current complete-history upgrades are checked independently in notification-migrations.test.mjs.
const migrations = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql') && name <= '0009_base_operator_auth.sql').sort().map(async name => {
 const sql = await readFile(new URL(name, directory), 'utf8')
 return { name, sql, sha256: sha256(sql) }
}))
const upgrade = migrations.find(migration => migration.name === '0009_base_operator_auth.sql')

test('[BASE-OPS-002] actual Penny SQL reaches Base deployment ledger with no extra terminator after 0009 comments', async t => {
 const { api, id, db, writes } = sqliteProvider(t)
 const earlier = migrations.filter(migration => migration.name < upgrade.name)
 await migrate(api, id, earlier)
 db.exec(`INSERT INTO operators VALUES ('01J0000000000000000000000A','existing@example.test','Existing owner','2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z');
  INSERT INTO operator_sessions VALUES ('old-session','01J0000000000000000000000A','prior-hash','2099-01-01','2026-10-01',NULL,'2026-10-01','2026-10-01');
  INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES ('prior-requester','Existing requester','2026-10-01','2026-10-01');
  INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at)
   VALUES ('prior-address','prior-requester','requester@example.test','2026-10-01','2026-10-01','2026-10-01');
  INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at)
   VALUES ('prior-requester-session','prior-requester','prior-address','prior-requester-hash','2099-01-01','2026-10-01','2026-10-01','2026-10-01');
  INSERT INTO native_magic_links(id,purpose,email,token_hash,expires_at,created_at,updated_at)
   VALUES ('prior-link','operator','existing@example.test','prior-link-hash','2099-01-01','2026-10-01','2026-10-01');
  INSERT INTO local_auth_outbox(id,recipient,purpose,token,expires_at,created_at,updated_at)
   VALUES ('prior-link','existing@example.test','operator','test-only-token','2099-01-01','2026-10-01','2026-10-01');`)
 const originalOperators = db.prepare('SELECT * FROM operators').all()
 const result = await migrate(api, id, migrations)
 assert.deepEqual(result.applied, [upgrade.name])
 const batches = writes.filter(sql => sql.startsWith(upgrade.sql))
 assert.equal(batches.length, 1)
 // The immutable SQL ends in a terminated UPDATE followed by line comments.
 // A newline ends the comments; adding a second semicolon caused D1 error 7500.
 assert.equal(batches[0], `${upgrade.sql}\nUPDATE _rer_deploy_migrations SET state='applied' WHERE name='${upgrade.name}' AND sha256='${upgrade.sha256}';`)
 assert.deepEqual(db.prepare('SELECT * FROM operators').all(), originalOperators)
 assert.deepEqual({ ...db.prepare('SELECT id,email,role,status FROM oa_operators').get() }, {
  id: '01J0000000000000000000000A', email: 'existing@example.test', role: 'owner', status: 'active',
 })
 assert.equal(typeof db.prepare('SELECT revoked_at FROM operator_sessions').get().revoked_at, 'string')
 assert.equal(typeof db.prepare('SELECT revoked_at FROM native_requester_sessions').get().revoked_at, 'string')
 assert.equal(typeof db.prepare('SELECT consumed_at FROM native_magic_links').get().consumed_at, 'string')
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM local_auth_outbox').get().count, 0)
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM oa_sessions').get().count, 0)
 assert.deepEqual(db.prepare('SELECT name,sha256,state FROM _rer_deploy_migrations ORDER BY name').all().map(row => ({ ...row })),
  migrations.map(({ name, sha256: digest }) => ({ name, sha256: digest, state: 'applied' })))
 const count = writes.length
 assert.deepEqual((await migrate(api, id, migrations)).applied, [])
 assert.equal(writes.length, count, 'repeat must perform no SQL mutation')
 const changed = migrations.map(migration => migration === upgrade ? { ...migration, sql: migration.sql + '\n', sha256: sha256(migration.sql + '\n') } : migration)
 await assert.rejects(migrate(api, id, changed), /changed-or-uncertain-migration-history/)
 assert.equal(writes.length, count, 'changed migration bytes must not execute')
 assert.equal(sha256(await readFile(new URL(upgrade.name, directory))), upgrade.sha256)
})

test('[BASE-OPS-002] rejected actual 0009 retains its applying claim and refuses replay', async t => {
 const { api, id, db, writes } = sqliteProvider(t, { rejectSql: sql => sql.startsWith(upgrade.sql) })
 await assert.rejects(migrate(api, id, migrations), /provider-http-400/)
 assert.deepEqual({ ...db.prepare('SELECT name,sha256,state FROM _rer_deploy_migrations WHERE name=?').get(upgrade.name) },
  { name: upgrade.name, sha256: upgrade.sha256, state: 'applying' })
 assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='oa_operators'").get().count, 0)
 const count = writes.length
 await assert.rejects(migrate(api, id, migrations), /changed-or-uncertain-migration-history/)
 assert.equal(writes.length, count)
 assert.equal(writes.filter(sql => sql.startsWith(upgrade.sql)).length, 1)
})
