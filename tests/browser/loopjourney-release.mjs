import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { form, save } from './loopjourney-steps.mjs'

export const releaseTitle = 'Onboarding progress is live'
const releaseBody = 'You can now see each onboarding step and what needs attention.'

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
