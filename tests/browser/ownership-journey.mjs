import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { browserOptions } from './browser-options.mjs'
import { startBrowserRuntime } from './base-runtime.mjs'
import { proveBulkActions } from './triage-bulk.mjs'
import { finishFirstRun } from './local-signin.mjs'

const output = resolve(process.env.PENNY_EVIDENCE ?? '../evidence/triage-ownership')
assert.ok(!output.startsWith(resolve('.') + '/'), 'Ownership evidence stays outside the repository')
await mkdir(output, { recursive: true })
const axe = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
let captures = 0
let browser
process.env.PENNY_BROWSER_EXECUTABLE??=chromium.executablePath()
function safeMessage(message) { return message.replace(/https?:\/\/\S+/g, value => { try { return new URL(value).pathname } catch { return '[URL]' } }) }

try {
 browser = await chromium.launch(browserOptions())
 for (const width of [1440, 390]) {
  const runtime = await startBrowserRuntime(), contexts = []
  try {
   const { origin } = runtime, errors = [], external = []
   async function send(path, body, cookie, method = body === undefined ? 'GET' : 'POST', expected = 200, extra = {}) {
    const response = await fetch(origin + path, { method, redirect: 'manual', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), `${path} returned ${response.status}`)
    return response
   }
   async function json(path, body, cookie, method, expected, extra) { return (await send(path, body, cookie, method, expected, extra)).json() }
   const bootstrap = await send('/auth/bootstrap', { token: 'synthetic-base-browser-setup-token-12345', displayName: 'Owner', returnTo: '/app' }, null, 'POST', 303)
   const ownerCookie = bootstrap.headers.get('set-cookie').split(';')[0]
   async function signedContext(cookie) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, timezoneId: 'Australia/Brisbane' })
    context.on('page', target => {
     target.on('pageerror', error => errors.push(safeMessage(error.message)))
     target.on('console', message => { if (message.type() === 'error') errors.push(safeMessage(message.text())) })
     target.on('request', request => { if (new URL(request.url()).origin !== origin) external.push(new URL(request.url()).origin) })
    })
    contexts.push(context)
    const split = cookie.indexOf('=')
    await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), url: origin, httpOnly: true, sameSite: 'Lax' }])
    return context
   }
   const context = await signedContext(ownerCookie), page = await context.newPage()
   async function audit(target, label, { detail, axeZero = false } = {}) {
    assert.equal(await target.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth), false, `[TRIAGE-001] ${label} fits ${width}`)
    await target.evaluate(axe)
    assert.deepEqual(await target.evaluate(async zero => (await window.axe.run(document)).violations.filter(violation => zero || ['serious', 'critical'].includes(violation.impact)), axeZero), [], `[TRIAGE-001] ${label} accessible at ${width}`)
    await target.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true })
    if (detail) await detail.screenshot({ path: join(output, `${label}-detail-${width}.png`) })
    captures++
   }
   await page.goto(origin + '/setup'); await finishFirstRun(page, audit)
   await json('/api/operator/boards', { slug: 'accountability', name: 'Accountability board', visibility: 'public' }, ownerCookie, 'POST', 201)
   await json('/api/operator/settings/operators', { email: 'accountable-peer@example.test' }, ownerCookie, 'POST', 202)
   const inviteToken = new URL(runtime.outbox.findLast(message => message.email === 'accountable-peer@example.test').url).searchParams.get('token')
   const confirmation = await send('/auth/confirm', { token: inviteToken }, null, 'POST', 303)
   const peerCookie = confirmation.headers.get('set-cookie').split(';')[0]
   const catalog = await json('/api/operator/ownership/catalog', undefined, peerCookie)
   const self = catalog.operators.find(operator => operator.displayName === 'Owner'), peer = catalog.operators.find(operator => operator.id !== self.id)
   assert.ok(self && peer)

   await page.goto(origin + '/app/settings')
   const defaults = page.getByRole('region',{name:'Capture ownership',exact:true})
   await defaults.getByRole('combobox', { name: 'Default owner on capture' }).selectOption(self.id)
   await defaults.getByRole('button', { name: 'Save owner', exact: true }).click()
   await defaults.getByRole('status').filter({ hasText: 'Owner saved.' }).waitFor()
   await audit(page, 'board-default-owner', { detail: defaults })

   await page.goto(origin + '/app/feedback')
   const mine = page.getByRole('region', { name: 'My queue', exact: true })
   // The recorder and board choices are server-rendered. The queue's loaded
   // contents prove the page has hydrated before we fill or submit the form.
   await mine.getByRole('heading', { name: 'Evidence (0)', exact: true }).waitFor()
   const recorder = page.getByRole('form', { name: 'New evidence', exact: true })
   await recorder.getByLabel('Source', { exact: true }).selectOption('interview')
   await recorder.getByLabel('Original wording', { exact: true }).fill('Harbor Analytics needs scheduled CSV exports for its monthly finance review. Maya will follow up with the finance team.')
   await recorder.getByLabel('Observed time', { exact: true }).fill('2026-10-17T10:00')
   await recorder.getByLabel('Capture board (optional)', { exact: true }).selectOption('accountability')
   await recorder.getByRole('button', { name: 'Record evidence', exact: true }).click()
   await recorder.getByRole('status').filter({ hasText: 'Saved.' }).waitFor()
   const evidenceId = await runtime.db.prepare('SELECT evidence_id FROM penny_evidence_owners WHERE operator_id=?').bind(self.id).first('evidence_id')
   assert.ok(evidenceId)
   const evidence = page.locator(`#evidence-${evidenceId}`)
   await evidence.getByRole('combobox', { name: 'Accountable owner', exact: true }).waitFor()
   assert.equal(await evidence.getByRole('combobox', { name: 'Accountable owner' }).inputValue(), self.id)
   await mine.getByRole('heading', { name: 'Evidence (1)', exact: true }).waitFor()
   await audit(page, 'captured-default-and-own-queue', { detail: mine })
   await evidence.getByText('Record a customer’s vote', { exact: true }).click()
   assert.equal(await evidence.getByRole('button', { name: 'Record proxy vote', exact: true }).isDisabled(), true, 'a proxy vote needs an available request')
   await audit(page, 'proxy-vote-before-first-request', { detail: evidence.getByRole('button', { name: 'Record proxy vote', exact: true }).locator('..') })
   await evidence.getByText('Record a customer’s vote', { exact: true }).click()
   await recorder.screenshot({ path: join(output, `capture-board-form-${width}.png`) })
   await evidence.getByRole('form', { name: 'Accountable owner', exact: true }).screenshot({ path: join(output, `captured-evidence-owner-${width}.png`) })

   await evidence.getByRole('combobox', { name: 'Accountable owner' }).selectOption(peer.id)
   await evidence.getByRole('button', { name: 'Save owner', exact: true }).click()
   await mine.getByRole('heading', { name: 'Evidence (0)', exact: true }).waitFor()
   const peerContext = await signedContext(peerCookie), peerPage = await peerContext.newPage()
   await peerPage.goto(origin + '/app/feedback')
   const peerQueue = peerPage.getByRole('region', { name: 'My queue', exact: true })
   await peerQueue.getByRole('heading', { name: 'Evidence (1)', exact: true }).waitFor()
   await audit(peerPage, 'reassigned-peer-only-queue', { detail: peerQueue })

   const request = await json('/api/operator/requests', { title: 'Schedule monthly finance exports', description: 'Finance needs a CSV export before each monthly review.', boardSlug: 'accountability' }, ownerCookie, 'POST', 201)
   await page.goto(origin + `/app/moderation?item=${request.id}`)
   const requestCard = page.locator(`#request-${request.slug}`)
   assert.equal(await requestCard.getByRole('combobox', { name: 'Accountable owner' }).inputValue(), self.id)
   await requestCard.getByRole('combobox', { name: 'Accountable owner' }).selectOption(peer.id)
   await requestCard.getByRole('button', { name: 'Save owner', exact: true }).click()
   await requestCard.getByRole('status').filter({ hasText: 'Owner saved.' }).waitFor()
   await audit(page, 'request-reassignment', { detail: requestCard.getByRole('form', { name: 'Accountable owner', exact: true }) })
   await json(`/api/operator/moderation/${request.slug}`, { verdict: 'approved', title: 'Schedule monthly finance exports', description: 'Finance needs scheduled CSV exports before the monthly review.', boardSlug: 'accountability', displayName: 'Operator' }, ownerCookie)
   const email = `ownership-customer-${width}@example.test`
   await json('/api/public/identity/email', { email, displayName: 'Customer' }, null, 'POST', 202)
   const customerToken = new URLSearchParams(new URL(runtime.outbox.findLast(message => message.email === email).url).hash.slice(1)).get('token')
   const customer = await json('/api/public/identity/email/verify', { token: customerToken })
   const comment = await json(`/api/public/requests/${request.slug}/comments`, { body: 'Can you help with this workflow?' }, null, 'POST', 201, { Authorization: `Bearer ${customer.token}` })
   await json(`/api/operator/comments/${comment.id}/moderate`, { verdict: 'approved', publicAuthorDisplayName: 'Customer' }, ownerCookie)
   await peerPage.reload()
   await peerQueue.getByRole('heading', { name: 'Requester comments (1)', exact: true }).waitFor()
   await audit(peerPage, 'requester-comment-awaiting', { detail: peerQueue })
   await peerQueue.getByRole('button', { name: 'Mark handled', exact: true }).click()
   await peerQueue.getByRole('heading', { name: 'Requester comments (0)', exact: true }).waitFor()
   await audit(peerPage, 'requester-comment-handled', { detail: peerQueue })

   const publicRequest = await json(`/api/public/requests/${request.slug}`)
   for (const id of [self.id, peer.id]) assert.ok(!JSON.stringify(publicRequest).includes(id), '[TRIAGE-001] public request omits private owners')
   await page.goto(origin + '/app/feedback')
   await page.locator(`#evidence-${evidenceId}`).getByRole('combobox', { name: 'Accountable owner' }).selectOption('')
   await page.locator(`#evidence-${evidenceId}`).getByRole('button', { name: 'Save owner', exact: true }).click()
   await page.locator(`#evidence-${evidenceId}`).getByRole('status').filter({ hasText: 'Owner saved.' }).waitFor()
   await peerPage.reload(); await peerQueue.getByRole('heading', { name: 'Evidence (0)', exact: true }).waitFor()
   await audit(peerPage, 'unassigned-leaves-own-queue', { detail: peerQueue })
   await proveBulkActions({ page, runtime, viewport: width, inspect: audit })
   assert.deepEqual(errors, []); assert.deepEqual(external, [])
  } finally {
   for (const context of contexts.reverse()) await context.close()
   await runtime.close()
  }
 }
 console.log(`TRIAGE-001 ownership: ${captures} page checks passed at 1440/390; native themes remain unimplemented`)
} catch (error) {
 if (error && typeof error === 'object') { if (error.message) error.message = safeMessage(error.message); if (error.stack) error.stack = safeMessage(error.stack) }
 throw error
} finally { await browser?.close() }
