import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { createPennyApi } from '../../src/core/app/api'
import type { Archive, ErasureJournal } from '../../src/core/features/data/archive'
import type { ItemOwner, OwnershipQueue } from '../../src/core/features/ownership/types'
import { call, env, mockMail, origin, owner, requester } from './support'
import { observeD1 } from './review-race-storage'
import { assign, capture, catalog, good, peer, queue, type Cookie } from './ownership-fixture'

beforeEach(async () => { await reset(); mockMail() })
afterEach(() => vi.restoreAllMocks())
async function setup() {
 await applyD1Migrations(env.DB, inject('migrations'))
 const cookie = await owner(), self = (await catalog(cookie)).operators[0]
 await good('/api/operator/boards', { slug: 'owned-feedback', name: 'Ownership board', visibility: 'public' }, cookie, 'POST', 201)
 return { cookie, self }
}
const ownerOf = (entity: string, id: string, cookie: Cookie) => good<{ owner: ItemOwner | null }>(`/api/operator/ownership/${entity}/${id}`, undefined, cookie)

it('[TRIAGE-001] upgrades populated records without granting an owner, captures the current board default, and moves only assigned work between native operator queues', async () => {
 const migrations = inject('migrations') as { name: string }[], previousHead = migrations.slice(0, migrations.findIndex(migration => migration.name.startsWith('0073_')))
 await applyD1Migrations(env.DB, previousHead as never)
 const cookie = await owner()
 await good('/api/operator/boards', { slug: 'owned-feedback', name: 'Ownership board', visibility: 'public' }, cookie, 'POST', 201)
 const prior = await good('/api/operator/requests', { title: 'Existing request', description: 'Retained original context', boardSlug: 'owned-feedback' }, cookie, 'POST', 201)
 const before = await env.DB.prepare('SELECT * FROM requests WHERE slug=?').bind(prior.slug).first()
 await applyD1Migrations(env.DB, migrations as never); await applyD1Migrations(env.DB, migrations as never)
 expect(await env.DB.prepare('SELECT * FROM requests WHERE slug=?').bind(prior.slug).first()).toEqual(before)
 expect((await ownerOf('requests', prior.slug, cookie)).owner).toBeNull()
 const self = (await catalog(cookie)).operators[0], other = await peer(cookie)
 await assign('boards', 'owned-feedback', self.id, cookie)
 const identity = await requester('Owner queue requester')
 const publicBoards = await good<{ slug: string; subscriptionDisclosure?: { version: number } }[]>('/api/public/boards')
 const subscriptionVersion = publicBoards.find(board => board.slug === 'owned-feedback')?.subscriptionDisclosure?.version
 const submitted = await good('/api/public/requests', { boardSlug: 'owned-feedback', title: 'Portal captured request', description: 'A real customer problem', subscriptionVersion, idempotencyKey: crypto.randomUUID() }, identity, 'POST', 201)
 const requestId = await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(submitted.slug).first<string>('id')
 const evidenceId = await env.DB.prepare('SELECT evidence_id FROM request_evidence_links WHERE request_id=?').bind(requestId).first<string>('evidence_id')
 expect((await ownerOf('requests', submitted.slug, cookie)).owner?.id).toBe(self.id)
 expect((await ownerOf('evidence', evidenceId!, cookie)).owner?.id).toBe(self.id)
 const manual = await capture(cookie, 'owned-feedback')
 expect((await ownerOf('evidence', manual.evidence.id, cookie)).owner?.id).toBe(self.id)
 expect((await queue(cookie)).totals).toEqual({ requests: 2, evidence: 2, comments: 0 })
 expect((await queue(other.cookie)).totals).toEqual({ requests: 0, evidence: 0, comments: 0 })
 await assign('requests', submitted.slug, other.id, cookie); await assign('evidence', evidenceId!, other.id, cookie)
 expect((await queue(cookie)).requests.map(row => row.id)).toEqual([manual.request.id])
 expect((await queue(other.cookie)).requests.map(row => row.id)).toEqual([requestId])
 expect((await queue(other.cookie)).evidence.map(row => row.id)).toEqual([evidenceId])
 // Neither an operator filter nor a requester credential expands the own queue.
 expect((await good<OwnershipQueue>(`/api/operator/ownership/queue?operatorId=${other.id}`, undefined, cookie)).requests.map(row => row.id)).toEqual([manual.request.id])
 for (const path of ['/api/operator/ownership/catalog', '/api/operator/ownership/queue', `/api/operator/ownership/requests/${submitted.slug}`]) expect((await call(path, undefined, identity)).status).toBe(401)
 expect((await call(`/api/operator/ownership/requests/${submitted.slug}`, { operatorId: self.id }, { ...cookie, Origin: 'https://another.test' }, 'PATCH')).status).toBe(403)
 await good(`/api/operator/moderation/${submitted.slug}`, { verdict: 'approved', title: 'Public title', description: 'Public problem', boardSlug: 'owned-feedback', displayName: 'Customer' }, cookie)
 const publicProjection = await good(`/api/public/requests/${submitted.slug}`)
 const publicBoard = await good('/api/public/boards')
 for (const projection of [publicProjection, publicBoard]) {
  const serialized = JSON.stringify(projection)
  expect(serialized).not.toContain(self.id); expect(serialized).not.toContain(other.id)
  expect(serialized).not.toMatch(/operatorId|ownerId|owner_operator_id|penny_request_owners|penny_board_owners/)
 }
 await assign('requests', submitted.slug, null, cookie); await assign('evidence', evidenceId!, null, cookie)
 expect((await queue(other.cookie)).totals).toEqual({ requests: 0, evidence: 0, comments: 0 })
 await assign('boards', 'owned-feedback', other.id, cookie)
 expect((await ownerOf('requests', manual.request.slug, cookie)).owner?.id).toBe(self.id)
 await good(`/api/operator/settings/operators/${other.nativeId}`, {}, cookie, 'DELETE')
 expect((await call(`/api/operator/ownership/requests/${manual.request.slug}`, { operatorId: other.id }, cookie, 'PATCH')).status).toBe(409)
 const inactive = await capture(cookie, 'owned-feedback', 'Inactive default is not authority')
 expect((await ownerOf('requests', inactive.request.slug, cookie)).owner).toBeNull()
 expect((await ownerOf('evidence', inactive.evidence.id, cookie)).owner).toBeNull()
 expect((await call('/api/operator/ownership/queue', undefined, other.cookie)).status).toBe(401)
 await assign('boards', 'owned-feedback', null, cookie)
})

it('[TRIAGE-001] requester comments follow the request owner, require review before handling and reappear for a new owner', async () => {
 const { cookie, self } = await setup(), other = await peer(cookie)
 await assign('boards', 'owned-feedback', self.id, cookie)
 const { request } = await capture(cookie, 'owned-feedback')
 await good(`/api/operator/moderation/${request.slug}`, { verdict: 'approved', title: 'Approved request', description: 'Approved wording', boardSlug: 'owned-feedback', displayName: 'Operator' }, cookie)
 const identity = await requester('Comment author')
 const comment = await good(`/api/public/requests/${request.slug}/comments`, { body: 'Please explain this workflow' }, identity, 'POST', 201)
 expect((await queue(cookie)).comments.map(row => row.id)).toEqual([comment.id])
 expect((await queue(other.cookie)).comments).toEqual([])
 const pending = (await queue(cookie)).comments[0]
 expect((await call(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: pending.updatedAt }, cookie)).status).toBe(409)
 await good(`/api/operator/comments/${comment.id}/moderate`, { verdict: 'approved', publicAuthorDisplayName: 'Customer' }, cookie)
 const approved = (await queue(cookie)).comments[0]
 expect((await call(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: approved.updatedAt }, other.cookie)).status).toBe(409)
 await good(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: approved.updatedAt }, cookie)
 expect((await queue(cookie)).comments).toEqual([])
 await good(`/api/public/comments/${comment.id}`, { body: 'An updated workflow question' }, identity, 'PATCH')
 expect((await queue(cookie)).comments).toMatchObject([{ id: comment.id, moderationState: 'awaiting_review' }])
 expect((await call(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: approved.updatedAt }, cookie)).status).toBe(409)
 const editId = await env.DB.prepare("SELECT id FROM request_comment_edits WHERE comment_id=? AND moderation_state='awaiting_review'").bind(comment.id).first<string>('id')
 await good(`/api/operator/comments/edits/${editId}/moderate`, { verdict: 'rejected', reason: 'Keep the original question' }, cookie)
 expect((await queue(cookie)).comments).toEqual([])
 await assign('requests', request.slug, other.id, cookie)
 expect((await queue(other.cookie)).comments.map(row => row.id)).toEqual([comment.id])
 expect((await queue(cookie)).comments).toEqual([])
 await good(`/api/operator/ownership/comments/${comment.id}/handled`, { updatedAt: approved.updatedAt }, other.cookie)
 const portable = await good<{ archive: Archive }>('/api/operator/data/export', undefined, cookie)
 expect(portable.archive.tables.penny_comment_receipts).toHaveLength(2)
 await good('/api/operator/boards/owned-feedback', { archived: true }, cookie, 'PATCH')
 expect((await queue(other.cookie)).requests).toEqual([])
 expect((await ownerOf('requests', request.slug, cookie)).owner?.id).toBe(other.id)
})

it('[TRIAGE-001] session revocation and target removal between admission and the ownership transaction refuse the entire assignment', async () => {
 const { cookie, self } = await setup(), other = await peer(cookie), { request } = await capture(cookie, 'owned-feedback')
 await assign('requests', request.slug, self.id, cookie)
 const app = createPennyApi()
 async function racedAssignment(revoke: () => Promise<void>) {
  let crossed = false
  const db = observeD1(env.DB, { before: async statements => {
   if (!crossed && statements.some(sql => sql.includes('INSERT INTO penny_ownership_guards'))) { crossed = true; await revoke() }
  } })
  const response = await app.fetch(new Request(origin + `/api/operator/ownership/requests/${request.slug}`, { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json', ...cookie }, body: JSON.stringify({ operatorId: other.id }) }), { ...env, DB: db })
  expect(crossed).toBe(true)
  return response
 }
 const before = await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='ownership.assigned'").first<number>('n')
 expect((await racedAssignment(async () => { await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE id=?").bind(other.nativeId).run() })).status).toBe(409)
 expect((await ownerOf('requests', request.slug, cookie)).owner?.id).toBe(self.id)
 expect((await racedAssignment(async () => { await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run() })).status).toBe(401)
 expect(await env.DB.prepare('SELECT operator_id FROM penny_request_owners WHERE request_id=?').bind(request.id).first<string>('operator_id')).toBe(self.id)
 expect(await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='ownership.assigned'").first<number>('n')).toBe(before)
})

it('[TRIAGE-001][DATA-001][DATA-003] archives retain private assignment history without authority and erasure removes the ownership graph', async () => {
 const { cookie, self } = await setup()
 await assign('boards', 'owned-feedback', self.id, cookie)
 const { request, evidence } = await capture(cookie, 'owned-feedback')
 const portable = await good<{ archive: Archive; journal: ErasureJournal }>('/api/operator/data/export', undefined, cookie)
 expect(portable.archive.tables.penny_request_owners.find(row => row.request_id === request.id)?.operator_id).toBe(self.id)
 expect(portable.archive.tables.penny_evidence_owners.find(row => row.evidence_id === evidence.id)?.operator_id).toBe(self.id)
 expect(portable.archive.tables).not.toHaveProperty('penny_ownership_guards')
 await reset(); await applyD1Migrations(env.DB, inject('migrations'))
 const restored = await owner()
 let result = await good<{ status: string; operationId: string }>('/api/operator/data/import', portable, restored, 'POST', [200, 202])
 for (let step = 0; step < 80 && result.status !== 'complete'; step++) {
  const response = await call(`/api/operator/data/operations/${result.operationId}/resume`, {}, restored)
  expect([200, 202], await response.clone().text()).toContain(response.status)
  result = await response.json() as typeof result
 }
 expect(result.status).toBe('complete')
 expect((await ownerOf('requests', request.slug, restored)).owner?.id).toBe(self.id)
 expect((await ownerOf('evidence', evidence.id, restored)).owner?.id).toBe(self.id)
 expect((await queue(restored)).requests.map(row => row.id)).toEqual([request.id])
 const target = { table: 'evidence_items', id: evidence.id }
 const preview = await good<{ planHash: string; counts: Record<string, number>; blockedCopies: unknown[] }>('/api/operator/data/erasure/preview', target, restored)
 expect(preview.counts.penny_evidence_owners).toBe(1); expect(preview.blockedCopies).toEqual([])
 await good('/api/operator/data/erasure', { ...target, planHash: preview.planHash }, restored)
 expect((await ownerOf('requests', request.slug, restored)).owner?.id).toBe(self.id)
 expect((await queue(restored)).evidence).toEqual([])
 expect(await env.DB.prepare('SELECT evidence_id FROM penny_evidence_owners WHERE evidence_id=?').bind(evidence.id).first()).toBeNull()
 const former=await peer(restored),formerName=await env.DB.prepare('SELECT display_name FROM operators WHERE id=?').bind(former.id).first<string>('display_name')
 await assign('requests',request.slug,former.id,restored);await assign('boards','owned-feedback',former.id,restored)
 await good(`/api/operator/settings/operators/${former.nativeId}`,{},restored,'DELETE')
 const operatorTarget={table:'operators',id:former.id},operatorPreview=await good<{planHash:string;blockedCopies:unknown[]}>('/api/operator/data/erasure/preview',operatorTarget,restored)
 expect(operatorPreview.blockedCopies).toEqual([])
 await good('/api/operator/data/erasure',{...operatorTarget,planHash:operatorPreview.planHash},restored)
 const retained=(await ownerOf('requests',request.slug,restored)).owner
 expect(retained?.active).toBe(false);expect(retained?.displayName).not.toBe(formerName)
 const anonymized=await good<{archive:Archive}>('/api/operator/data/export',undefined,restored)
 expect(JSON.stringify(anonymized.archive)).not.toContain('assigned-peer@example.test')
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
