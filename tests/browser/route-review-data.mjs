import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { register } from 'tsx/esm/api'

register({ tsconfig: 'tsconfig.app.json' })

const { importPennySample } = await import('../../src/core/features/sample-data/service.ts')
const { createDatabaseConnection } = await import('../../src/core/platform/database.ts')
const { unsubscribeUrl } = await import('../../src/core/features/notifications/unsubscribe.ts')
const { releaseDraftSchema, saveReleaseDraft } = await import('../../src/core/features/releases/drafts.ts')
const { publishRelease } = await import('../../src/core/features/releases/publication.ts')

export const routeFixtures = {
  account: 'northstar-health',
  decision: 'decision-scim-q4',
  release: 'release-scim-provisioning',
  request: 'scim-provisioning',
  withdrawnRequest: 'withdrawn-feedback',
  publicRoadmapSlug: 'scim-provisioning',  // replaced by the opaque publication slug once the sample is seeded
  board: 'enterprise-identity',
}

export const longCustomerText = `customer-reference-${'x'.repeat(150)}`
export const longProviderReceiptId = `ambiguous-provider-reference-${longCustomerText}`
const testAuthSecret = 'synthetic-base-browser-auth-secret-12345'

export async function seedRouteReviewDatabase(db) {
  const sample = JSON.parse(await readFile(resolve('sample-data/penny.v1.json'), 'utf8'))
  const now = new Date().toISOString()
  sample.operators[0].email = 'owner@penny.invalid'
  const nativeOwner = await db.prepare("SELECT id FROM oa_operators WHERE email = ? AND role = 'owner' AND status = 'active'").bind(sample.operators[0].email).first()
  if (!nativeOwner) throw new Error('Bootstrap the native route-review owner before seeding the sample.')
  // The signed-in owner already exists, so the sample's operator keeps that identity.
  const owner = await db.prepare('SELECT id FROM operators WHERE email = ?').bind('owner@penny.invalid').first()
  if (owner && owner.id !== sample.operators[0].id) {
    const sampleOperatorId = sample.operators[0].id
    const remap = (value) => {
      if (Array.isArray(value)) return value.forEach(remap)
      if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'string' && item === sampleOperatorId && /operator|owner/i.test(key)) value[key] = owner.id
        else remap(item)
      }
    }
    remap(sample)
    sample.operators[0].id = owner.id
  }
  sample.accounts[0].name = `Northstar ${longCustomerText}`
  sample.accounts[0].health = `Identity review: ${longCustomerText}`
  sample.decisions[0].title = `Enterprise identity ${longCustomerText}`
  sample.decisions[0].question = `Which investment removes the enterprise blocker ${longCustomerText}?`
  sample.decisions[0].rationale = `The selected work clears the named customer gate ${longCustomerText}.`
  sample.roadmapItems[0].title = `SCIM ${longCustomerText}`
  sample.roadmapItems[0].summary = `Provisioning and deprovisioning for enterprise identity ${longCustomerText}.`
  sample.roadmapItems[0].status = 'shipped'
  sample.roadmapItems[0].transition.toStatus = 'shipped'
  sample.roadmapPublications[0].publicTitle = `SCIM ${longCustomerText}`
  sample.roadmapPublications[0].publicSummary = `Customer-safe identity update ${longCustomerText}.`
  sample.requests[0].title = `SCIM ${longCustomerText}`
  sample.requests[0].publicTitle = `SCIM ${longCustomerText}`
  sample.requests[0].description = `The approved request includes a customer reference ${longCustomerText}.`
  sample.requests[0].publicDescription = `Enterprise provisioning request ${longCustomerText}.`
  sample.requests[0].publicState = 'shipped'
  sample.requests[0].comments[0].body = `We shipped the identity improvement ${longCustomerText}.`
  sample.evidence[0].wording = `Customer evidence records the account blocker ${longCustomerText}.`
  sample.releases[0].state = 'draft'
  sample.releases[0].publishedAt = null
  sample.releases[0].version.title = `SCIM ${longCustomerText}`
  sample.releases[0].version.body = `Admins can provision and deprovision users. Customer reference: ${longCustomerText}.`
  sample.releases[0].version.publicationDate = now.slice(0, 10)
  sample.releases[0].version.isPortalCurrent = false
  sample.releases[0].version.outcomePrompt = `Did this solve the identity problem ${longCustomerText}?`

  await importPennySample(createDatabaseConnection(db), sample, now)
  // Capture current approvals and mappings, then let publication seal its own snapshots.
  const release = sample.releases[0]
  await saveReleaseDraft(db, releaseDraftSchema.parse({
    title: release.version.title,
    body: release.version.body,
    releaseType: release.version.releaseType,
    tagIds: release.version.subjectTagIds,
    publicationDate: release.version.publicationDate,
    setupUrl: release.version.setupUrl ?? '',
    targetIds: release.targetRoadmapItemIds,
    authorOperatorId: release.authorOperatorId,
  }), release.slug, now)
  await publishRelease(db, release.slug, now)
  routeFixtures.publicRoadmapSlug = (await db.prepare('SELECT p.public_slug AS slug FROM roadmap_publications p JOIN roadmap_items i ON i.id = p.roadmap_item_id WHERE i.slug = ?').bind('scim-provisioning').first()).slug
  await db.prepare(`
    INSERT INTO requests (
      id, slug, board_id, title, description, moderation_state, public_state,
      public_title, public_description, published_at, withdrawn_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'approved', 'withdrawn', ?, ?, ?, ?, ?, ?)
  `).bind(
    't119-withdrawn-request', routeFixtures.withdrawnRequest, '0000000000000000000000000C',
    'Withdrawn feedback', 'A withdrawn request used to check its public state.',
    'Withdrawn feedback', 'This feedback has been withdrawn.', now, now, now, now,
  ).run()

  return { createdAt: now }
}

export async function createUnsubscribeLink(db, origin, email, requestSlug) {
  const recipient = await db.prepare(`
    SELECT requester_id AS requesterId, id AS addressId, email
    FROM requester_addresses WHERE email=? AND verified_at IS NOT NULL
  `).bind(email).first()
  const request = await db.prepare('SELECT id FROM requests WHERE slug=?').bind(requestSlug).first()
  if (!recipient || !request) throw new Error('The route-review requester or request fixture is missing.')
  return unsubscribeUrl({
    configuration: { authSecret: testAuthSecret, appOrigin: origin },
    database: { binding: db },
  }, recipient, request.id)
}

export async function seedDeliveryReviewStates(db, email, requestSlug) {
  const recipient = await db.prepare(`
    SELECT requester_id AS requesterId, id AS addressId
    FROM requester_addresses WHERE email=? AND verified_at IS NOT NULL
  `).bind(email).first()
  const request = await db.prepare('SELECT id FROM requests WHERE slug=?').bind(requestSlug).first()
  if (!recipient || !request) throw new Error('The route-review requester or request fixture is missing.')

  const now = new Date().toISOString()
  const states = [
    { id: 't119-route-queued', state: 'queued', attemptCount: 0, providerMessageId: null, failureReason: null },
    { id: 't119-route-accepted', state: 'accepted', attemptCount: 1, providerMessageId: 'fixture-provider-receipt', failureReason: null },
    { id: 't119-route-failed', state: 'failed', attemptCount: 2, providerMessageId: null, failureReason: 'retry_window_exhausted' },
    { id: 't119-route-unknown', state: 'unknown', attemptCount: 1, providerMessageId: longProviderReceiptId, failureReason: null },
  ]
  for (const [index, state] of states.entries()) {
    const eventId = `${state.id}-event`
    const timestamp = new Date(Date.parse(now) + index).toISOString()
    await db.batch([
      db.prepare(`
        INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at)
        VALUES(?,?,'comment',?,?,?,?)
      `).bind(eventId, request.id, eventId, 'A requester update used to review delivery visibility.', timestamp, timestamp),
      db.prepare(`
        INSERT INTO notification_batches(
          id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,
          attempt_count,next_attempt_at,provider,provider_message_id,failure_reason,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        state.id, recipient.requesterId, recipient.addressId, request.id, eventId,
        timestamp, new Date(Date.parse(timestamp) + 3600000).toISOString(), state.state,
        state.attemptCount, timestamp, 'sendgrid', state.providerMessageId, state.failureReason, timestamp, timestamp,
      ),
    ])
  }
}
