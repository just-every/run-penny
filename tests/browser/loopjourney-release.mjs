import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { moderationJourney } from './moderation-runtime.mjs'
import { save } from './loopjourney-steps.mjs'

export const releaseTitle = 'Onboarding progress is live'
const releaseBody = 'You can now see each onboarding step and what needs attention.'

function localMinute(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant))
  const value = name => parts.find(part => part.type === name).value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

async function schedulePublication(operator, subject, pathPattern, audit) {
  const panel = operator.getByRole('region', { name: `${subject} publication schedule`, exact: true })
  const editor = panel.getByRole('form', { name: `Schedule ${subject.toLowerCase()}`, exact: true })
  const input = editor.getByLabel(/^Publish at \(/)
  await input.waitFor()
  const timezone = (await panel.getByText(/^Workspace timezone: /).innerText()).replace('Workspace timezone: ', '').trim()
  const localTime = localMinute(Date.now() + 3 * 24 * 60 * 60 * 1000, timezone).slice(0, 10) + 'T14:30'
  await input.fill(localTime)
  await audit(operator, `REL-014-${subject.toLowerCase().replaceAll(' ', '-')}-schedule-form`)
  const pending = operator.waitForResponse(response => pathPattern.test(new URL(response.url()).pathname) && response.request().method() === 'POST')
  await editor.getByRole('button', { name: 'Schedule publication', exact: true }).click()
  const response = await pending
  assert.equal(response.ok(), true, `[REL-014] ${subject} scheduled through the UI`)
  await panel.getByRole('button', { name: 'Cancel schedule', exact: true }).waitFor()
  const scheduled = await operator.request.get(response.url()).then(result => result.json())
  assert.equal(scheduled.schedule.state, 'scheduled', '[REL-014] schedule remains pending before its time')
  assert.equal(scheduled.schedule.timeZone, timezone, '[REL-014] the workspace IANA zone is stored')
  assert.equal(localMinute(scheduled.schedule.scheduledAt, timezone), localTime, '[REL-014] the saved instant matches entered workspace time')
  await expect(panel.locator('time')).toHaveAttribute('datetime', scheduled.schedule.scheduledAt)
  await expect(panel.getByText(`(${timezone})`, { exact: true })).toBeVisible()
  await operator.reload({ waitUntil: 'networkidle' })
  await expect(panel.locator('time')).toHaveAttribute('datetime', scheduled.schedule.scheduledAt)
  await audit(operator, `REL-014-${subject.toLowerCase().replaceAll(' ', '-')}-scheduled`)
  return { panel, editor, url: response.url(), schedule: scheduled.schedule }
}

async function scheduleAndCancel(operator, subject, pathPattern, audit) {
  const { panel, editor, url } = await schedulePublication(operator, subject, pathPattern, audit)
  const cancelled = operator.waitForResponse(result => new URL(result.url()).pathname === new URL(url).pathname + '/cancel' && result.request().method() === 'POST')
  await panel.getByRole('button', { name: 'Cancel schedule', exact: true }).click()
  assert.equal((await cancelled).ok(), true, `[REL-014] ${subject} schedule cancelled through the UI`)
  await expect(editor.getByRole('button', { name: 'Schedule publication', exact: true })).toBeEnabled()
  const restored = await operator.request.get(url).then(result => result.json())
  assert.equal(restored.schedule.state, 'cancelled', '[REL-014] cancellation is persisted before manual publication')
  await audit(operator, `REL-014-${subject.toLowerCase().replaceAll(' ', '-')}-schedule-cancelled`)
}

export async function createTag(operator, origin, audit) {
  await operator.goto(origin + '/app/settings', { waitUntil: 'networkidle' })
  const tag = operator.locator('form').filter({ has: operator.getByLabel('New tag', { exact: true }) })
  await tag.getByLabel('New tag', { exact: true }).fill('Onboarding')
  await save(operator, tag, 'Create tag', '/api/operator/catalog/tags')
  await operator.getByLabel('Tag name', { exact: true }).first().waitFor()
  await audit(operator, 'E.1-subject-tag-created')
}

export async function publishStatusUpdate(operator, origin, audit) {
  await operator.goto(origin + '/app/releases', { waitUntil: 'networkidle' })
  const pending = operator.getByRole('region', { name: 'Pending status updates' })
  await pending.getByRole('button', { name: 'Publish status update', exact: true }).waitFor()
  await audit(operator, 'E.1-pending-status-update')
  await scheduleAndCancel(operator, 'Status update', /^\/api\/operator\/roadmap-updates\/[^/]+\/schedule$/, audit)
  const response = operator.waitForResponse(r => /\/api\/operator\/roadmap-updates\/[^/]+\/publish$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST')
  await pending.getByRole('button', { name: 'Publish status update', exact: true }).click()
  assert.equal((await response).ok(), true, '[ROAD-008] status update published through the UI')
  await pending.getByText('Status update published.', { exact: true }).waitFor()
  await audit(operator, 'E.1-status-update-published')
}

export async function expectFollowerQueued(operator, origin, audit) {
  const context = operator.waitForResponse(r => /\/api\/operator\/requests\/[^/]+\/context$/.test(new URL(r.url()).pathname))
  await operator.goto(origin + '/app/moderation', { waitUntil: 'networkidle' })
  const loaded = await context
  assert.equal(loaded.status(), 200, `[ROAD-008] request context returned ${loaded.status()}: ${(await loaded.text()).slice(0, 300)}`)
  const section = operator.getByRole('region', { name: 'Status update delivery' })
  await section.waitFor()
  await section.getByText('1 follower will be notified', { exact: false }).first().waitFor()
  await audit(operator, 'E.1-request-follower-queued')
}

export async function draftAndPublishRelease(operator, origin, audit) {
  await operator.goto(origin + '/app/releases', { waitUntil: 'networkidle' })
  const editor = operator.locator('form').filter({ has: operator.getByRole('heading', { name: 'Create release draft', exact: true }) })
  await editor.getByLabel('Title', { exact: true }).fill(releaseTitle)
  await editor.locator('select[name="releaseType"]').selectOption('new')
  await editor.getByLabel('Body', { exact: true }).fill(releaseBody)
  await editor.locator('select[name="authorOperatorId"]').selectOption({ index: 0 })
  await editor.getByLabel('Onboarding', { exact: true }).check()
  await editor.getByLabel(/See onboarding progress/).check()
  await audit(operator, 'E.1-release-draft-form')
  const saved = await save(operator, editor, 'Save draft', '/api/operator/releases')
  assert.ok(saved.slug, '[REL-001] draft has a slug')
  await operator.goto(origin + `/app/releases/${saved.slug}`, { waitUntil: 'networkidle' })
  await audit(operator, 'E.1-release-draft')
  await scheduleAndCancel(operator, 'Release', /^\/api\/operator\/releases\/[^/]+\/schedule$/, audit)
  const published = operator.waitForResponse(r => r.url().endsWith(`/api/operator/releases/${saved.slug}/publish`) && r.request().method() === 'POST')
  await operator.getByRole('button', { name: 'Publish release', exact: true }).click()
  assert.equal((await published).ok(), true, '[REL-002] release published through the UI')
  await operator.getByText('Release published.', { exact: true }).waitFor()
  await expect(operator.getByText('Recipient snapshot', { exact: true }).locator('xpath=following-sibling::dd'), '[REL-004] one recipient in the snapshot').toHaveText('1')
  await operator.getByRole('heading', { name: 'Published wording and delivery versions', exact: true }).waitFor()
  await audit(operator, 'E.1-release-published')
  return saved.slug
}

export async function expectReleaseQueued(operator, origin, releaseSlug, audit) {
  await operator.goto(origin + `/app/releases/${releaseSlug}`, { waitUntil: 'networkidle' })
  const counts = operator.getByLabel('Email delivery counts')
  assert.equal((await counts.locator('div').filter({ hasText: /^queued/i }).locator('dd').innerText()).trim(), '1', '[REL-005] one queued release delivery')
  await audit(operator, 'E.1-release-delivery-queued')
}

export async function expectPublicUpdates(requester, origin, audit) {
  await requester.goto(origin + '/portal/updates', { waitUntil: 'networkidle' })
  await requester.getByText(releaseTitle, { exact: false }).first().waitFor()
  const text = await requester.locator('body').innerText()
  for (const privateText of ['Internal rationale', 'Weekly onboarding digest', 'Local interview participant']) assert.equal(text.includes(privateText), false, '[REL-005] public updates exclude private context')
  await audit(requester, 'E.1-public-updates')
}


export async function scheduledPublicationJourney({ runtime, origin, operator, json, person, pageFor, capture }) {
  const actor = await runtime.db.prepare('SELECT id FROM operators LIMIT 1').first('id')
  const requester = await person('onboarding-reader@example.test', 'Onboarding reader')
  const request = await json('/api/public/requests', { title: 'Make onboarding progress visible', description: 'Show every step left before our team can start.', boardSlug: 'finance', emailUpdates: true, idempotencyKey: crypto.randomUUID() }, { Authorization: `Bearer ${requester.token}` }, 'POST', 201)
  await json(`/api/operator/moderation/${request.slug}`, { verdict: 'approved', title: 'Make onboarding progress visible', description: 'Show every step left before our team can start.', boardSlug: 'finance', displayName: 'Onboarding reader' }, operator)
  const requestId = await runtime.db.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first('id')
  const now = new Date().toISOString(), decisionId = 'scheduled-decision', itemId = 'scheduled-onboarding'
  // Only the private decision graph is fixture SQL. Approval, mapping snapshots,
  // drafts, scheduling and publication use the application's real HTTP routes.
  await runtime.db.batch([
    runtime.db.prepare("INSERT INTO decisions(id,slug,title,question,state,rationale,owner_operator_id,created_at,updated_at) VALUES(?,'onboarding-decision','Improve onboarding visibility','How can teams see their onboarding progress?','committed','Direct visibility addresses the customer evidence.',?,?,?)").bind(decisionId, actor, now, now),
    runtime.db.prepare("INSERT INTO roadmap_items(id,slug,decision_id,title,summary,status,owner_operator_id,created_at,updated_at) VALUES(?,'onboarding-progress',?,'Onboarding progress dashboard','Show remaining onboarding steps.','planned',?,?,?)").bind(itemId, decisionId, actor, now, now),
  ])
  await json(`/api/operator/roadmap/${itemId}/approve`, { publicTitle: 'See onboarding progress', publicSummary: 'See each onboarding step and what needs attention.', boardSlug: 'finance', requestIds: [requestId] }, operator)
  await json(`/api/operator/roadmap/${itemId}/move`, { status: 'shipped', reason: 'The progress dashboard is available to customers.', idempotencyKey: crypto.randomUUID() }, operator)
  const tag = await json('/api/operator/catalog/tags', { name: 'Onboarding' }, operator, 'POST', 201)
  const owner = await pageFor({ cookie: operator.Cookie })
  const audit = (page, label) => capture(page, label, label.startsWith('REL-014-') ? page.getByRole('region', { name: label.startsWith('REL-014-status-update-') ? 'Status update publication schedule' : 'Release publication schedule', exact: true }) : undefined)
  await publishStatusUpdate(owner, origin, audit)
  await draftAndPublishRelease(owner, origin, audit)

  const failureTitle = 'Onboarding launch follow-up'
  const draft = await json('/api/operator/releases', { title: failureTitle, body: 'The next onboarding improvements are ready for your team.', releaseType: 'improved', tagIds: [tag.id], publicationDate: now.slice(0, 10), setupUrl: '', targetIds: [itemId], authorOperatorId: actor }, operator, 'POST', 201)
  await owner.goto(origin + `/app/releases/${draft.slug}`, { waitUntil: 'networkidle' })
  const failureAudit = (page, label) => capture(page, label.replace('REL-014-release-', 'REL-014-failing-release-'), page.getByRole('region', { name: 'Release publication schedule', exact: true }))
  const scheduled = await schedulePublication(owner, 'Release', /^\/api\/operator\/releases\/[^/]+\/schedule$/, failureAudit)
  const due = new Date(Date.now() - 60_000).toISOString()
  await runtime.db.batch([
    runtime.db.prepare("UPDATE penny_publication_schedules SET scheduled_at=? WHERE id=? AND state='scheduled'").bind(due, scheduled.schedule.id),
    runtime.db.prepare("UPDATE roadmap_items SET status='planned',updated_at=? WHERE id=?").bind(due, itemId),
  ])
  await runtime.schedule()
  const failed = (await json(`/api/operator/releases/${draft.slug}/schedule`, undefined, operator)).schedule
  assert.equal(failed.state, 'failed', '[REL-014] real Cron reports a target that is no longer Shipped')
  assert.ok(failed.lastError, '[REL-014] the publication refusal explains why the draft remains private')
  assert.equal((await json(`/api/operator/releases/${draft.slug}`, undefined, operator)).state, 'draft', '[REL-014] a refused scheduled release remains a draft')
  await owner.reload({ waitUntil: 'networkidle' })
  await expect(scheduled.panel.getByRole('alert')).toHaveText(failed.lastError)
  await expect(scheduled.panel.locator('time')).toHaveAttribute('datetime', due)
  await expect(scheduled.editor.getByRole('button', { name: 'Schedule publication', exact: true })).toBeEnabled()
  await capture(owner, 'REL-014-release-scheduled-publication-failed', scheduled.panel)

  await owner.goto(origin + '/app/moderation', { waitUntil: 'networkidle' })
  const notices = owner.getByRole('region', { name: 'Your mentions', exact: true })
  const notice = notices.getByRole('listitem').filter({ has: owner.getByRole('link', { name: failureTitle, exact: true }) })
  await expect(notice).toContainText(failed.lastError)
  await expect(notice.getByRole('link', { name: failureTitle, exact: true })).toHaveAttribute('href', `/app/releases/${draft.slug}`)
  await capture(owner, 'REL-014-author-publication-failure-notice', notices)
  const dismissal = owner.waitForResponse(response => new URL(response.url()).pathname === `/api/operator/discussion/mentions/${failed.id}/dismiss` && response.request().method() === 'POST')
  await notice.getByRole('button', { name: 'Dismiss notice', exact: true }).click()
  assert.equal((await dismissal).ok(), true, '[REL-014] the author dismisses the publication notice through the UI')
  await expect(notice).toHaveCount(0)
  await owner.reload({ waitUntil: 'networkidle' })
  await expect(notices.getByText('No new mentions.', { exact: true })).toBeVisible()
  await expect(notice).toHaveCount(0)
  await capture(owner, 'REL-014-author-failure-notice-dismissed', notices)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) await moderationJourney('scheduled-publication', scheduledPublicationJourney)
