import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { chromium } from '@playwright/test'
import { evidenceDirectory } from './acceptance-audit.mjs'
import { freshLocalRuntime } from './fresh-local-runtime.mjs'
import { signIn } from './local-signin.mjs'

// rer dev runs React's development build, the only one that reports render
// loops; both flows run there, signed in as the owner, through the pages.
const cannyExport = fileURLToPath(new URL('../fixtures/imports/canny-export.csv', import.meta.url))
let runtime, browser, page, errors = []
test.before(async () => {
  process.env.TMPDIR = resolve(process.env.PENNY_WORK_ROOT ?? '..', 'tmp')
  await mkdir(process.env.TMPDIR, { recursive: true })
  runtime = await freshLocalRuntime({ width: 1440, height: 900 }, evidenceDirectory('dev-operator-flows'))
  browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
  page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  await signIn(page, runtime, async () => {})
})
test.after(async () => { await browser?.close(); await runtime?.close() })

const post = (path, body) => page.evaluate(async ([path, body]) => (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, [path, body])

test('[MOD-001] Moderation renders once and stays quiet: request controls open on one click and an applied tag shows on the request', { timeout: 300000 }, async () => {
  assert.equal(await post('/api/operator/boards', { name: 'Ideas', slug: 'ideas', visibility: 'public' }), 201)
  assert.equal(await post('/api/operator/requests', { title: 'Export invoices to CSV', description: 'Our accountant needs CSV.', boardSlug: 'ideas' }), 201)
  assert.equal(await post('/api/operator/catalog/tags', { name: 'billing' }), 201)
  errors = []
  await page.goto(runtime.origin + '/app/moderation', { waitUntil: 'networkidle' })
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Export invoices to CSV', exact: true }) })
  await card.waitFor()
  await page.waitForTimeout(2000)
  assert.deepEqual(errors, [], 'no render loop or other console error on Moderation')
  await card.getByText('Discussion, status and request controls', { exact: true }).click()
  const tags = card.locator('form').filter({ has: page.getByLabel('Add tag') })
  await tags.getByLabel('Add tag').selectOption({ label: 'billing' })
  await tags.getByRole('button', { name: 'Apply tag', exact: true }).click()
  await card.getByRole('list', { name: 'Private tags' }).getByText('billing', { exact: true }).waitFor()
  assert.deepEqual(errors, [], 'tagging leaves the page quiet')
})

test('[IMP-001] a Canny post export moves in from the Data page alone: choose the CSV, preview, apply, and its requests await moderation', { timeout: 300000 }, async () => {
  errors = []
  await page.goto(runtime.origin + '/app/data', { waitUntil: 'networkidle' })
  const panel = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Move saved feedback in', exact: true }) })
  await panel.getByLabel('What did you export?').selectOption('canny')
  await panel.getByLabel('Export file', { exact: true }).setInputFiles(cannyExport)
  await panel.getByText('3 rows read from canny-export.csv', { exact: false }).waitFor()
  await panel.getByRole('button', { name: 'Preview saved feedback', exact: true }).click()
  await panel.getByRole('heading', { name: 'Review the import', exact: true }).waitFor()
  assert.match(await panel.innerText(), /\d+ mapped; 0 rejected/)
  await panel.getByRole('button', { name: 'Apply reviewed import', exact: true }).click()
  for (let step = 0; step < 20 && !await panel.getByText(/^Import complete/).count(); step++) {
    const resume = panel.getByRole('button', { name: 'Resume saved import', exact: true })
    if (await resume.count()) await resume.click()
    await page.waitForTimeout(500)
  }
  await panel.getByText(/^Import complete/).waitFor()
  await page.goto(runtime.origin + '/app/moderation', { waitUntil: 'networkidle' })
  for (const title of ['Export invoices to PDF', 'Dark mode', 'Bulk archive']) await page.getByRole('heading', { name: title, exact: true }).waitFor()
  assert.deepEqual(errors, [])
})
