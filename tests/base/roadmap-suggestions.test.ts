import { applyD1Migrations } from 'cloudflare:test'
import { afterEach, beforeAll, expect, inject, it, vi } from 'vitest'
import { call, env } from './support'
import { graph } from './notification-regression-fixture'

beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')) })
afterEach(() => vi.restoreAllMocks())

it('[ROAD-004][DEC-005][EVID-006] proposes only the selected bet’s linked published public requests', async () => {
  const g = await graph(4)
  async function create(path: string, input: unknown) {
    const response = await call(path, input, g.operator)
    expect(response.status, await response.clone().text()).toBe(201)
    return await response.json() as { id: string }
  }
  const decision = await create('/api/operator/decisions', { question: 'Which feedback should we address?', ownerOperatorId: (await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id })
  const bets = await Promise.all(['Selected approach', 'Other approach'].map(title => create(`/api/operator/decisions/${decision.id}/bets`, { title, summary: 'A bounded approach' })))
  await create('/api/operator/boards', { name: 'Internal', slug: 'internal', visibility: 'internal' })
  const internal = (await env.DB.prepare("SELECT id FROM boards WHERE slug='internal'").first<{id:string}>())!
  await env.DB.batch([
    env.DB.prepare("UPDATE requests SET moderation_state='awaiting_review',published_at=NULL WHERE id=?").bind(g.requests[2].id),
    env.DB.prepare('UPDATE requests SET board_id=? WHERE id=?').bind(internal.id, g.requests[3].id),
  ])
  for (const [index, request] of g.requests.entries()) {
    const evidence = (await env.DB.prepare('SELECT evidence_id FROM request_evidence_links WHERE request_id=?').bind(request.id).first<{evidence_id:string}>())!
    expect((await call(`/api/operator/evidence/${evidence.evidence_id}/links`, { target: 'bet', targetId: bets[index === 1 ? 1 : 0].id, stance: 'supporting' }, g.operator, 'PUT')).status).toBe(200)
  }
  const operatorId = (await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
  const committed = await call(`/api/operator/decisions/${decision.id}/commit`, { selectedCandidateBetId: bets[0].id, rationale: 'Choose the selected problem', ownerOperatorId: operatorId, confidence: 'medium', reviewAt: '2026-12-01' }, g.operator)
  expect(committed.status, await committed.clone().text()).toBe(200)
  const { itemId } = await committed.json() as {itemId:string}
  const context = await call(`/api/operator/roadmap/${itemId}/context`, undefined, g.operator)
  expect(context.status).toBe(200)
  expect((await context.json() as {proposed:unknown[]}).proposed).toEqual([{ ...g.requests[0], title: 'Public request 0' }])
})
