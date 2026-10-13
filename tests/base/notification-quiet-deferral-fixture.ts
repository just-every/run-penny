import { expect, vi } from 'vitest'
import { call, env, owner, requester } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'
import { drainNotifications } from '@/core/features/notifications/delivery'

export const due = Date.parse('2026-10-07T09:59:59.000Z')
export const quiet = Date.parse('2026-10-07T10:00:00.000Z')
export const morning = Date.parse('2026-10-07T22:00:00.000Z')
export const iso = (time: number) => new Date(time).toISOString()
export const runtime = () => createPennyRuntime(env, {
 operatorAllowlist: ['owner@penny.invalid'], workspaceTimezone: 'Australia/Brisbane', publicOriginAllowlist: ['https://penny.test'],
})
export async function graph(deadline = due) {
 const operator = await owner(), person = await requester()
 expect((await call('/api/operator/boards', { name: 'Feedback', slug: 'quiet', visibility: 'public' }, operator)).status).toBe(201)
 const response = await call('/api/public/requests', { title: 'Private title', description: 'Private evidence', boardSlug: 'quiet', idempotencyKey: crypto.randomUUID() }, person)
 expect(response.status).toBe(201)
 const { slug } = await response.json() as { slug: string }
 expect((await call(`/api/operator/moderation/${slug}`, { verdict: 'approved', title: 'Public title', description: 'Public description', boardSlug: 'quiet', displayName: 'Public author' }, operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${slug}/follow`, {}, person)).status).toBe(204)
 const actor = (await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<{ id: string }>())!
 const publish = (body: string, now: number) => new RequestOperatorRepository(runtime().database).publishStatusUpdate({
  slug, operatorId: actor.id, status: 'under_review', body, pinned: false, now: iso(now), appOrigin: 'https://penny.test',
 })
 await publish('First public update', deadline - 3600000)
 return { person, slug, publish }
}
export function capture(status = 202) {
 const sends: string[] = []
 vi.mocked(fetch).mockImplementation(async (url, init) => {
  expect(String(url)).toBe('https://api.sendgrid.com/v3/mail/send')
  expect(init?.method).toBe('POST')
  expect(await env.DB.prepare('SELECT state,attempt_count FROM notification_batches WHERE state=\'sending\'').first()).toMatchObject({ state: 'sending', attempt_count: expect.any(Number) })
  sends.push(String(init?.body))
  return new Response(null, { status })
 })
 return sends
}
export async function batches() {
 return (await env.DB.prepare('SELECT * FROM notification_batches ORDER BY window_start,id').all()).results
}
export async function attempts() {
 return (await env.DB.prepare('SELECT * FROM notification_attempts ORDER BY created_at,id').all()).results
}
/** Let real HMAC signing finish after the durable claim crosses into quiet hours. */
export async function deferAcrossBoundary() {
 let now = due
 const sign = crypto.subtle.sign.bind(crypto.subtle)
 const signing = vi.spyOn(crypto.subtle, 'sign').mockImplementation(async (...args) => {
  expect(await env.DB.prepare('SELECT state,claim_id FROM notification_batches').first()).toMatchObject({ state: 'sending', claim_id: expect.any(String) })
  expect(await env.DB.prepare('SELECT state FROM notification_attempts WHERE state=\'sending\'').first()).toEqual({ state: 'sending' })
  const signature = await sign(...args)
  now = quiet
  return signature
 })
 try { await drainNotifications(runtime(), () => now) } finally { signing.mockRestore() }
}
