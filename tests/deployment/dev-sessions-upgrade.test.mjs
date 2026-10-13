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
const before = migrations.filter(migration => migration.name < '0028')
const future = 9999999999999
const tables = ['oa_operators', 'oa_bootstrap', 'oa_tokens', 'oa_sessions', 'operators', 'integration_tokens', 'penny_api_issuers', 'penny_api_issuance']
const issue = (db, id, dev) => {
  // The same issuance keys.ts runs: the singleton names the issuing session's operator, then the token insert.
  db.exec(`INSERT INTO penny_api_issuance(singleton,native_operator_id,operator_version,actor_id${dev === undefined ? '' : ',dev'}) VALUES(1,'owner',1,'actor'${dev === undefined ? '' : ',' + dev})`)
  db.exec(`INSERT INTO integration_tokens(namespace,id,token_hash,name,scopes,created_at) VALUES('penny-api','${id}','hash-${id}','${id}','["requests:read"]',100)`)
  db.exec('DELETE FROM penny_api_issuance WHERE singleton=1')
}

test('[BASE-ACCESS-002 SC-05] a populated store upgrades to dev sessions with every session and API key intact; only dev-session keys are recorded as dev-minted', async t => {
  const { db, api, id, writes } = sqliteProvider(t)
  await migrate(api, id, before)
  db.exec(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES('owner','owner@penny.invalid','Owner','owner','active',1,10),('mate','mate@penny.invalid','Mate','member','active',1,20);
  INSERT INTO oa_bootstrap VALUES(1,'claim',10);
  INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,return_to,created_at,expires_at) VALUES('link','link-hash','magic','owner',1,'/setup',30,${future});
  INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at) VALUES
   ('native','h-native','owner',1,'native','link',40,${future},NULL),('review','h-review','owner',1,'review',NULL,41,${future},NULL),
   ('oidc','h-oidc','mate',1,'oidc',NULL,42,${future},NULL),('password','h-password','mate',1,'password',NULL,43,${future},NULL),
   ('revoked','h-revoked','owner',1,'native',NULL,44,${future},45),('expired','h-expired','owner',1,'native',NULL,46,47,NULL);
  INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES('actor','owner@penny.invalid','Owner','stamp','stamp');`)
  issue(db, 'ordinary-before')
  const kept = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]))

  const applied = (await migrate(api, id, migrations)).applied
  assert.deepEqual(applied, migrations.filter(migration => migration.name >= '0028').map(migration => migration.name), 'the dev-session migrations apply once, in order')
  // Every row and column present before is unchanged: ids, hashes, kinds, expiries and revocations.
  for (const table of tables) assert.deepEqual(db.prepare(`SELECT ${kept[table].length ? Object.keys(kept[table][0]).join(',') : '*'} FROM ${table} ORDER BY 1`).all(), kept[table], table)
  const valid = db.prepare(`SELECT s.id FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.revoked_at IS NULL AND s.expires_at>? AND o.status='active' AND o.version=s.operator_version ORDER BY s.id`).all(1000).map(row => row.id)
  assert.deepEqual(valid, ['native', 'oidc', 'password', 'review'], 'the same sessions stay valid; revoked and expired stay invalid')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM oa_dev_credentials').get().n, 0, 'nothing that existed is dev-minted')

  // A dev session is now a session kind; a key minted in one is recorded, one minted in any other session is not.
  db.exec(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('dev','h-dev','owner',1,'dev',50,${future})`)
  issue(db, 'ordinary-after', 0)
  issue(db, 'dev-minted', 1)
  assert.deepEqual(db.prepare("SELECT credential,id FROM oa_dev_credentials").all().map(row => ({ ...row })), [{ credential: 'integration_tokens', id: 'dev-minted' }])
  assert.deepEqual(db.prepare('SELECT token_id FROM penny_api_issuers ORDER BY token_id').all().map(row => row.token_id), ['dev-minted', 'ordinary-after', 'ordinary-before'])
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])

  const count = writes.length
  assert.deepEqual((await migrate(api, id, migrations)).applied, [], 'a repeat applies nothing')
  assert.equal(writes.length, count)

  const fresh = sqliteProvider(t)
  await migrate(fresh.api, fresh.id, migrations)
  assert.equal(fresh.db.prepare('SELECT COUNT(*) n FROM oa_dev_credentials').get().n, 0, 'a fresh store starts with no dev credentials')
})
