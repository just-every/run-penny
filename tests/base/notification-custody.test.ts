import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { call, env, messages, mockMail, owner } from './support'
import { canonical,exportArchive,planErasure,readErasureJournal } from '../../src/core/features/data/archive'
import { eraseEntity,restoreArchive } from '../../src/core/features/data/operations'
import { digest } from '../../src/core/features/auth/native-tokens'
import { drainNotifications } from '../../src/core/features/notifications/delivery'
import { applyUnsubscribe, unsubscribeUrl } from '../../src/core/features/notifications/unsubscribe'
import { notificationGraph, notificationRows, notificationTables, recordOutcome, runtime, distinctCommenter } from './notification-custody-fixture'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail() })
afterEach(() => vi.restoreAllMocks())
async function freshDestination() {
 await reset(); await applyD1Migrations(env.DB, inject('migrations'))
 const operator = await owner()
 const authority = (await env.DB.prepare('SELECT * FROM oa_operators').all()).results
 const sessions = (await env.DB.prepare('SELECT * FROM oa_sessions').all()).results
 return { operator, authority, sessions }
}

it('[DATA-001 BASE-ACCESS-002 NOTIFY-001] round-trips exact notification custody while keeping destination Base authority and disabling source credentials', async () => {
 const graph = await notificationGraph(3)
 const batches = (await env.DB.prepare('SELECT id FROM notification_batches ORDER BY id').all<{ id: string }>()).results
 expect(batches).toHaveLength(3)
 await recordOutcome(batches[0].id, 'accepted'); await recordOutcome(batches[1].id, 'unknown')
 const unsubscribe = await unsubscribeUrl(runtime(), graph.recipient, graph.requests[0].id)
 await applyUnsubscribe(runtime(), new URL(unsubscribe).searchParams.get('token')!)
 expect((await call('/api/public/requester/notifications', { muted: true }, graph.person, 'PATCH')).status).toBe(200)
 const sourceAuthority = (await env.DB.prepare('SELECT id FROM oa_operators').first<{ id: string }>())!.id
 const exported = await call('/api/operator/data/export', undefined, graph.operator)
 expect(exported.status).toBe(200)
 const snapshot = await exported.json() as Awaited<ReturnType<typeof exportArchive>>
 for (const name of notificationTables) expect(snapshot.archive.tables[name].length).toBeGreaterThan(0)
 expect(snapshot.archive.tables.notification_events).toHaveLength(6)
 expect(snapshot.archive.tables.notification_intents).toHaveLength(6)
 expect(Object.keys(snapshot.archive.tables).some(name => name.startsWith('oa_'))).toBe(false)
 expect(snapshot.archive.tables.native_requester_sessions.every(row => row.revoked_at && String(row.token_hash).startsWith('disabled-'))).toBe(true)
 expect(JSON.stringify(snapshot)).not.toContain(graph.person.Authorization.slice(7))
 const destination = await freshDestination()
 expect(destination.authority[0].id).not.toBe(sourceAuthority)
 const imported = await call('/api/operator/data/import', snapshot, destination.operator)
 expect(imported.status, await imported.clone().text()).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM oa_operators').all()).results).toEqual(destination.authority)
 expect((await env.DB.prepare('SELECT * FROM oa_sessions').all()).results).toEqual(destination.sessions)
 expect((await call('/api/operator/data/overview', undefined, destination.operator)).status).toBe(200)
 const actual = await notificationRows()
 for (const name of notificationTables) expect(actual[name]).toEqual([...snapshot.archive.tables[name]].sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0]))))
 const before = messages.length
 // Classify held restored custody during daytime in the emitted UTC workspace
 // as well as the historical Brisbane fixture; quiet-hour deferral is separate.
 await drainNotifications(runtime(), () => Date.parse('2099-01-01T09:00:00Z'))
 expect(messages).toHaveLength(before)
 expect((await env.DB.prepare("SELECT state FROM notification_batches ORDER BY state").all()).results).toEqual([{ state: 'accepted' }, { state: 'suppressed' }, { state: 'unknown' }])
 expect((await env.DB.prepare("SELECT * FROM notification_batches WHERE state IN('accepted','unknown') ORDER BY id").all()).results).toEqual(snapshot.archive.tables.notification_batches.filter(row => row.state !== 'queued').sort((a, b) => String(a.id).localeCompare(String(b.id))))
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[DATA-001 NOTIFY-001] restored sending history becomes unknown for review and never a replayable provider call', async () => {
 await notificationGraph(1)
 const batch = (await env.DB.prepare('SELECT id FROM notification_batches').first<{ id: string }>())!
 await recordOutcome(batch.id, 'unknown')
 const snapshot = await exportArchive(env.DB, env.FILES)
 // A valid prior snapshot may contain an interrupted attempt. It must retain custody.
 snapshot.archive.tables.notification_batches[0].state = 'sending'
 snapshot.archive.tables.notification_attempts[0].state = 'sending'
 const { sha256: ignored, ...body } = snapshot.archive; void ignored
 snapshot.archive.sha256 = await digest(canonical(body))
 await freshDestination()
 expect((await restoreArchive(env.DB, env.FILES, snapshot.archive, snapshot.journal)).status).toBe('complete')
 expect(await env.DB.prepare('SELECT state,attempt_count FROM notification_batches').first()).toEqual({ state: 'sending', attempt_count: 1 })
 const before = messages.length
 await drainNotifications(runtime(), () => Date.parse('2099-01-01T02:00:00Z'))
 expect(messages).toHaveLength(before)
 expect(await env.DB.prepare('SELECT state,attempt_count FROM notification_batches').first()).toEqual({ state: 'unknown', attempt_count: 1 })
 expect(await env.DB.prepare('SELECT state FROM notification_attempts').first()).toEqual({ state: 'unknown' })
})

it('[DATA-003 NOTIFY-001] erasure removes recipient, event, attempt and preference custody and rejects stale restoration and old unsubscribe capabilities', async () => {
 const graph = await notificationGraph(1)
 const batch = (await env.DB.prepare('SELECT id FROM notification_batches').first<{ id: string }>())!
 await recordOutcome(batch.id, 'accepted')
 const url = await unsubscribeUrl(runtime(), graph.recipient, 'all'), token = new URL(url).searchParams.get('token')!
 await applyUnsubscribe(runtime(), token)
 await applyUnsubscribe(runtime(), new URL(await unsubscribeUrl(runtime(), graph.recipient, graph.requests[0].id)).searchParams.get('token')!)
 const snapshot = await exportArchive(env.DB, env.FILES)
 const plan = await planErasure(env.DB, 'requesters', graph.recipient.requesterId)
 expect(plan.blockedCopies).toEqual([])
 for (const name of notificationTables) expect(plan.counts[name]).toBeGreaterThan(0)
 const erased = await call('/api/operator/data/erasure', { table: 'requesters', id: graph.recipient.requesterId, planHash: plan.planHash }, graph.operator)
 expect(erased.status, await erased.clone().text()).toBe(200)
 for (const rows of Object.values(await notificationRows())) expect(rows).toEqual([])
 const journal = await readErasureJournal(env.DB)
 for (const name of notificationTables) expect(journal.tombstones.some(row => row.table_name === name)).toBe(true)
 await expect(restoreArchive(env.DB, env.FILES, snapshot.archive, snapshot.journal)).rejects.toMatchObject({ code: 'erasure_journal_regression' })
 await expect(applyUnsubscribe(runtime(), token)).rejects.toMatchObject({ code: 'invalid_unsubscribe_link' })
 const before = messages.length
 await drainNotifications(runtime(), () => Date.parse('2099-01-01T02:00:00Z'))
 expect(messages).toHaveLength(before)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[DATA-001 DATA-003 NOTIFY-001] maintenance excludes notification writes and Cron, and provider ownership excludes data maintenance', async () => {
 const graph = await notificationGraph(1)
 const token = new URL(await unsubscribeUrl(runtime(), graph.recipient, 'all')).searchParams.get('token')!
 const before = await notificationRows(), count = messages.length
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='custody-test' WHERE singleton=1").run()
 await drainNotifications(runtime(), () => Date.parse('2099-01-01T02:00:00Z'))
 expect(await notificationRows()).toEqual(before); expect(messages).toHaveLength(count)
 await expect(applyUnsubscribe(runtime(), token)).rejects.toThrow('maintenance')
 expect([409, 503]).toContain((await call('/api/public/requester/notifications', { muted: true }, graph.person, 'PATCH')).status)
 expect(await notificationRows()).toEqual(before)
 await env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1").run()
 await env.DB.prepare("UPDATE notification_batches SET state='sending' WHERE 1=1").run()
 await expect(exportArchive(env.DB, env.FILES)).rejects.toMatchObject({ code: 'notification_writer_active' })
 const plan = await planErasure(env.DB, 'requesters', graph.recipient.requesterId)
 await expect(eraseEntity(env.DB, env.FILES, 'requesters', graph.recipient.requesterId, plan.planHash)).rejects.toMatchObject({ code: 'notification_writer_active' })
 expect((await call('/api/operator/data/export', undefined, graph.operator)).status).toBe(409)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({ phase: 'idle', lock_id: null })
})

it('[DATA-003 NOTIFY-001] erasing a commenter removes copied event wording without erasing another requester’s request', async () => {
 const graph = await notificationGraph(1), person = await distinctCommenter()
 const commenter = (await env.DB.prepare('SELECT id FROM requesters WHERE id!=?').bind(graph.recipient.requesterId).first<{ id: string }>())!
 await env.DB.prepare('UPDATE requesters SET display_name=? WHERE id=?').bind('Separate commenter custody', commenter.id).run()
 const response = await call(`/api/public/requests/${graph.requests[0].slug}/comments`, { body: 'Distinct erased commenter wording' }, person)
 expect(response.status).toBe(201)
 const { id } = await response.json() as { id: string }
 expect((await call(`/api/operator/comments/${id}/moderate`, { verdict: 'approved', publicAuthorDisplayName: 'Separate commenter custody' }, graph.operator)).status).toBe(200)
 expect(await env.DB.prepare('SELECT subject_id FROM notification_events WHERE id=?').bind(id).first()).toEqual({ subject_id: id })
 const plan = await planErasure(env.DB, 'requesters', commenter.id)
 expect(plan.blockedCopies).toEqual([]); expect(plan.counts.requests).toBeUndefined()
 expect(plan.selected.notification_events.map(row => row.id)).toEqual([id])
 expect((await eraseEntity(env.DB, env.FILES, 'requesters', commenter.id, plan.planHash)).status).toBe('complete')
 expect(await env.DB.prepare('SELECT id FROM notification_events WHERE id=?').bind(id).first()).toBeNull()
 expect(await env.DB.prepare('SELECT event_id FROM notification_intents WHERE event_id=?').bind(id).first()).toBeNull()
 expect(await env.DB.prepare('SELECT id FROM requests WHERE id=?').bind(graph.requests[0].id).first()).toEqual({ id: graph.requests[0].id })
 expect(JSON.stringify(await exportArchive(env.DB, env.FILES))).not.toContain('Distinct erased commenter wording')
})
