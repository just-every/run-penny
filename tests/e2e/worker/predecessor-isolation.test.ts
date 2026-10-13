import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, expect, inject, it } from 'vitest'
import { importPennySample } from '../../../src/core/features/sample-data/service'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import { clearPredecessorNotificationState, notificationTables } from '../../predecessor-storage'
import sample from '../../../sample-data/penny.v1.json'

const stamp = '2026-10-07T00:00:00.000Z'
const bytes = new Uint8Array([0, 1, 2, 255])
let legacyTables: string[]
let legacyRows: unknown[]
let requestId: string
let requesterId: string
let addressId: string
let seededRevision: number
const revision = () => env.DB.prepare('SELECT revision FROM feedback_import_native_revision WHERE singleton=1').first<number>('revision')

async function readLegacyRows() {
  return (await env.DB.batch(legacyTables.map(table => env.DB.prepare(`SELECT * FROM "${table}" ORDER BY rowid`))))
    .map(result => result.results)
}

async function writeNotificationState() {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at) VALUES('isolation-event',?,'status','isolation-subject','Public wording',?,?)").bind(requestId, stamp, stamp),
    env.DB.prepare("INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('isolation-batch',?,?,?,'isolation-event',?,?,'queued',?,?,?)").bind(requesterId, addressId, requestId, stamp, stamp, stamp, stamp, stamp),
    env.DB.prepare("INSERT OR REPLACE INTO notification_intents(event_id,requester_id,address_id,batch_id,created_at,updated_at) VALUES('isolation-event',?,?,'isolation-batch',?,?)").bind(requesterId, addressId, stamp, stamp),
    env.DB.prepare("INSERT INTO notification_attempts(id,batch_id,provider,state,created_at,updated_at) VALUES('isolation-attempt','isolation-batch','sendgrid','rejected',?,?)").bind(stamp, stamp),
    env.DB.prepare('INSERT INTO request_notification_mutes(requester_id,request_id,created_at,updated_at) VALUES(?,?,?,?)').bind(requesterId, requestId, stamp, stamp),
    env.DB.prepare('INSERT INTO requester_notification_preferences(requester_id,muted_at,created_at,updated_at) VALUES(?,?,?,?)').bind(requesterId, stamp, stamp, stamp),
  ])
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await importPennySample(createDatabaseConnection(env.DB), sample)
  requestId = (await env.DB.prepare('SELECT id FROM requests ORDER BY id LIMIT 1').first<{ id: string }>())!.id
  const address = (await env.DB.prepare('SELECT id,requester_id FROM requester_addresses ORDER BY id LIMIT 1').first<{ id: string; requester_id: string }>())!
  requesterId = address.requester_id
  addressId = address.id
  await env.DB.prepare("INSERT INTO notification_outbox(id,event_type,subject_id,event_version,requester_id,dedupe_key,payload_json,delivery_state,available_at,created_at,updated_at) VALUES('isolation-legacy','request_status_update',?,1,?,'isolation-legacy','{}','queued',?,?,?)").bind(requestId, requesterId, stamp, stamp, stamp).run()
  await env.FILES.put('predecessor-before-all', bytes)
  legacyTables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results
    // This derived installation counter advances for notification writes and cleanup.
    .map(row => row.name).filter(name => name !== 'feedback_import_native_revision' && !notificationTables.includes(name as typeof notificationTables[number]))
  legacyRows = await readLegacyRows()
  await writeNotificationState()
  seededRevision = (await revision())!
})

it.each([1, 2])('[BASE-OPS-002 DATA-001] isolates added notification state with every product migration and historical authority (pass %i)', async () => {
  expect(await readLegacyRows()).toEqual(legacyRows)
  expect(await revision()).toBeGreaterThan(seededRevision)
  expect(new Uint8Array(await (await env.FILES.get('predecessor-before-all'))!.arrayBuffer())).toEqual(bytes)
  for (const table of notificationTables) {
    expect((await env.DB.prepare(`SELECT * FROM ${table}`).all()).results).toEqual([])
  }
  const applied = (await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{ name: string }>()).results.map(row => row.name)
  const injectedNames = (inject('migrations') as { name: string }[]).map(migration => migration.name).sort()
  expect(applied).toHaveLength(injectedNames.length)
  expect(applied).toEqual(injectedNames)
  expect(injectedNames).toEqual(inject('fullMigrationNames'))
  // Installing the native prerequisites creates no native operator authority.
  expect((await env.DB.prepare('SELECT * FROM oa_operators').all()).results).toEqual([])
  expect((await env.DB.prepare('SELECT * FROM oa_sessions').all()).results).toEqual([])
  const columns = (await env.DB.prepare('PRAGMA table_info(request_status_updates)').all<{ name: string }>()).results.map(row => row.name)
  expect(columns).toContain('action_key')
  expect(columns).toContain('publication_version')
  await writeNotificationState()
  await expect(env.DB.prepare("DELETE FROM notification_events WHERE id='isolation-event'").run()).rejects.toThrow('FOREIGN KEY constraint failed')
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[DATA-001] preserves protected maintenance state and leaves its recovery to the original fixture', async () => {
  await writeNotificationState()
  await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='isolation-maintenance' WHERE singleton=1").run()
  const beforeRevision = await revision()
  const before = await env.DB.batch(notificationTables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))
  await clearPredecessorNotificationState(env.DB)
  const after = await env.DB.batch(notificationTables.map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))
  expect(after.map(result => result.results)).toEqual(before.map(result => result.results))
  expect(await revision()).toBe(beforeRevision)
  expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({ phase: 'locked', lock_id: 'isolation-maintenance' })
  await expect(env.DB.prepare('DELETE FROM notification_intents').run()).rejects.toThrow('data maintenance in progress')
  await env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1").run()
  expect(await readLegacyRows()).toEqual(legacyRows)
})
