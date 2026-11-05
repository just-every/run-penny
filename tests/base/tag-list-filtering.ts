import { expect } from 'vitest'
import { call, env, mockMail, requester } from './support'
import { explicitConsentBoard } from './explicit-consent-board'

type Page = { items: { id: string; entity?: string }[]; total: number }
type Identity = { id: string; slug: string }

async function json<T>(response: Promise<Response>, status = 200): Promise<T> {
  const result = await response
  expect(result.status, await result.clone().text()).toBe(status)
  return result.json() as Promise<T>
}

/** Two native product graphs distinguish a matching record from an unrelated one in every list. */
export async function proveTagFiltering(operator: { Cookie: string }, tag: { id: string; name: string }, otherTagId: string) {
  mockMail()
  await explicitConsentBoard('tag-custody', (path, method, body) => call(path, body, operator, method))
  const options = await json<{ operators: { id: string }[] }>(call('/api/operator/loop/options', undefined, operator))
  const actor = options.operators[0].id
  const graphs = []
  for (const matching of [true, false]) {
    const label = matching ? 'Tagged custody' : 'Other custody'
    const person = await requester(label)
    const session = await json<{ displayName: string }>(call('/api/public/identity/session', undefined, person))
    expect(session.displayName).toBe(label)
    const people = await json<Page>(call(`/api/operator/requesters?q=${encodeURIComponent(label)}`, undefined, operator))
    expect(people.total).toBe(1)
    const account = await json<Identity>(call('/api/operator/accounts', { name: label, internalOwnerId: actor }, operator), 201)
    const submitted = await json<{ slug: string }>(call('/api/public/requests', { title: label, description: 'Custody filter request', boardSlug: 'tag-custody', idempotencyKey: crypto.randomUUID() }, person), 201)
    const context = await json<{ requestId: string }>(call(`/api/operator/requests/${submitted.slug}/context`, undefined, operator))
    const evidence = await json<{ id: string }>(call('/api/operator/evidence', { sourceType: 'interview', wording: label, observedAt: '2026-11-01T12:00:00.000Z', accountId: account.id, requestLinks: [{ id: context.requestId }] }, operator), 201)
    const decision = await json<Identity>(call('/api/operator/decisions', { question: label, ownerOperatorId: actor }, operator), 201)
    const bet = await json<{ id: string }>(call(`/api/operator/decisions/${decision.id}/bets`, { title: label, summary: 'A concrete approach', urgency: 'Soon', deliveryShape: 'Small release', successMeasure: 'Less effort' }, operator), 201)
    await json(call(`/api/operator/decisions/${decision.id}/bets`, { title: 'Alternative', summary: 'A different approach' }, operator), 201)
    expect((await call(`/api/operator/evidence/${evidence.id}/links`, { target: 'bet', targetId: bet.id }, operator, 'PUT')).status).toBe(200)
    if (matching) {
      expect((await call(`/api/operator/evidence/${evidence.id}/tag`, { tagId: tag.id }, operator, 'PUT')).status).toBe(200)
      expect((await call(`/api/operator/catalog/requests/${context.requestId}/tags/${tag.id}`, {}, operator, 'PUT')).status).toBe(200)
    }
    // Before commitment, the prepared decision appears in the overview's decision list.
    const ready = await json<Record<string, { id: string }[]>>(call(`/api/operator/overview?tag=${tag.id}`, undefined, operator))
    expect(ready.decisions.some(row => row.id === decision.id)).toBe(matching)
    const commitment = await json<{ itemId: string }>(call(`/api/operator/decisions/${decision.id}/commit`, { selectedCandidateBetId: bet.id, rationale: 'Evidence supports this choice', ownerOperatorId: actor, confidence: 'medium', reviewAt: '2026-12-01', noViableAlternativeReason: 'One supported approach' }, operator))
    expect((await call(`/api/operator/requests/${submitted.slug}/moderate`, { verdict: 'approved', title: label, description: 'Customer wording', publicAuthorDisplayName: label }, operator)).status).toBe(200)
    expect((await call(`/api/operator/roadmap/${commitment.itemId}/approve`, { publicTitle: label, publicSummary: 'Customer wording', boardSlug: 'tag-custody', requestIds: [context.requestId] }, operator)).status).toBe(200)
    await json(call(`/api/operator/roadmap/${commitment.itemId}/move`, { status: 'in_progress', reason: 'Work started', idempotencyKey: crypto.randomUUID() }, operator))
    const active = await json<Record<string, { id: string }[]>>(call(`/api/operator/overview?tag=${tag.id}`, undefined, operator))
    expect(active.roadmap.some(row => row.id === commitment.itemId)).toBe(matching)
    await json(call(`/api/operator/roadmap/${commitment.itemId}/move`, { status: 'shipped', reason: 'Work delivered', idempotencyKey: crypto.randomUUID() }, operator))
    const updateIds = (await env.DB.prepare('SELECT id FROM roadmap_update_versions WHERE roadmap_item_id=? ORDER BY version_number').bind(commitment.itemId).all<{ id: string }>()).results.map(row => row.id)
    expect(updateIds).toHaveLength(2)
    const shipped = await json<Record<string, { id: string }[]>>(call(`/api/operator/overview?tag=${tag.id}`, undefined, operator))
    expect(shipped.shippedWithoutRelease.some(row => row.id === commitment.itemId)).toBe(matching)
    const release = await json<Identity>(call('/api/operator/releases', { title: label, body: 'Customer wording', releaseType: 'improved', tagIds: [matching ? tag.id : otherTagId], publicationDate: '2026-11-01', targetIds: [commitment.itemId], authorOperatorId: actor }, operator), 201)
    expect((await call(`/api/operator/releases/${release.slug}/publish`, {}, operator)).status).toBe(200)
    // Keep a held request to exercise the separate moderation list and overview preview.
    const held = await json<Identity>(call('/api/operator/requests', { title: label, description: 'Held custody request', boardSlug: 'tag-custody' }, operator), 201)
    if (matching) expect((await call(`/api/operator/catalog/requests/${held.id}/tags/${tag.id}`, {}, operator, 'PUT')).status).toBe(200)
    graphs.push({ matching, account: account.id, requester: people.items[0].id, request: context.requestId, evidence: evidence.id, decision: decision.id, roadmap: commitment.itemId, release: release.id, held: held.id, updates: updateIds })
  }
  const [match, control] = graphs
  const selected: Record<string, string[]> = {
    requests: [match.request, match.held], evidence: [match.evidence], decisions: [match.decision], roadmap: [match.roadmap],
    releases: [match.release], accounts: [match.account], requesters: [match.requester], moderation: [match.held], 'roadmap-updates': match.updates,
  }
  const unrelated: Record<string, string[]> = {
    requests: [control.request, control.held], evidence: [control.evidence], decisions: [control.decision], roadmap: [control.roadmap],
    releases: [control.release], accounts: [control.account], requesters: [control.requester], moderation: [control.held], 'roadmap-updates': control.updates,
  }
  for (const [entity, ids] of Object.entries(selected)) {
    const all = await json<Page>(call(`/api/operator/${entity}`, undefined, operator))
    expect(all.items.map(row => row.id), entity).toEqual(expect.arrayContaining([...ids, ...unrelated[entity]]))
    // The original merge graph also uses this tag; isolate the new graph by its distinct wording.
    for (const value of [tag.id, tag.name]) {
      const page = await json<Page>(call(`/api/operator/${entity}?tag=${encodeURIComponent(value)}`, undefined, operator))
      expect(page.items.map(row => row.id), entity).toEqual(expect.arrayContaining(ids))
      for (const id of unrelated[entity]) expect(page.items.map(row => row.id), entity).not.toContain(id)
      expect(page.total, entity).toBe(page.items.length)
    }
    const empty = await json<Page>(call(`/api/operator/${entity}?tag=synthetic-penny-no-match`, undefined, operator))
    expect(empty.items, entity).toEqual([])
    expect(empty.total, entity).toBe(0)
  }
  const search = await json<Page>(call(`/api/operator/search?q=custody&tag=${tag.id}`, undefined, operator))
  for (const [entity, id] of Object.entries({ requests: match.request, evidence: match.evidence, decisions: match.decision, roadmap: match.roadmap, releases: match.release, accounts: match.account, requesters: match.requester })) {
    expect(search.items, entity).toContainEqual(expect.objectContaining({ entity, id }))
    expect(search.items, entity).not.toContainEqual(expect.objectContaining({ entity, id: unrelated[entity][0] }))
  }
  const overview = await json<Record<string, { id: string }[]>>(call(`/api/operator/overview?tag=${tag.id}`, undefined, operator))
  for (const [key, ids, refused] of [
    ['unreviewedEvidence', [match.evidence], [control.evidence]],
    ['recentReleases', [match.release], [control.release]], ['awaitingModeration', [match.held], [control.held]],
    ['unpublishedStatusUpdates', [match.updates.at(-1)!], control.updates],
  ] as const) {
    expect(overview[key].map(row => row.id), key).toEqual(expect.arrayContaining([...ids]))
    for (const id of refused) expect(overview[key].map(row => row.id), key).not.toContain(id)
  }
}
