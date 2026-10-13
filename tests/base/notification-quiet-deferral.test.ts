import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { call, env, mockMail } from './support'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
import { attempts, batches, capture, deferAcrossBoundary, due, graph, iso, morning, quiet, runtime } from './notification-quiet-deferral-fixture'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail() })
afterEach(() => vi.restoreAllMocks())

it('[NOTIFY-002/005] a claimed no-HTTP quiet deferral survives overnight without consuming attempt budget or reopening its digest', async () => {
 const g = await graph(), sends = capture()
 await deferAcrossBoundary()
 expect(sends).toHaveLength(0)
 const [deferred] = await batches(), [audit] = await attempts()
 expect(deferred).toMatchObject({ state: 'queued', attempt_count: 0, failure_reason: 'quiet_hours', window_end: iso(due), claim_id: audit.id })
 expect(audit).toMatchObject({ batch_id: deferred.id, state: 'suppressed', failure_reason: 'quiet_hours', provider_message_id: null, created_at: iso(due) })

 // A late transaction with an earlier event timestamp must not reopen this claim.
 await g.publish('Later committed public update', due - 1000)
 await prepareBatches(env.DB, iso(quiet + 1000))
 const queued = await batches()
 expect(queued).toHaveLength(2)
 expect(queued[0]).toEqual(deferred)
 expect(queued[1]).toMatchObject({ state: 'queued', attempt_count: 0, window_start: iso(quiet + 1000) })
 expect((await env.DB.prepare('SELECT batch_id FROM notification_intents WHERE batch_id=?').bind(deferred.id).all()).results).toHaveLength(1)

 await drainNotifications(runtime(), () => morning - 1)
 expect(sends).toHaveLength(0); expect(await attempts()).toEqual([audit])
 await Promise.all([drainNotifications(runtime(), () => morning), drainNotifications(runtime(), () => morning)])
 expect(sends).toHaveLength(2)
 const first = sends.filter(body => body.includes('First public update'))
 expect(first).toHaveLength(1); expect(first[0]).not.toContain('Later committed public update')
 for (const body of sends) { expect(body).not.toContain('Private title'); expect(body).not.toContain('Private evidence') }
 expect(await batches()).toMatchObject([{ id: deferred.id, state: 'accepted', attempt_count: 1 }, { state: 'accepted', attempt_count: 1 }])
 const history = await attempts()
 expect(history).toHaveLength(3); expect(history[0]).toEqual(audit)
 expect(history.slice(1)).toMatchObject([{ state: 'accepted', created_at: iso(morning) }, { state: 'accepted', created_at: iso(morning) }])
 await drainNotifications(runtime(), () => morning + 7200000)
 expect(sends).toHaveLength(2)
})

it('[NOTIFY-005 REL-006] the first real send after deferral retains five retries and their exponential backoff', async () => {
 await graph(); const sends = capture(429)
 await deferAcrossBoundary(); expect(sends).toHaveLength(0)
 let now = morning
 for (let attempt = 0; attempt < 6; attempt++) {
  await drainNotifications(runtime(), () => now)
  expect(sends).toHaveLength(attempt + 1)
  const [batch] = await batches()
  expect(batch.attempt_count).toBe(attempt + 1)
  if (attempt < 5) {
   now += 60000 * 2 ** attempt
   expect(batch).toMatchObject({ state: 'queued', next_attempt_at: iso(now) })
  } else expect(batch).toMatchObject({ state: 'failed' })
 }
 expect(await attempts()).toHaveLength(7)
 await drainNotifications(runtime(), () => morning + 3600000)
 expect(sends).toHaveLength(6)
})

it('[NOTIFY-005 REL-006] a real known failure after deferral still expires its retry window at one hour', async () => {
 await graph(); const sends = capture(429)
 await deferAcrossBoundary()
 await drainNotifications(runtime(), () => morning)
 expect(sends).toHaveLength(1)
 await drainNotifications(runtime(), () => morning + 3600000)
 expect(sends).toHaveLength(1)
 expect(await batches()).toMatchObject([{ state: 'failed', attempt_count: 1, failure_reason: 'retry_window_exhausted' }])
 expect(await attempts()).toMatchObject([{ state: 'suppressed', failure_reason: 'quiet_hours' }, { state: 'rate_limited', created_at: iso(morning) }])
})

it('[NOTIFY-005 REL-006] a quiet deferral never refunds or resets an earlier real provider failure', async () => {
 await graph(due - 60000); const sends = capture(429)
 await drainNotifications(runtime(), () => due - 60000)
 expect(sends).toHaveLength(1)
 expect(await batches()).toMatchObject([{ state: 'queued', attempt_count: 1, next_attempt_at: iso(due) }])
 await deferAcrossBoundary()
 expect(sends).toHaveLength(1)
 expect(await batches()).toMatchObject([{ state: 'queued', attempt_count: 1, failure_reason: 'quiet_hours' }])
 const history = await attempts()
 expect(history).toMatchObject([{ state: 'rate_limited', created_at: iso(due - 60000) }, { state: 'suppressed', failure_reason: 'quiet_hours' }])
 await drainNotifications(runtime(), () => morning)
 expect(sends).toHaveLength(1); expect(await attempts()).toEqual(history)
 expect(await batches()).toMatchObject([{ state: 'failed', attempt_count: 1, failure_reason: 'retry_window_exhausted' }])
})

it('[NOTIFY-002] an overnight no-send deferral rechecks current recipient permission before HTTP', async () => {
 const g = await graph(), sends = capture()
 await deferAcrossBoundary()
 expect((await call('/api/public/requester/notifications', { muted: true }, g.person, 'PATCH')).status).toBe(200)
 await drainNotifications(runtime(), () => morning)
 expect(sends).toHaveLength(0)
 expect(await batches()).toMatchObject([{ state: 'suppressed', failure_reason: 'recipient_no_longer_eligible' }])
})

it('[NOTIFY-005] an ambiguous provider result after quiet deferral is never replayed', async () => {
 await graph(); const sends = capture(503)
 await deferAcrossBoundary()
 await drainNotifications(runtime(), () => morning)
 expect(sends).toHaveLength(1)
 expect(await batches()).toMatchObject([{ state: 'unknown', attempt_count: 1 }])
 const history = await attempts()
 await drainNotifications(runtime(), () => morning + 7200000)
 expect(sends).toHaveLength(1); expect(await attempts()).toEqual(history)
})
