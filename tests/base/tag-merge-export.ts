import { expect } from 'vitest'
import type { exportArchive } from '../../src/core/features/data/archive'
import { call, env } from './support'
import { proveTagFiltering } from './tag-list-filtering'

type Tag = { id: string; name: string; created_at: string; updated_at: string }
type Request = { id: string; slug: string }
type Assignment = { tag_id: string; created_at: string } & Record<string, string>

async function json<T>(response: Promise<Response>, status = 200): Promise<T> {
  const result = await response
  expect(result.status, await result.clone().text()).toBe(status)
  return result.json() as Promise<T>
}

export async function proveNativeTagCustody(operator: { Cookie: string }) {
  expect((await call('/api/operator/boards', { name: 'Tag custody', slug: 'tag-custody', visibility: 'public' }, operator)).status).toBe(201)
  const names = ['synthetic-penny-1', 'synthetic-penny-2', 'synthetic-penny-3', 'synthetic-penny-4']
  const tags = await Promise.all(names.map(name => json<{ id: string }>(call('/api/operator/catalog/tags', { name }, operator), 201)))
  const [sourceTag, canonicalTag, sharedTag, evidenceTag] = tags
  const catalog = await json<{ tags: Tag[] }>(call('/api/operator/catalog/settings', undefined, operator))
  expect(catalog.tags.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
    .toEqual(tags.map((tag, index) => ({ id: tag.id, name: names[index] })))

  const evidence = await Promise.all(['Source evidence', 'Canonical evidence'].map(wording =>
    json<{ id: string }>(call('/api/operator/evidence', { sourceType: 'interview', wording, observedAt: '2026-11-01T12:00:00.000Z' }, operator), 201)))
  const [source, canonical] = await Promise.all(evidence.map((item, index) =>
    json<Request>(call('/api/operator/requests', { title: index ? 'Canonical request' : 'Duplicate request', description: 'Customer wording', boardSlug: 'tag-custody', evidenceIds: [item.id] }, operator), 201)))
  for (const request of [source, canonical]) {
    expect((await call(`/api/operator/requests/${request.slug}/moderate`, { verdict: 'approved', title: 'Customer request', description: 'Customer wording' }, operator)).status).toBe(200)
  }
  const requestPairs = [[source.id, sourceTag.id], [source.id, sharedTag.id], [canonical.id, canonicalTag.id], [canonical.id, sharedTag.id]]
  const evidencePairs = [[evidence[0].id, sourceTag.id], [evidence[0].id, sharedTag.id], [evidence[0].id, evidenceTag.id], [evidence[1].id, canonicalTag.id]]
  for (const [requestId, tagId] of requestPairs) {
    expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${tagId}`, {}, operator, 'PUT')).status).toBe(200)
  }
  for (const [evidenceId, tagId] of evidencePairs) {
    expect((await call(`/api/operator/evidence/${evidenceId}/tag`, { tagId }, operator, 'PUT')).status).toBe(200)
  }
  const context = (request: Request) => json<{ requestId: string; tags: { id: string; name: string }[] }>(call(`/api/operator/requests/${request.slug}/context`, undefined, operator))
  const expectedTags = (ids: string[]) => catalog.tags.filter(tag => ids.includes(tag.id)).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  expect((await context(source)).tags).toEqual(expectedTags([sourceTag.id, sharedTag.id]))
  expect((await context(canonical)).tags).toEqual(expectedTags([canonicalTag.id, sharedTag.id]))
  const evidenceBefore = (await env.DB.prepare('SELECT * FROM evidence_tag_assignments ORDER BY evidence_id,tag_id').all<Assignment>()).results

  expect((await call(`/api/operator/requests/${source.slug}/merge`, { targetSlug: canonical.slug, notifySubscribers: false }, operator)).status).toBe(200)
  expect(await context(canonical)).toMatchObject({ requestId: canonical.id, tags: expectedTags([sourceTag.id, canonicalTag.id, sharedTag.id]) })
  expect((await context(source)).tags).toEqual(expectedTags([sourceTag.id, sharedTag.id]))
  const retainedEvidence = await json<{ items: { id: string; tags: string[] }[] }>(call('/api/operator/evidence', undefined, operator))
  expect(retainedEvidence.items.find(item => item.id === evidence[0].id)?.tags.sort()).toEqual([names[0], names[2], names[3]])
  expect(retainedEvidence.items.find(item => item.id === evidence[1].id)?.tags).toEqual([names[1]])
  expect((await env.DB.prepare('SELECT * FROM evidence_tag_assignments ORDER BY evidence_id,tag_id').all()).results).toEqual(evidenceBefore)
  const links = await json<{ target: string; targetId: string }[]>(call(`/api/operator/evidence/${evidence[0].id}/links`, undefined, operator))
  expect(links.map(({ target, targetId }) => ({ target, targetId })))
    .toEqual([{ target: 'request', targetId: canonical.id }])

  // Refused readers receive no archive or private catalog, even when it is populated.
  for (const path of ['/api/operator/catalog/settings', `/api/operator/requests/${canonical.slug}/context`, '/api/operator/data/export']) {
    const refused = await call(path)
    expect(refused.status).toBe(401)
    const body = await refused.text()
    for (const name of names) expect(body).not.toContain(name)
  }
  for (const path of ['/api/public/requests', `/api/public/requests/${canonical.slug}`]) {
    const response = await call(path)
    expect(response.status).toBe(200)
    const body = await response.text()
    for (const tag of catalog.tags) { expect(body).not.toContain(tag.name); expect(body).not.toContain(tag.id) }
  }

  const response = await call('/api/operator/data/export', undefined, operator)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const bundle = await response.json() as Awaited<ReturnType<typeof exportArchive>>
  expect(bundle.archive.tables.tags.sort((a, b) => String(a.name).localeCompare(String(b.name)))).toEqual(catalog.tags)
  const pairs = (rows: Record<string, unknown>[], key: string) => rows.map(row => [row[key], row.tag_id]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const sorted = (rows: string[][]) => rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  expect(pairs(bundle.archive.tables.request_tag_assignments, 'request_id'))
    .toEqual(sorted([...requestPairs, [canonical.id, sourceTag.id]]))
  expect(pairs(bundle.archive.tables.evidence_tag_assignments, 'evidence_id')).toEqual(sorted(evidencePairs))
  expect(bundle.archive.tables.evidence_tag_assignments.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    .toEqual([...evidenceBefore].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  const storedRequests = (await env.DB.prepare('SELECT * FROM request_tag_assignments ORDER BY request_id,tag_id').all()).results
  expect(bundle.archive.tables.request_tag_assignments.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    .toEqual(storedRequests.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
  expect(bundle.archive.tables.requests.find(request => request.id === source.id)?.merged_into_request_id).toBe(canonical.id)
  await proveTagFiltering(operator, { id: sourceTag.id, name: names[0] }, canonicalTag.id)

  const renamed = await json<{ id: string }>(call('/api/operator/catalog/tags', { name: 'synthetic-penny-5' }, operator), 201)
  expect((await call(`/api/operator/catalog/tags/${renamed.id}`, { name: 'synthetic-penny-6' }, operator, 'PATCH')).status).toBe(200)
  const changed = await json<{ tags: Tag[] }>(call('/api/operator/catalog/settings', undefined, operator))
  expect(changed.tags.find(tag => tag.id === renamed.id)?.name).toBe('synthetic-penny-6')
  expect(changed.tags.some(tag => tag.name === 'synthetic-penny-5')).toBe(false)
  for (const path of [`/api/operator/catalog/requests/${canonical.id}/tags/${renamed.id}`, `/api/operator/evidence/${evidence[0].id}/tag`]) {
    expect((await call(path, path.endsWith('/tag') ? { tagId: renamed.id } : {}, operator, 'PUT')).status).toBe(200)
  }
  expect((await call(`/api/operator/catalog/tags/${renamed.id}/merge`, { targetId: sourceTag.id }, operator)).status).toBe(200)
  expect((await context(canonical)).tags).toEqual(expectedTags([sourceTag.id, canonicalTag.id, sharedTag.id]))
  expect((await env.DB.prepare('SELECT * FROM evidence_tag_assignments WHERE evidence_id=? ORDER BY evidence_id,tag_id').bind(evidence[0].id).all()).results)
    .toEqual(evidenceBefore.filter(row => row.evidence_id === evidence[0].id))
  expect((await json<{ tags: Tag[] }>(call('/api/operator/catalog/settings', undefined, operator))).tags.some(tag => tag.id === renamed.id)).toBe(false)

  const removed = await json<{ id: string }>(call('/api/operator/catalog/tags', { name: 'synthetic-penny-7' }, operator), 201)
  expect((await call(`/api/operator/catalog/requests/${canonical.id}/tags/${removed.id}`, {}, operator, 'PUT')).status).toBe(200)
  expect((await call(`/api/operator/evidence/${evidence[1].id}/tag`, { tagId: removed.id }, operator, 'PUT')).status).toBe(200)
  expect((await call(`/api/operator/catalog/tags/${removed.id}`, undefined, operator, 'DELETE')).status).toBe(204)
  expect((await context(canonical)).tags).toEqual(expectedTags([sourceTag.id, canonicalTag.id, sharedTag.id]))
  const afterDelete = await json<{ items: { id: string; tags: string[] }[] }>(call('/api/operator/evidence', undefined, operator))
  expect(afterDelete.items.find(item => item.id === evidence[1].id)?.tags).toEqual([names[1]])
  expect((await json<{ tags: Tag[] }>(call('/api/operator/catalog/settings', undefined, operator))).tags.some(tag => tag.id === removed.id)).toBe(false)

  expect((await call('/api/auth/sign-out', {}, operator)).status).toBe(204)
  expect((await call('/api/operator/data/export', undefined, operator)).status).toBe(401)
  expect((await call(`/api/operator/catalog/requests/${canonical.id}/tags/${evidenceTag.id}`, {}, operator, 'PUT')).status).toBe(401)
  expect((await env.DB.prepare('SELECT * FROM request_tag_assignments WHERE request_id=? ORDER BY request_id,tag_id').bind(canonical.id).all()).results)
    .toEqual(storedRequests.filter(row => row.request_id === canonical.id))
}
