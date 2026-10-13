// ROAD-006: public roadmap identity now comes from explicit publication, while every safe-field/privacy assertion remains.
import { applyD1Migrations, reset } from 'cloudflare:test'
import { env, exports } from 'cloudflare:workers'
import { beforeEach, describe, expect, inject, it } from 'vitest'
import { createPennyApp } from '../../../src/core/app/worker'
import { AuthRepository } from '../../../src/core/features/auth/repository'
import { hashOperatorSessionToken, OPERATOR_SESSION_COOKIE } from '../../../src/core/features/auth/session'
import { importPennySample } from '../../../src/core/features/sample-data/service'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import type { OperatorDecisionBrief } from '../../../src/core/shared/api/operator'
import pennySample from '../../../sample-data/penny.v1.json'

const SAMPLE_OPERATOR_ID = '00000000000000000000000001'
const SESSION_ID = '01J0000000000000000000000Z'
const SESSION_TOKEN = 'read-spine-real-session'
const app = createPennyApp({
  runtimeConfiguration: {
    operatorAllowlist: ['aisha@example.test'],
    workspaceTimezone: 'Australia/Brisbane',
    publicOriginAllowlist: ['https://penny.test'],
  },
})

beforeEach(async () => {
  // Reset the complete native store, including new effect-ledger relationships.
  // The historical partial DELETE list no longer describes the schema.
  await reset()
  await applyD1Migrations(env.DB, inject('migrations'))
  await importPennySample(createDatabaseConnection(env.DB), pennySample)
})

async function request(pathname: string, init?: RequestInit): Promise<Response> {
  const incoming = new Request(`https://penny.test${pathname}`, init)
  return pathname.startsWith('/api/') ? app.fetch(incoming, env) : exports.default.fetch(incoming)
}

async function sessionHeaders(): Promise<Headers> {
  const now = new Date().toISOString()
  await new AuthRepository(createDatabaseConnection(env.DB)).createSession({
    id: SESSION_ID,
    operatorId: SAMPLE_OPERATOR_ID,
    tokenHash: await hashOperatorSessionToken(SESSION_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    now,
  })
  return new Headers({ Cookie: `${OPERATOR_SESSION_COOKIE}=${SESSION_TOKEN}` })
}

describe('D1 read spine', () => {
  it('[EVID-004] [DEC-002] preserves evidence stance labels and counts per candidate bet', async () => {
    const headers = await sessionHeaders()
    const path = '/api/operator/decisions/decision-scim-q4'
    const initialResponse = await request(path, { headers })
    expect(initialResponse.status).toBe(200)
    const initial = await initialResponse.json() as OperatorDecisionBrief
    const selectedId = '00000000000000000000000013'
    const alternativeId = '00000000000000000000000014'
    const evidenceId = '0000000000000000000000000H'
    const selected = initial.bets.find((bet) => bet.id === selectedId)!
    expect(selected.evidence.map((item) => item.stance)).toEqual(['supporting', 'supporting'])
    expect(selected.metrics).toMatchObject({ supportingCount: 2, contradictingCount: 0 })

    // One evidence item can support one option while contradicting another.
    await env.DB.prepare(`
      INSERT INTO candidate_bet_evidence_links (candidate_bet_id,evidence_id,stance,created_at)
      VALUES (?,?,'contradicting',?)
    `).bind(alternativeId, evidenceId, new Date().toISOString()).run()
    const response = await request(path, { headers })
    expect(response.status).toBe(200)
    const brief = await response.json() as OperatorDecisionBrief
    expect(brief.bets.find((bet) => bet.id === selectedId)?.evidence.find((item) => item.id === evidenceId)?.stance).toBe('supporting')
    const alternative = brief.bets.find((bet) => bet.id === alternativeId)!
    expect(alternative.evidence.find((item) => item.id === evidenceId)?.stance).toBe('contradicting')
    expect(alternative.metrics).toMatchObject({ supportingCount: 1, contradictingCount: 1 })
    for (const bet of brief.bets) {
      expect(bet.evidence.filter((item) => item.stance === 'supporting')).toHaveLength(bet.metrics.supportingCount)
      expect(bet.evidence.filter((item) => item.stance === 'contradicting')).toHaveLength(bet.metrics.contradictingCount)
    }
    // The API app's Aisha allowlist differs from the emitted Worker's existing
    // local owner allowlist. Align only this temporary fixture for document SSR.
    await env.DB.prepare('UPDATE operators SET email=? WHERE id=?')
      .bind('owner@penny.invalid', SAMPLE_OPERATOR_ID).run()
    const document = await request('/app/decisions/decision-scim-q4', { headers })
    expect(document.status).toBe(200)
    const html = await document.text()
    // Count visible labels, excluding the serialized hydration data.
    expect(html.match(/>Supporting<\/span>/g)).toHaveLength(3)
    expect(html.match(/>Contradicting<\/span>/g)).toHaveLength(1)
  })

  it('imports active roadmap publications and mappings idempotently', async () => {
    await importPennySample(createDatabaseConnection(env.DB), pennySample)
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM roadmap_publications) AS publications,
        (SELECT COUNT(*) FROM roadmap_request_mappings) AS mappings
    `).first<{ publications: number; mappings: number }>()
    expect(counts).toEqual({ publications: 1, mappings: 1 })
  })

  it('[REQ-001] returns only customer-safe projected portal data', async () => {
    const [boards, requests, detail, roadmap, releases] = await Promise.all([
      request('/api/public/boards'),
      request('/api/public/requests?sort=votes'),
      request('/api/public/requests/scim-provisioning'),
      request('/api/public/roadmap'),
      request('/api/public/releases'),
    ])

    expect(boards.status).toBe(200)
    await expect(boards.json()).resolves.toEqual([
      { slug: 'enterprise-identity', name: 'Enterprise identity', requestCount: 1 },
      { slug: 'collaboration', name: 'Collaboration', requestCount: 1 },
    ])
    await expect(requests.json()).resolves.toMatchObject([
      { slug: 'scim-provisioning', status: 'planned', voteCount: 2, commentCount: 1 },
      { slug: 'shared-external-threads', status: 'open', voteCount: 1, commentCount: 0 },
    ])
    await expect(detail.json()).resolves.toMatchObject({
      slug: 'scim-provisioning',
      status: 'planned',
      comments: [{ author: { kind: 'operator', displayName: 'Aisha Khan' } }],
    })
    await expect(roadmap.json()).resolves.toEqual([
      {
        slug: (await env.DB.prepare('SELECT public_slug FROM roadmap_publications').first<{public_slug:string}>())!.public_slug,
        title: 'SCIM provisioning',
        summary: 'Automated provisioning and deprovisioning for enterprise identity.',
        status: 'planned',
        requests: [{ slug: 'scim-provisioning', title: 'SCIM provisioning' }],
      },
    ])
    await expect(releases.json()).resolves.toEqual([])

    const body = JSON.stringify(await (await request('/api/public/requests/scim-provisioning')).json())
    expect(body).not.toContain('northstar-health')
    expect(body).not.toContain('Northstar Health')
    expect(body).not.toContain('aisha@example.test')
    expect(body).not.toContain('revenueCents')
    expect(body).not.toContain('evidence')
    expect(body).not.toContain('decision')
  })

  it('filters internal, unapproved, withdrawn, blocked, and draft records from public reads', async () => {
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO boards (id, slug, name, visibility, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)')
        .bind('01J0000000000000000000000A', 'internal', 'Internal', 'internal', 3, now, now),
      env.DB.prepare('INSERT INTO requests (id, slug, board_id, author_requester_id, title, description, proposed_solution, impact_statement, moderation_state, public_state, public_title, public_description, published_at, declined_reason, withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
        .bind('01J0000000000000000000000B', 'internal-request', '01J0000000000000000000000A', 'Internal', 'Internal', 'approved', 'open', 'Internal', 'Internal', now, null, now, now),
      env.DB.prepare('INSERT INTO requests (id, slug, board_id, author_requester_id, title, description, proposed_solution, impact_statement, moderation_state, public_state, public_title, public_description, published_at, declined_reason, withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)')
        .bind('01J0000000000000000000000C', 'awaiting-request', '0000000000000000000000000C', 'Awaiting', 'Awaiting', 'awaiting_review', 'unpublished', now, now),
      env.DB.prepare('INSERT INTO requests (id, slug, board_id, author_requester_id, title, description, proposed_solution, impact_statement, moderation_state, public_state, public_title, public_description, published_at, declined_reason, withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
        .bind('01J0000000000000000000000D', 'withdrawn-request', '0000000000000000000000000C', 'Withdrawn', 'Withdrawn', 'approved', 'withdrawn', 'Withdrawn', 'Withdrawn', now, now, now, now),
    ])
    await env.DB.prepare('UPDATE requesters SET blocked_at = ? WHERE id = ?').bind(now, '00000000000000000000000006').run()

    const [requests, roadmap, releases, releaseDetail, withdrawnDetail, internalDetail] = await Promise.all([
      request('/api/public/requests'),
      request('/api/public/roadmap'),
      request('/api/public/releases'),
      request('/api/public/releases/release-scim-provisioning'),
      request('/api/public/requests/withdrawn-request'),
      request('/api/public/requests/internal-request'),
    ])
    await expect(requests.json()).resolves.toEqual([expect.objectContaining({ slug: 'shared-external-threads', status: 'open' })])
    await expect(roadmap.json()).resolves.toEqual([{ slug: (await env.DB.prepare('SELECT public_slug FROM roadmap_publications').first<{public_slug:string}>())!.public_slug, title: 'SCIM provisioning', summary: 'Automated provisioning and deprovisioning for enterprise identity.', status: 'planned', requests: [] }])
    await expect(releases.json()).resolves.toEqual([])
    expect(releaseDetail.status).toBe(404)
    expect(withdrawnDetail.status).toBe(410)
    expect(internalDetail.status).toBe(404)
  })

  it('preflights direct portal pages with public projection status', async () => {
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO boards (id, slug, name, visibility, position, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)')
        .bind('01J0000000000000000000000A', 'internal', 'Internal', 'internal', 3, now, now),
      env.DB.prepare('INSERT INTO requests (id, slug, board_id, author_requester_id, title, description, proposed_solution, impact_statement, moderation_state, public_state, public_title, public_description, published_at, declined_reason, withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
        .bind('01J0000000000000000000000B', 'internal-request', '01J0000000000000000000000A', 'Internal', 'Internal', 'approved', 'open', 'Internal', 'Internal', now, null, now, now),
      env.DB.prepare('INSERT INTO requests (id, slug, board_id, author_requester_id, title, description, proposed_solution, impact_statement, moderation_state, public_state, public_title, public_description, published_at, declined_reason, withdrawn_at, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
        .bind('01J0000000000000000000000D', 'withdrawn-request', '0000000000000000000000000C', 'Withdrawn', 'Withdrawn', 'approved', 'withdrawn', 'Withdrawn', 'Withdrawn', now, now, now, now),
    ])
    const browser = { headers: { Accept: 'text/html' } }
    const boardQuery = '?board=enterprise-identity&sort=votes'
    const [portal, portalSlash, feedback, existing, withdrawn, internal, draftRelease, submission, unknown] = await Promise.all([
      request(`/portal${boardQuery}`, { ...browser, redirect: 'manual' }),
      request(`/portal/${boardQuery}`, { ...browser, redirect: 'manual' }),
      request('/portal/feedback', { ...browser, redirect: 'manual' }),
      request('/portal/feedback/scim-provisioning', browser),
      request('/portal/feedback/withdrawn-request', browser),
      request('/portal/feedback/internal-request', browser),
      request('/portal/updates/release-scim-provisioning', browser),
      request('/portal/feedback/new', browser),
      request('/portal/nope', browser),
    ])

    expect([portal.status, portalSlash.status, feedback.status, existing.status, withdrawn.status, internal.status, draftRelease.status, submission.status, unknown.status])
      .toEqual([302, 302, 200, 200, 410, 404, 404, 200, 404])
    const publicBoardLocations = [portal.headers.get('Location'), portalSlash.headers.get('Location')]
    expect(publicBoardLocations).toEqual([`/${boardQuery}`, `/${boardQuery}`])
    const publicBoards = await Promise.all(publicBoardLocations.map((location) => request(location!, browser)))
    expect(publicBoards.map((response) => response.status)).toEqual([200, 200])
    for (const response of publicBoards) {
      const html = await response.text()
      expect(html).toContain('SCIM provisioning')
      expect(html).not.toContain('Shared external threads')
    }
    await expect(feedback.clone().text()).resolves.toContain('What should we improve?')
    const existingHtml = existing.clone()
    await expect(existingHtml.text()).resolves.toContain('Automated provisioning')
    for (const response of [feedback, existing, withdrawn, internal, draftRelease, submission, unknown]) {
      const html = await response.text()
      expect(html).toMatch(/<html\b[^>]*\blang="en"[^>]*>/)
      expect(html).toContain('<script')
      expect(html).not.toContain('<div id="root"></div>')
    }
  })

  it('rejects malformed public filter values', async () => {
    const [invalidStatus, unknownFilter, invalidRequestSlug, invalidReleaseSlug] = await Promise.all([
      request('/api/public/requests?status=private'),
      request('/api/public/requests?sort=votes&unexpected=1'),
      request('/api/public/requests/not%20a%20slug'),
      request('/api/public/releases/not%20a%20slug'),
    ])
    expect([invalidStatus.status, unknownFilter.status, invalidRequestSlug.status, invalidReleaseSlug.status]).toEqual([400, 400, 400, 400])
    await expect(invalidStatus.json()).resolves.toMatchObject({ error: 'validation_failed' })
  })

  it('uses one preferred requester address and preserves tag names without fan-out', async () => {
    const now = new Date().toISOString()
    await env.DB.batch([
      env.DB.prepare('INSERT INTO requester_addresses (id, requester_id, email, verified_at, suppressed_at, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)')
        .bind('01J0000000000000000000000Y', '00000000000000000000000006', 'priya-alternate@example.test', now, now),
      env.DB.prepare('INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind('01J0000000000000000000000X', 'Security|Review', now, now),
      env.DB.prepare('INSERT INTO evidence_tag_assignments (evidence_id, tag_id, created_at) VALUES (?, ?, ?)')
        .bind('0000000000000000000000000H', '01J0000000000000000000000X', now),
    ])
    const headers = await sessionHeaders()
    const [requests, evidence, account, decision] = await Promise.all([
      request('/api/operator/requests', { headers }),
      request('/api/operator/evidence', { headers }),
      request('/api/operator/accounts/northstar-health', { headers }),
      request('/api/operator/decisions/decision-scim-q4', { headers }),
    ])

    const requestRows = await requests.json() as Array<{ slug: string; author: { email: string | null } | null }>
    expect(requestRows).toHaveLength(2)
    expect(requestRows.find((row) => row.slug === 'scim-provisioning')?.author?.email).toBe('priya.s@example.test')

    const evidenceRows = await evidence.json() as Array<{ id: string; requester: { email: string | null } | null; tags: string[] }>
    expect(evidenceRows).toHaveLength(3)
    const scimEvidence = evidenceRows.find((row) => row.id === '0000000000000000000000000H')
    expect(scimEvidence?.requester?.email).toBe('priya.s@example.test')
    expect(scimEvidence?.tags).toEqual(expect.arrayContaining(['Identity', 'Enterprise', 'Security|Review']))
    expect(scimEvidence?.tags).not.toContain('Security')
    expect(scimEvidence?.tags).not.toContain('Review')

    const accountBody = await account.json() as { requesters: Array<{ id: string; email: string | null }> }
    expect(accountBody.requesters).toHaveLength(1)
    expect(accountBody.requesters[0]).toMatchObject({ id: '00000000000000000000000006', email: 'priya.s@example.test' })

    const decisionBody = await decision.json() as { bets: Array<{ evidence: Array<{ id: string; requester: { email: string | null } | null; tags: string[] }> }> }
    const decisionEvidence = decisionBody.bets.flatMap((bet) => bet.evidence).filter((row) => row.id === '0000000000000000000000000H')
    expect(decisionEvidence).toHaveLength(1)
    expect(decisionEvidence[0]).toMatchObject({ requester: { email: 'priya.s@example.test' } })
    expect(decisionEvidence[0]?.tags).toContain('Security|Review')
  })

  it('requires a real D1-backed session for every operator reader', async () => {
    const unauthenticated = await Promise.all([
      request('/api/operator/overview'), request('/api/operator/evidence'), request('/api/operator/requests'),
      request('/api/operator/decisions'), request('/api/operator/roadmap'), request('/api/operator/releases'), request('/api/operator/accounts'),
    ])
    expect(unauthenticated.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401])
    const headers = await sessionHeaders()
    const [overview, decision, account, release] = await Promise.all([
      request('/api/operator/overview', { headers }),
      request('/api/operator/decisions/decision-scim-q4', { headers }),
      request('/api/operator/accounts/northstar-health', { headers }),
      request('/api/operator/releases/release-scim-provisioning', { headers }),
    ])
    expect(overview.status).toBe(200)
    await expect(overview.json()).resolves.toMatchObject({
      decisions: [{ slug: 'decision-csv-export', state: 'review_due' }],
      unreviewedEvidence: [{ id: '0000000000000000000000000N', sourceType: 'portal_request' }],
      roadmap: [{ slug: 'scim-provisioning', publicStatus: 'planned' }],
      recentReleases: [],
    })
    const decisionBody = await decision.json() as { slug: string; bets: Array<{ title: string; accounts: Array<{ name: string; revenueCents: number | null }> }> }
    expect(decisionBody.slug).toBe('decision-scim-q4')
    const scimBet = decisionBody.bets.find((bet) => bet.title === 'SCIM provisioning')
    expect(scimBet).toBeDefined()
    expect(scimBet?.accounts).toContainEqual(expect.objectContaining({ name: 'Brightwell', revenueCents: 6600000 }))
    await expect(account.json()).resolves.toMatchObject({
      slug: 'northstar-health', revenueCents: 7200000,
      requesters: [{ displayName: 'Priya S.', email: 'priya.s@example.test' }],
    })
    await expect(release.json()).resolves.toMatchObject({ slug: 'release-scim-provisioning', state: 'draft', recipientSnapshotCount: null })
  })

  it('[OPS-003] limits overview releases to the last 30 days and derives current outcomes', async () => {
    const now = new Date().toISOString()
    const oldPlannedPublicationDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    await env.DB.batch([
      env.DB.prepare('UPDATE releases SET state = ?, published_at = ? WHERE slug = ?').bind('published', now, 'release-scim-provisioning'),
      env.DB.prepare('UPDATE release_versions SET publication_date = ?, is_portal_current = 1 WHERE id = ?').bind(oldPlannedPublicationDate, '0000000000000000000000001F'),
      env.DB.prepare('INSERT INTO release_recipient_snapshots (id, release_version_id, requester_id, requester_address_id, request_id, evidence_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)')
        .bind('01J0000000000000000000000W', '0000000000000000000000001F', '00000000000000000000000006', '00000000000000000000000009', now, now),
      env.DB.prepare('INSERT INTO release_outcomes (id, release_version_id, requester_id, roadmap_item_id, outcome, revision_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('01J0000000000000000000000X', '0000000000000000000000001F', '00000000000000000000000006', '0000000000000000000000001A', 'adopted', 1, now, now),
      env.DB.prepare('INSERT INTO release_outcomes (id, release_version_id, requester_id, roadmap_item_id, outcome, revision_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('01J0000000000000000000000Y', '0000000000000000000000001F', '00000000000000000000000006', '0000000000000000000000001A', 'partly_adopted', 2, now, now),
    ])
    const headers = await sessionHeaders()

    const recent = await request('/api/operator/overview', { headers })
    await expect(recent.json()).resolves.toMatchObject({
      recentReleases: [{ slug: 'release-scim-provisioning', publicationDate: oldPlannedPublicationDate, publishedAt: now, recipientSnapshotCount: 1, outcomeTotal: 1 }],
    })

    const oldActualPublishedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const futurePlannedPublicationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    await env.DB.batch([
      env.DB.prepare('UPDATE releases SET published_at = ? WHERE slug = ?').bind(oldActualPublishedAt, 'release-scim-provisioning'),
      env.DB.prepare('UPDATE release_versions SET publication_date = ? WHERE id = ?').bind(futurePlannedPublicationDate, '0000000000000000000000001F'),
    ])
    const expired = await request('/api/operator/overview', { headers })
    await expect(expired.json()).resolves.toMatchObject({ recentReleases: [] })
  })

  it('[OPS-003] [BASE-ACCESS-002] gates every operator screen before rendering its SSR document', async () => {
    const operatorRoutes = [
      '/app',
      '/app/overview',
      '/app/feedback',
      '/app/decisions',
      '/app/decisions/decision-scim-q4',
      '/app/roadmap',
      '/app/releases',
      '/app/releases/release-scim-provisioning',
      '/app/customers',
      '/app/customers/northstar-health',
    ]
    const browser = { headers: { Accept: 'text/html' } }

    const unauthenticated = await Promise.all(operatorRoutes.map((pathname) => request(pathname, { ...browser, redirect: 'manual' })))
    expect(unauthenticated.map((response) => response.status)).toEqual(operatorRoutes.map(() => 302))
    expect(unauthenticated.map((response) => response.headers.get('Location'))).toEqual(operatorRoutes.map(() => '/signin'))

    const repository = new AuthRepository(createDatabaseConnection(env.DB))
    const now = new Date().toISOString()
    await repository.createOperator({ id: '01J0000000000000000000000P', email: 'owner@penny.invalid', displayName: 'Penny Owner', now })
    await repository.createSession({ id: SESSION_ID, operatorId: '01J0000000000000000000000P', tokenHash: await hashOperatorSessionToken(SESSION_TOKEN), expiresAt: new Date(Date.now() + 3600000).toISOString(), now })
    const headers = new Headers({ Cookie: `${OPERATOR_SESSION_COOKIE}=${SESSION_TOKEN}` })
    const authenticated = await Promise.all(operatorRoutes.map((pathname) => request(pathname, { headers })))
    expect(authenticated.map((response) => response.status)).toEqual(operatorRoutes.map(() => 200))
    for (const response of authenticated) {
      const html = await response.text()
      expect(html).toMatch(/<html\b[^>]*\blang="en"[^>]*>/)
      expect(html).toContain('<script')
      expect(html).not.toContain('<div id="root"></div>')
    }
  })
})


it('[REQ-012][EVID-006][REQ-019] searches only approved public wording with literal filters', async () => {
  const results = async (query: string) => (await request(`/api/public/requests?${query}`)).json()
  expect(await results('q=SCIM')).toMatchObject([{ slug: 'scim-provisioning' }])
  expect(await results('q=scim&board=collaboration')).toEqual([])
  expect(await results('q=scim&status=open')).toEqual([])
  expect(await results('q=scim&status=planned&sort=votes')).toMatchObject([{ slug: 'scim-provisioning' }])
  const description = 'Published literal 100% path_under \\ example'
  await env.DB.prepare("UPDATE requests SET public_description=?, description='private-original-marker', title='private-title-marker' WHERE slug='scim-provisioning'").bind(description).run()
  expect(await results('q=private-original-marker')).toEqual([])
  expect(await results('q=private-title-marker')).toEqual([])
  expect(await results('q=100%25')).toMatchObject([{ slug: 'scim-provisioning' }])
  expect(await results('q=path_under')).toMatchObject([{ slug: 'scim-provisioning' }])
  expect(await results('q=%5C')).toMatchObject([{ slug: 'scim-provisioning' }])
  expect(await results('q=%25')).toHaveLength(1)
  expect(await results('q=not-a-match')).toEqual([])
  for (const mutation of ["UPDATE boards SET visibility='internal' WHERE slug='enterprise-identity'", "UPDATE requests SET moderation_state='awaiting_review' WHERE slug='shared-external-threads'"]) await env.DB.prepare(mutation).run()
  expect(await results('q=SCIM')).toEqual([])
  expect(await results('q=threads')).toEqual([])
  expect((await request('/api/public/requests?q=' + 'x'.repeat(201))).status).toBe(400)
  expect((await request('/api/public/requests?q=%20')).status).toBe(400)
})

it('[REQ-012][REQ-001] renders filtered SSR and an honest no-match state', async () => {
  const html = await (await request('/portal/feedback?q=SCIM&status=planned')).text()
  expect(html).toContain('SCIM provisioning')
  expect(html).not.toContain('Shared external threads')
  expect(html).toContain('/portal/feedback/scim-provisioning')
  const empty = await (await request('/portal/feedback?q=missing-search-marker')).text()
  expect(empty).toContain('No matching feedback')
  expect(empty).not.toContain('SCIM provisioning')
  const invalid = await (await request('/portal/feedback?status=invalid')).text()
  expect(invalid).toContain('could')
})


it('[REQ-012][REQ-030][EVID-006] excludes rejected wording and private identities from API and SSR search', async () => {
  const marker = 'never-public-rejected-marker'
  await env.DB.prepare("UPDATE requests SET public_title=?, public_description=?, moderation_state='rejected' WHERE slug='scim-provisioning'").bind(marker, marker).run()
  for (const query of [marker, 'aisha@example.test', 'enterprise security reviews']) {
    const encoded = new URLSearchParams({ q: query }).toString()
    expect(await (await request(`/api/public/requests?${encoded}`)).json()).toEqual([])
    const html = await (await request(`/portal/feedback?${encoded}`)).text()
    expect(html).toContain('No matching feedback')
    // The URL/search state may echo visitor input; no matching record may be rendered.
    expect(html).not.toContain('/portal/feedback/scim-provisioning')
    expect(html).not.toContain('/portal/feedback/shared-external-threads')
  }
})

it('[REQ-012] preserves encoded literal terms, stable ties and strict filter boundaries', async () => {
  const wording = "Unicode café & plus+ / ? # = ' OR 1=1 --"
  await env.DB.prepare('UPDATE requests SET public_description=? WHERE published_at IS NOT NULL').bind(wording).run()
  // Equal counts and timestamps must retain the deterministic slug tie-breaker.
  await env.DB.prepare('UPDATE request_votes SET updated_at=?').bind('2026-09-06T00:00:00.000Z').run()
  await env.DB.prepare("UPDATE requests SET published_at='2099-01-01T00:00:00.000Z' WHERE published_at IS NOT NULL").run()
  await env.DB.prepare('DELETE FROM request_votes').run()
  const expected = ['scim-provisioning', 'shared-external-threads']
  for (const sort of ['recent', 'votes']) {
    for (const q of ['café', '& plus+', '/ ? # =', "' OR 1=1 --"]) {
      const query = new URLSearchParams({ q, sort }).toString()
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await request(`/api/public/requests?${query}`)
        expect(response.status).toBe(200)
        expect((await response.json() as {slug:string}[]).map(row => row.slug)).toEqual(expected)
      }
      const html = await (await request(`/portal/feedback?${query}&board=collaboration&status=open`)).text()
      expect(html).toContain('Shared external threads')
      expect(html).not.toContain('SCIM provisioning')
    }
  }
  expect((await request('/api/public/requests?' + new URLSearchParams({q:'x'.repeat(200)}))).status).toBe(200)
  for (const query of ['q=scim&limit=1', 'q=scim&offset=1', 'q=scim&page=2', 'q=scim&status=private', 'q=scim&sort=unknown']) {
    expect((await request(`/api/public/requests?${query}`)).status).toBe(400)
  }
  expect(await (await request('/api/public/requests?q=%20caf%C3%A9%20&board=missing')).json()).toEqual([])
})
