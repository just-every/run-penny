import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { gatedOutboxUrl } from './local-signin.mjs'
import { boundedStep, question } from './loopjourney-steps.mjs'

export async function waitForReviewNotification(operator, runtime, commit, audit) {
  // `rer dev` owns the minute scheduler on its internal listener. Observe its
  // effects through the app and key-gated outbox, without triggering it ourselves.
  await boundedStep(operator, 'DEC-007: wait for the real local minute Cron', async () => {
    await expect.poll(async () => {
      await operator.reload({ waitUntil: 'networkidle' })
      return operator.getByRole('heading', { name: 'Decision review is due', exact: true }).isVisible()
    }, { timeout: 90_000, intervals: [1000] }).toBe(true)
  }, { timeout: 100_000 })

  const outbox = await operator.context().newPage()
  try {
    await outbox.goto(await gatedOutboxUrl(runtime.root, runtime.origin), { waitUntil: 'networkidle' })
    const reminders = outbox.locator('article').filter({
      has: outbox.getByRole('heading', { name: `Decision review due: ${question}`, exact: true }),
    })
    await expect.poll(async () => {
      await outbox.reload({ waitUntil: 'networkidle' })
      return reminders.count()
    }, { timeout: 60_000, intervals: [1000] }).toBeGreaterThan(0)
    assert.equal(await reminders.count(), 1, '[NOTIFY-003] the real minute Cron captures one owner review email')
    await reminders.getByText('To: owner@penny.invalid', { exact: true }).waitFor()
    await audit(outbox, 'NOTIFY-003-owner-review-email-outbox', { axeZero: true, redact: true })
    await reminders.getByRole('link', { name: 'Read message', exact: true }).click()
    assert.equal(await outbox.getByRole('link', { name: 'Open this link', exact: true }).getAttribute('href'),
      `${runtime.origin}/app/decisions/${commit.decisionSlug}`, '[NOTIFY-003] the owner email opens the due decision')
    await audit(outbox, 'NOTIFY-003-owner-review-email-message', { axeZero: true, redact: true })
  } finally { await outbox.close() }
}
