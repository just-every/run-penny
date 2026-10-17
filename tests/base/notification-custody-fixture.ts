import { expect } from 'vitest'
import { call, env, owner, requester, messages } from './support'
import { createPennyRuntime } from '../../src/core/app/runtime'
import { prepareBatches } from '../../src/core/features/notifications/batches'
import {explicitConsentBoard} from './explicit-consent-board'

export const notificationTables = ['notification_events', 'notification_intents', 'notification_batches', 'notification_attempts', 'requester_notification_preferences', 'request_notification_mutes'] as const
export const runtime = () => createPennyRuntime(env)
export async function notificationRows() {
 const values = await env.DB.batch(notificationTables.map(name => env.DB.prepare(`SELECT * FROM ${name} ORDER BY 1,2`)))
 return Object.fromEntries(notificationTables.map((name, index) => [name, values[index].results]))
}
export async function notificationGraph(count = 2) {
 const operator = await owner(), person = await requester()
 expect((await call('/api/operator/boards', { name: 'Feedback board', slug: 'custody', visibility: 'public' }, operator)).status).toBe(201)
 await explicitConsentBoard('custody',(path,method,body)=>call(path,body,operator,method))
 const requests: { id: string; slug: string }[] = []
 for (let i = 0; i < count; i++) {
  const response = await call('/api/public/requests', { title: `Original wording ${i}`, description: `Private detail ${i}`, boardSlug: 'custody', idempotencyKey: crypto.randomUUID() }, person)
  expect(response.status).toBe(201)
  const { slug } = await response.json() as { slug: string }
  expect((await call(`/api/operator/moderation/${slug}`, { verdict: 'approved', title: `Approved title ${i}`, description: `Published detail ${i}`, boardSlug: 'custody', displayName: 'Published author' }, operator)).status).toBe(200)
  expect((await call(`/api/public/requests/${slug}/follow`, {}, person)).status).toBe(204)
  expect((await call(`/api/operator/requests/${slug}/status-updates`, { status: 'under_review', body: `Public status wording ${i}`, pinned: false }, operator)).status).toBe(200)
  const comment = await call(`/api/public/requests/${slug}/comments`, { body: `Approved reply wording ${i}` }, person)
  expect(comment.status).toBe(201)
  const { id: commentId } = await comment.json() as { id: string }
  expect((await call(`/api/operator/comments/${commentId}/moderate`, { verdict: 'approved', publicAuthorDisplayName: 'Published author' }, operator)).status).toBe(200)
  requests.push((await env.DB.prepare('SELECT id,slug FROM requests WHERE slug=?').bind(slug).first<{ id: string; slug: string }>())!)
 }
 await prepareBatches(env.DB, new Date().toISOString())
 const recipient = (await env.DB.prepare('SELECT requester_id AS requesterId,id AS addressId,email FROM requester_addresses').first<{ requesterId: string; addressId: string; email: string }>())!
 return { operator, person, requests, recipient }
}
export async function recordOutcome(batchId: string, state: 'accepted' | 'unknown') {
 const now = new Date().toISOString(), attempt = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('UPDATE notification_batches SET state=?,attempt_count=1,claim_id=?,provider=?,provider_message_id=? WHERE id=?').bind(state, attempt, 'sendgrid', state === 'accepted' ? 'retained-receipt' : null, batchId),
  env.DB.prepare('INSERT INTO notification_attempts(id,batch_id,provider,state,provider_message_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(attempt, batchId, 'sendgrid', state, state === 'accepted' ? 'retained-receipt' : null, now, now),
 ])
}

export async function distinctCommenter() {
 const email = `${crypto.randomUUID()}@example.test`
 expect((await call('/api/public/identity/email', { email, displayName: 'Separate commenter custody' })).status).toBe(202)
 const link = messages.findLast(message => message.to === email)!
 const token = new URLSearchParams(new URL(link.url).hash.slice(1)).get('token')
 const response = await call('/api/public/identity/email/verify', { token })
 expect(response.status).toBe(200)
 return { Authorization: `Bearer ${(await response.json() as { token: string }).token}` }
}
