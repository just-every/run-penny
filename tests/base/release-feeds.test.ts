import { applyD1Migrations, reset } from 'cloudflare:test'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import type { CurrentPublicRelease } from '@/core/features/releases/public-read-repository'
import { call, env, origin } from './support'
import { nativeReleaseDraft, releaseGraph } from './release-fixture'
import { rows } from './notification-regression-fixture'
import { planErasure } from '@/core/features/data/archive'
import { eraseEntity } from '@/core/features/data/operations'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const atomNamespace = 'http://www.w3.org/2005/Atom'
const paths = ['/api/public/releases/rss.xml', '/api/public/releases/atom.xml']
type Element = Record<string, unknown>
function parseXml(source: string): Element {
  expect(XMLValidator.validate(source)).toBe(true)
  return new XMLParser({ ignoreAttributes: false, trimValues: false, parseTagValue: false, alwaysCreateTextNode: true }).parse(source) as Element
}
function children(node: Element, name: string): Element[] {
  const value = node[name]
  return value === undefined ? [] : (Array.isArray(value) ? value : [value]) as Element[]
}
function one(node: Element, name: string): Element {
  const matches = children(node, name)
  expect(matches, `Exactly one ${name}`).toHaveLength(1)
  return matches[0]
}
const text = (node: Element, name: string) => String(one(node, name)['#text'] ?? '')
const attribute = (node: Element, name: string) => node[`@_${name}`]
async function json<T>(response: Response, status = 200): Promise<T> {
  expect(response.status, await response.clone().text()).toBe(status)
  return response.json() as Promise<T>
}
function timestamp(value: string | null): void {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)
  expect(Number.isFinite(Date.parse(value!))).toBe(true)
}

// Parse the actual HTTP responses offline, then check the RSS 2.0 and Atom
// required structure and reconcile every entry with native public reads.
async function feeds(expectedSlugs: string[], excluded: string[] = []) {
  const tables = ['releases', 'release_versions', 'release_recipient_snapshots', 'release_recipient_contexts',
    'notification_outbox', 'notification_outbox_attempts', 'requester_update_permissions']
  const custody = await Promise.all(tables.map(rows))
  const sent = vi.isMockFunction(fetch) ? vi.mocked(fetch).mock.calls.length : undefined
  const current = await json<CurrentPublicRelease[]>(await call('/api/public/releases'))
  expect(current.map(release => release.slug)).toEqual(expectedSlugs)
  for (const release of current) {
    expect(await json(await call(`/api/public/releases/${release.slug}`))).toEqual(release)
    expect(release).not.toHaveProperty('updatedAt')
  }
  const documents: Element[] = []
  const bodies: string[] = []
  for (const [index, path] of paths.entries()) {
    const response = await call(path)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(`application/${index === 0 ? 'rss' : 'atom'}+xml; charset=utf-8`)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    const body = await response.text()
    for (const marker of excluded) expect(body).not.toContain(marker)
    expect(body).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    const document = parseXml(body)
    documents.push(document); bodies.push(body)
  }
  const rss = one(documents[0], 'rss')
  expect(attribute(rss, 'version')).toBe('2.0')
  const channel = one(rss, 'channel')
  expect(text(channel, 'title')!.length).toBeGreaterThan(0)
  expect(text(channel, 'description')!.length).toBeGreaterThan(0)
  expect(text(channel, 'link')).toBe(`${origin}/portal/updates`)
  const rssSelf = one(channel, 'atom:link')
  expect(attribute(rss, 'xmlns:atom')).toBe(atomNamespace)
  expect(attribute(rssSelf, 'rel')).toBe('self')
  expect(attribute(rssSelf, 'href')).toBe(origin + paths[0])
  const items = children(channel, 'item')
  const atom = one(documents[1], 'feed')
  expect(attribute(atom, 'xmlns')).toBe(atomNamespace)
  expect(text(atom, 'id')).toBe(`${origin}/portal/updates`)
  expect(text(atom, 'title')!.length).toBeGreaterThan(0)
  timestamp(text(atom, 'updated'))
  expect(text(one(atom, 'author'), 'name')!.length).toBeGreaterThan(0)
  const atomSelf = children(atom, 'link').filter(link => attribute(link, 'rel') === 'self')
  expect(atomSelf).toHaveLength(1); expect(attribute(atomSelf[0], 'href')).toBe(origin + paths[1])
  const entries = children(atom, 'entry')
  expect(items).toHaveLength(current.length); expect(entries).toHaveLength(current.length)
  for (const [index, release] of current.entries()) {
    const item = items[index], entry = entries[index], url = `${origin}/portal/updates/${release.slug}`
    expect(text(item, 'guid')).toBe(url); expect(attribute(one(item, 'guid'), 'isPermaLink')).toBe('true')
    expect(text(item, 'link')).toBe(url); expect(text(entry, 'id')).toBe(url)
    expect(attribute(one(entry, 'link'), 'href')).toBe(url)
    expect(text(item, 'title')).toBe(release.title); expect(text(entry, 'title')).toBe(release.title)
    expect(attribute(one(entry, 'title'), 'type')).toBe('text')
    expect(Date.parse(text(item, 'pubDate')!)).toBe(Date.parse(`${release.publicationDate}T00:00:00Z`))
    expect(text(entry, 'published')).toBe(`${release.publicationDate}T00:00:00.000Z`)
    timestamp(text(entry, 'updated'))
    expect(text(one(entry, 'author'), 'name')).toBe(release.authorName)
    expect(attribute(one(entry, 'content'), 'type')).toBe('text')
    expect(text(entry, 'content')).toBe(release.body)
    // RSS descriptions contain encoded HTML text. Parsing that layer must
    // produce the original Markdown as text, with no active markup.
    const description = one(parseXml(`<div>${text(item, 'description')}</div>`), 'div')
    expect(description).toEqual({ '#text': release.body })
    expect(one(entry, 'content')).toEqual({ '#text': release.body, '@_type': 'text' })
    // A feed reader can follow the canonical link without operator authority.
    const page = await call(new URL(url).pathname)
    expect(page.status).toBe(200)
    expect(page.headers.get('Content-Type')).toContain('text/html')
  }
  expect(await Promise.all(tables.map(rows))).toEqual(custody)
  if (sent !== undefined) expect(fetch).toHaveBeenCalledTimes(sent)
  return { entries, bodies }
}

it('[REL-016 DATA-003 REL-003 REL-005] RSS and Atom reconcile current published wording across correction and requester erasure', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T12:00:00.000Z'))
  await feeds([])
  const g = await releaseGraph(1)
  await env.DB.prepare("UPDATE tags SET name='Confidential tag marker' WHERE id='release-tag'").run()
  const original = { title: 'Approved & <release> "one"', body: 'Public request 0 is now easier. Public & customer wording: <script>literal text</script>, "quotes", apostrophe\'s and ]]> with 🪙.' }
  await json(await call(`/api/operator/releases/${g.draft.slug}`, { ...g.input, ...original }, g.operator, 'PATCH'))
  const draft = await nativeReleaseDraft(g, { title: 'Unpublished draft marker', body: 'Unpublished draft body marker' })
  const scheduled = await nativeReleaseDraft(g, { title: 'Scheduled release marker', body: 'Scheduled body marker' })
  await json(await call(`/api/operator/releases/${scheduled.slug}/schedule`, { localTime: '2026-11-07T12:00' }, g.operator))
  const excluded = [draft.slug, scheduled.slug, 'Unpublished draft marker', 'Unpublished draft body marker', 'Scheduled release marker', 'Scheduled body marker',
    'Private decision marker', 'Private question', 'Private commercial rationale', 'Private item title', 'Private item summary', 'Private delivery notes',
    'private-decision-slug', 'private-item-slug', 'Confidential tag marker', g.recipient.email, g.recipient.requesterId, g.actor,
    'recipient_email', 'requester_id', 'requester_address_id', 'outcome_prompt', 'subject_tags_json', 'delivery_notes', 'decision_id', 'author_operator_id']
  await feeds([], excluded)
  for (const release of [g.draft, draft, scheduled]) expect((await call(`/api/public/releases/${release.slug}`)).status).toBe(404)
  const publish = async (slug: string) => json(await call(`/api/operator/releases/${slug}/publish`, {}, g.operator))
  await publish(g.draft.slug)
  const before = await feeds([g.draft.slug], excluded)
  expect(text(before.entries[0], 'title')).toBe(original.title)
  expect(text(before.entries[0], 'content')).toBe(original.body)
  const peers = await Promise.all([
    nativeReleaseDraft(g, { title: 'Later public release', publicationDate: '2026-10-10' }),
    nativeReleaseDraft(g, { title: 'Same-day public release', publicationDate: '2026-10-10' }),
  ])
  for (const peer of peers) await publish(peer.slug)
  const ordered = [...peers.map(peer => peer.slug).sort(), g.draft.slug]
  await feeds(ordered, excluded)
  const custody = await Promise.all(['release_recipient_snapshots', 'release_recipient_contexts', 'notification_outbox'].map(rows))
  const correctedAt = '2026-11-06T13:00:00.000Z'
  vi.setSystemTime(new Date(correctedAt))
  const corrected = { title: 'Corrected & <approved> "release"', body: 'Public request 0 is now easier. Corrected customer text & <b>literal markup</b> with apostrophe\'s and ]]>.' }
  await json(await call(`/api/operator/releases/${g.draft.slug}/corrections`, { expectedVersionId: g.draft.versionId, ...corrected }, g.operator), 201)
  const after = await feeds(ordered, [...excluded, original.title, original.body])
  const correctedEntry = after.entries.at(-1)!
  expect(text(correctedEntry, 'id')).toBe(text(before.entries[0], 'id'))
  expect(text(correctedEntry, 'updated')).toBe(correctedAt)
  expect(text(correctedEntry, 'title')).toBe(corrected.title)
  expect(text(correctedEntry, 'content')).toBe(corrected.body)
  expect(await json(await call(`/api/public/releases/${g.draft.slug}`))).toMatchObject({ ...corrected, versionNumber: 2, isCurrent: true })
  for (const body of after.bodies) {
    expect(body).not.toContain('Approved &amp; &lt;release&gt;')
    expect(body).not.toContain('Public &amp; customer wording')
  }
  // Feed reads and correction never request a customer send or change custody.
  expect(await Promise.all(['release_recipient_snapshots', 'release_recipient_contexts', 'notification_outbox'].map(rows))).toEqual(custody)
  expect((await rows('releases')).find(row => row.id === scheduled.id)?.state).toBe('draft')
  expect((await rows('penny_publication_schedules')).find(row => row.release_id === scheduled.id)?.state).toBe('scheduled')
  // Preserve the existing approved-public-phrase erasure regression in this
  // same populated release journey instead of retaining its duplicate fixture.
  const versions = await rows('release_versions')
  const plan = await planErasure(env.DB, 'requesters', g.recipient.requesterId)
  expect(plan.blockedCopies).toEqual([])
  await eraseEntity(env.DB, env.FILES, 'requesters', g.recipient.requesterId, plan.planHash)
  expect(await rows('release_versions')).toEqual(versions)
  expect((await feeds(ordered, [...excluded, original.title, original.body])).bodies).toEqual(after.bodies)
})
