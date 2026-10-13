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
const stamp = '2026-10-08T09:00:00.000Z'
test('[BASE-OPS-002 REL-003/004 ROAD-008 DATA-001] prior publications retain every original value and gain durable membership seals', async t => {
 const { db, api, id, writes } = sqliteProvider(t)
 await migrate(api, id, migrations.filter(migration => migration.name < '0015'))
 function insert(table, fields) {
  const row = { ...fields, created_at: stamp, updated_at: stamp }, keys = Object.keys(row)
  db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...Object.values(row))
 }
 insert('operators', { id: 'owner', email: 'owner@example.invalid', display_name: 'Original author' })
 insert('boards', { id: 'board', slug: 'board', name: 'Board', visibility: 'public', position: 0 })
 insert('requesters', { id: 'person', display_name: 'Person' })
 insert('requester_addresses', { id: 'address', requester_id: 'person', email: 'person@example.invalid', verified_at: stamp })
 insert('requests', { id: 'request', slug: 'request', board_id: 'board', title: 'Request', description: 'Problem', moderation_state: 'approved', public_state: 'open', published_at: stamp })
 insert('decisions', { id: 'decision', slug: 'decision', title: 'Decision', question: 'Which?', state: 'committed' })
 insert('roadmap_items', { id: 'item', slug: 'item', decision_id: 'decision', title: 'Item', summary: 'Problem', status: 'shipped' })
 insert('roadmap_publications', { id: 'approval', roadmap_item_id: 'item', public_title: 'Safe title', public_summary: 'Safe summary', public_slug: 'public-item', approved_by_operator_id: 'owner', approved_at: stamp })
 insert('roadmap_transitions', { id: 'transition', roadmap_item_id: 'item', to_status: 'shipped', reason: 'Finished', actor_operator_id: 'owner' })
 insert('roadmap_update_versions', { id: 'update', transition_id: 'transition', roadmap_item_id: 'item', author_operator_id: 'owner', version_number: 1, public_status: 'shipped', title: 'Safe title', problem: 'Safe summary', body: 'Shipped', public_slug: 'public-item', approval_id: 'approval', approval_at: stamp, approval_updated_at: stamp })
 insert('roadmap_update_targets', { version_id: 'update', request_id: 'request', approval_at: stamp, approval_updated_at: stamp })
 insert('roadmap_update_histories', { id: 'history', version_id: 'update', request_id: 'request' })
 insert('roadmap_update_contexts', { version_id: 'update', requester_id: 'person', address_id: 'address', request_id: 'request', title: 'Request', slug: 'request' })
 insert('releases', { id: 'release', slug: 'release', state: 'draft', author_operator_id: 'owner', current_version_id: 'version' })
 insert('release_versions', { id: 'version', release_id: 'release', version_number: 1, title: 'Published title', release_type: 'new', body: 'Published body', outcome_prompt: '', subject_tags_json: '[]', is_portal_current: 1, author_name: 'Original author', tag_names_json: '[]' })
 insert('release_target_snapshots', { version_id: 'version', roadmap_item_id: 'item', decision_id: 'decision', request_id: 'request' })
 insert('release_recipient_snapshots', { id: 'snapshot', release_version_id: 'version', requester_id: 'person', requester_address_id: 'address', request_id: 'request', recipient_email: 'person@example.invalid', verification_epoch: 0 })
 insert('release_recipient_contexts', { snapshot_id: 'snapshot', request_id: 'request', roadmap_item_id: 'item', title: 'Request', slug: 'request' })
 db.prepare("UPDATE releases SET state='published',published_at=?").run(stamp)
 db.prepare('UPDATE roadmap_update_versions SET published_at=?').run(stamp)
 const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_rer_%'").all().map(row => row.name)
 const before = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM "${table}"`).all()]))
 assert.deepEqual((await migrate(api, id, migrations)).applied, migrations.filter(migration => migration.name >= '0015').map(migration => migration.name))
 for (const [table, rows] of Object.entries(before)) {
  if (!rows.length) continue
  assert.deepEqual(db.prepare(`SELECT ${Object.keys(rows[0]).map(name => `"${name}"`).join(',')} FROM "${table}"`).all(), rows, table)
 }
 for (const table of ['release_versions', 'roadmap_update_versions']) assert.equal(db.prepare(`SELECT snapshot_sealed_at FROM ${table}`).get().snapshot_sealed_at, stamp)
 for (const table of ['release_target_snapshots', 'release_recipient_snapshots', 'release_recipient_contexts', 'roadmap_update_targets', 'roadmap_update_histories', 'roadmap_update_contexts']) {
  assert.throws(() => db.exec(`INSERT OR IGNORE INTO ${table} SELECT * FROM ${table}`), /immutable/, table)
  assert.throws(() => db.exec(`UPDATE ${table} SET updated_at='later'`), /immutable/, table)
  assert.throws(() => db.exec(`DELETE FROM ${table}`), /immutable/, table)
 }
 assert.throws(() => db.exec('UPDATE release_versions SET snapshot_sealed_at=NULL'), /immutable/)
 assert.throws(() => db.exec("UPDATE release_versions SET title='Changed'"), /immutable/)
 assert.throws(() => db.exec("UPDATE roadmap_update_versions SET body='Changed'"), /immutable/)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
 assert.deepEqual(db.prepare('SELECT name,sha256 FROM _rer_deploy_migrations ORDER BY name').all().map(row => ({ ...row })), migrations.map(({ name, sha256 }) => ({ name, sha256 })))
 const count = writes.length
 assert.deepEqual((await migrate(api, id, migrations)).applied, [])
 assert.equal(writes.length, count)
})
