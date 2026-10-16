import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { chromium } from '@playwright/test'
import { browserOptions } from './browser-options.mjs'
import { startBrowserRuntime } from './base-runtime.mjs'
import { freshLocalRuntime } from './fresh-local-runtime.mjs'
import { localDatabaseFile } from './local-database.mjs'
import { signIn } from './local-signin.mjs'

const output = resolve(process.env.PENNY_EVIDENCE ?? '../evidence/feedback-import-browser')
assert.ok(!output.startsWith(resolve('.') + '/'), 'feedback import evidence stays outside the checkout')
const runtimeMode = process.env.PENNY_BROWSER_RUNTIME ?? 'rer-dev'
assert.ok(['base', 'rer-dev'].includes(runtimeMode), 'PENNY_BROWSER_RUNTIME must be base or rer-dev')
await mkdir(output, { recursive: true })

const axeSource = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const viewportList = [{ width: 1440, height: 900 }, { width: 390, height: 844 }]
const receiptDestinationTables = [
  'boards', 'requesters', 'requests', 'request_content_submissions', 'evidence_items', 'evidence_versions',
  'request_evidence_contributions', 'request_evidence_links', 'request_tag_assignments', 'request_vote_contributions',
  'request_votes', 'request_comments', 'request_merges', 'request_merge_evidence_transfers',
  'request_merge_vote_transfers', 'request_merge_comment_transfers', 'tags', 'feedback_import_records',
  'request_vote_supporter_types',
]
const businessTables = [...receiptDestinationTables, 'accounts']
const effectTables = [
  'local_auth_outbox', 'rer_mail_development_outbox', 'mail_event_records',
  'notification_outbox', 'notification_outbox_attempts', 'notification_intents', 'notification_attempts',
]
const checks = [], observedEffects = [], expectedBoundaryFailures = [], clientCancellations = []
let browser

// Synthetic UserVoice exports built from UserVoice's documented column names: a
// filtered view where 7 voters are claimed and 5 supporters supplied, one of
// them a proxy vote repeated for a second account.
function uservoiceCsv(headings, rows) {
  const cell = value => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value
  return '\uFEFF' + [headings, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
function uservoiceFixture(namespace) {
  const created = '2024-07-08T09:10:11Z', scope = { scope: 'filtered', filter: 'Status: open ideas; Forum: Product ideas' }
  const ideas = uservoiceCsv(['Idea ID', 'Idea Title', 'Idea Description', 'Created Timestamp', 'Public Status Name', 'Idea Creator ID', 'Idea Creator Name', 'Idea Creator Email Address', 'Voters Count', 'Moderation State'], [
    ['101', 'Keyboard, labels', 'Exact café "quote"\r\nSecond line', created, 'Under Review', 'c1', 'Creator Café', 'creator@example.test', '5', 'Published'],
    ['102', 'Dark mode', '', created, '', '', '', '', '2', 'Published'],
  ])
  const voter = (idea, user, name, email, account, feedback) => [idea, user, name, email, account, created, feedback, feedback ? 'admin-9' : '', feedback ? 'Admin Nine' : '']
  const voters = uservoiceCsv(['Idea ID', 'User ID', 'User Name', 'User Email Address', 'Account Name', 'Linked Idea Creation Date', 'Feedback ID', 'Feedback Capturer', 'Feedback Captured By'], [
    voter('101', 'c1', 'Creator Café', 'creator@example.test', '', ''), voter('101', 'u1', 'Alex', 'alex@example.test', 'Account one', ''),
    voter('101', 'u2', 'Bea', 'shared@example.test', 'Account one', 'fb-1'), voter('101', 'u2', 'Bea', 'shared@example.test', 'Account two', 'fb-1'),
    voter('102', 'u1', 'Alex', 'alex@example.test', 'Account one', ''), voter('102', 'u3', 'Bea', 'shared@example.test', '', ''),
  ])
  return {
    namespace, statuses: { 'Under Review': 'under_review', '': 'open' },
    boards: [{ id: 'uservoice-board', name: 'UserVoice ideas', isPrivate: true, created }],
    files: [
      { name: 'ideas.csv', kind: 'posts', version: 'uservoice-ideas-csv', boardId: 'uservoice-board', uservoice: scope, base64: Buffer.from(ideas).toString('base64') },
      { name: 'voters.csv', kind: 'votes', version: 'uservoice-voters-csv', uservoice: scope, base64: Buffer.from(voters).toString('base64') },
    ],
  }
}

async function fixture(namespace, family) {
  if (family === 'uservoice') return uservoiceFixture(namespace)
  if (family === 'ideas') {
    const csv = '\uFEFFIdea key,Title,Description,Status,Created,Votes,Comments,Companies,Owner\r\n' +
      'idea-1,"Keyboard, labels","Exact café ""quote""",open,2024-07-08T09:10:11.000Z,40,12,"Acme, Inc.",Product\r\n'
    return {
      namespace,
      statuses: { open: 'open' },
      boards: [{ id: 'ideas-board', name: 'Historical ideas', isPrivate: true, created: '2024-07-08T09:10:11.000Z' }],
      files: [{
        name: 'ideas.csv', kind: 'posts', version: 'ideas-csv', boardId: 'ideas-board',
        ideas: {
          key: 'Idea key', title: 'Title', details: 'Description', status: 'Status', created: 'Created',
          aggregates: { Votes: 'count', Comments: 'count', Companies: 'company' }, omissions: ['Owner'],
        },
        base64: Buffer.from(csv).toString('base64'),
      }],
    }
  }

  const files = await Promise.all(['boards', 'users', 'posts', 'votes', 'comments', 'tags'].map(async kind => ({
    name: kind + '.json', kind, version: ['users', 'votes', 'comments'].includes(kind) ? 'v2' : 'v1',
    base64: (await readFile(new URL('../fixtures/imports/' + kind + '.json', import.meta.url))).toString('base64'),
  })))
  files.splice(0, files.length, ...files.filter(file => ['boards', 'tags'].includes(file.kind)))
  for (const [name, boardId] of [['public.csv', 'public-board'], ['internal.csv', 'internal-board']]) files.push({
    name, boardId, kind: 'posts', version: 'classic-csv',
    tagMapping: { Accessibility: ['tag-0'], 'Private renewal concern': ['tag-1'] },
    base64: (await readFile(new URL('../fixtures/imports/export/' + name, import.meta.url))).toString('base64'),
  })
  for (const kind of ['votes', 'comments', 'merges']) files.push({
    name: kind + '.json', kind, version: kind === 'merges' ? 'relationships-v1' : 'v2',
    base64: (await readFile(new URL('../fixtures/imports/export/' + kind + '.json', import.meta.url))).toString('base64'),
  })
  return { namespace, statuses: { open: 'open', planned: 'planned' }, files }
}

async function counts(runtime, tables) {
  if (runtimeMode === 'base') {
    const result = {}
    for (const table of tables) result[table] = await runtime.db.prepare(`SELECT COUNT(*) n FROM "${table}"`).first('n')
    return result
  }
  const database = new DatabaseSync(await localDatabaseFile(join(runtime.root, '.wrangler/state')), { readOnly: true })
  try {
    return Object.fromEntries(tables.map(table => [table, database.prepare(`SELECT COUNT(*) n FROM "${table}"`).get().n]))
  } finally { database.close() }
}

// Stable IDs follow the namespace, so a journey that asserts one idea's
// content names it by title; otherwise any imported request will do.
async function importedRequest(runtime, jobId, title = null) {
  const query = `SELECT request_row.slug, board_row.slug AS boardSlug
    FROM ik_provenance provenance
    JOIN requests request_row ON request_row.id = provenance.target_id
    JOIN boards board_row ON board_row.id = request_row.board_id
    WHERE provenance.job_id = ? AND provenance.target_kind = 'posts' AND provenance.reversed = 0
      AND (? IS NULL OR request_row.title = ?)
    ORDER BY provenance.target_id LIMIT 1`
  if (runtimeMode === 'base') return runtime.db.prepare(query).bind(jobId, title, title).first()
  const database = new DatabaseSync(await localDatabaseFile(join(runtime.root, '.wrangler/state')), { readOnly: true })
  try {
    return database.prepare(query).get(jobId, title, title)
  } finally { database.close() }
}

function classifyExpectedHttpConsole(errors, start, status, operation) {
  const observed = errors.splice(start)
  const pattern = /failed to load resource/i
  const expected = observed.filter(message => pattern.test(message) && new RegExp(`\\b${status}\\b`).test(message))
  assert.ok(expected.length <= 1, `${operation}: at most one browser console error for the expected HTTP ${status}`)
  assert.deepEqual(observed.filter(message => !expected.includes(message)), [], `${operation}: no other console errors are expected`)
  return expected
}

async function checkAxe(page, label) {
  await page.evaluate(axeSource)
  const serious = await page.evaluate(async () => (await window.axe.run(document)).violations.filter(row => ['serious', 'critical'].includes(row.impact)))
  assert.deepEqual(serious, [], `${label}: serious and critical axe violations`)
}

function trackPage(page, origin) {
  const errors = [], external = [], failed = [], cancelled = [], authResponses = [], responded = new WeakSet()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin !== origin) external.push(url.origin)
  })
  // Resource reads abort their own fetch on unmount or retry (and React's dev
  // StrictMode mounts each effect twice). A GET, or a request whose response
  // already arrived, ending in ERR_ABORTED is that client cancellation; every
  // other failure, including an aborted write without a response, is a failure.
  page.on('requestfailed', request => {
    const row = { url: request.url(), method: request.method(), error: request.failure()?.errorText ?? 'unknown' }
    if (row.error === 'net::ERR_ABORTED' && (row.method === 'GET' || responded.has(request))) cancelled.push(row)
    else failed.push(row)
  })
  page.on('response', response => {
    responded.add(response.request())
    const url = new URL(response.url())
    if (response.status() === 401 && response.request().method() === 'GET' && /^\/api\/operator\/feedback-import\/jobs\/[^/]+\/receipt$/.test(url.pathname)) authResponses.push(url.pathname)
  })
  return { errors, external, failed, cancelled, authResponses }
}

async function capture(page, family, label, viewport) {
  const name = `${family}-${label}`
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
  assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth), false, `${name} ${viewport.width}: viewport overflow`)
  await checkAxe(page, `${name} ${viewport.width}`)
  await page.screenshot({ path: join(output, `${name}-${viewport.width}.png`), fullPage: true })
  checks.push({ label: name, width: viewport.width, height: viewport.height })
}

async function authenticate(runtime, context, page) {
  if (runtimeMode === 'rer-dev') {
    await signIn(page, runtime, async (target, label) => checkAxe(target, label))
  } else {
    const response = await fetch(runtime.origin + '/auth/bootstrap', {
      method: 'POST', redirect: 'manual', headers: { Origin: runtime.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'synthetic-base-browser-setup-token-12345', displayName: 'Owner', returnTo: '/app' }),
    })
    assert.equal(response.status, 303)
    const pair = response.headers.get('set-cookie').split(';')[0], separator = pair.indexOf('=')
    await context.addCookies([{ name: pair.slice(0, separator), value: pair.slice(separator + 1), url: runtime.origin, httpOnly: true, sameSite: 'Lax' }])
  }
  await page.goto(runtime.origin + '/app/data', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Workspace data', exact: true }).waitFor()
}

async function runJourney(runtime, viewport) {
  let context, journeyError
  try {
    context = await browser.newContext({ viewport })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(45_000)
    const page = await context.newPage(), trackers = trackPage(page, runtime.origin)
    const panel = () => page.locator('article').filter({ has: page.getByRole('heading', { name: 'Move saved feedback in', exact: true }) })
    await authenticate(runtime, context, page)

    async function upload(source) {
      await panel().getByLabel('What did you export?').selectOption('bundle')
      await panel().getByLabel('Prepared saved feedback bundle').setInputFiles({
        name: 'prepared.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)),
      })
      const button = panel().getByRole('button', { name: 'Preview saved feedback', exact: true })
      await button.waitFor()
      await page.waitForFunction(() => {
        const input = document.querySelector('input[type=file]')
        return input && !input.disabled && !document.querySelector('article[aria-busy="true"]')
      })
      await button.click()
    }

    async function waitIdle() {
      await page.waitForFunction(() => document.querySelector('article[aria-busy]')?.getAttribute('aria-busy') === 'false')
    }

    async function waitForReceipt() {
      await panel().locator('section[aria-label="Move-in receipt"]').waitFor({ state: 'visible' })
    }

    async function pickSavedJob(id) {
      await panel().getByText('Your saved imports', { exact: true }).click()
      await panel().getByRole('button').filter({ hasText: id }).click()
      await panel().getByRole('heading', { name: 'Saved import', exact: true }).waitFor()
      await waitForReceipt()
    }

    async function applyAndComplete(family, before, captureSuffix = '') {
      const captureLabel = label => captureSuffix ? `${label}-${captureSuffix}` : label
      const session = await context.newCDPSession(page)
      await session.send('Network.enable')
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: -1, uploadThroughput: -1 })
      const applied = page.waitForResponse(response => response.url().endsWith('/feedback-import/apply') && response.request().method() === 'POST')
      await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).click()
      const response = await applied
      assert.ok([200, 202].includes(response.status()), `${family}: import apply was accepted`)
      const job = await response.json()
      assert.ok(job.checkpoint > 0)
      await panel().getByRole('heading', { name: 'Saved import', exact: true }).waitFor()
      await panel().getByText('Loading move-in receipt…', { exact: true }).waitFor({ state: 'visible' })
      await capture(page, family, captureLabel('loading-receipt'), viewport)
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
      await session.detach()

      for (let step = 0; step < 20; step++) {
        const resume = panel().getByRole('button', { name: 'Resume saved import', exact: true })
        if (!await resume.count()) break
        const continued = page.waitForResponse(response => response.url().endsWith('/resume') && response.request().method() === 'POST')
        await resume.click()
        assert.equal((await continued).status(), 200)
        await waitIdle()
      }
      await panel().getByRole('button', { name: 'Undo unchanged imported effects', exact: true }).waitFor()
      await waitForReceipt()
      const receiptElement = panel().locator('section[aria-label="Move-in receipt"]')
      const receiptText = await receiptElement.innerText()
      assert.match(receiptText, /Imported\. These records are in Penny\./)
      assert.match(receiptText, /Mail outbox rows\s+0/)
      assert.match(receiptText, /Notification rows\s+0/)
      assert.ok(await receiptElement.getByRole('heading', { name: 'What Penny creates', exact: true }).count())
      if (viewport.width >= 640) assert.ok(await receiptElement.getByRole('table', { name: 'Destination row counts by table' }).count())
      await capture(page, family, captureLabel('applied-receipt'), viewport)

      const responseReceipt = await page.request.get(`${runtime.origin}/api/operator/feedback-import/jobs/${encodeURIComponent(job.id)}/receipt`)
      assert.equal(responseReceipt.status(), 200)
      const receipt = await responseReceipt.json()
      const afterApplied = await counts(runtime, [...businessTables, ...effectTables])
      const appliedDeltas = Object.fromEntries(businessTables.map(table => [table, afterApplied[table] - before[table]]))
      if (family === 'ideas') for (const table of ['requesters', 'request_content_submissions', 'request_vote_contributions', 'request_votes', 'accounts']) {
        assert.equal(appliedDeltas[table], 0, `Ideas aggregates do not create ${table} records`)
      }
      for (const destination of receipt.destinations) {
        assert.match(destination.table, /^[a-z0-9_]+$/)
        assert.ok(receiptDestinationTables.includes(destination.table), `${family}: ${destination.table} has a measured before/after count`)
        assert.equal(appliedDeltas[destination.table], destination.created - destination.removed, `${family}: measured ${destination.table} rows match its receipt`)
      }
      const effectsBefore = Object.fromEntries(effectTables.map(table => [table, before[table]]))
      const effectsAfter = Object.fromEntries(effectTables.map(table => [table, afterApplied[table]]))
      assert.deepEqual(effectsAfter, effectsBefore, `${family}: import adds no mail or notification rows`)
      observedEffects.push({ family, phase: 'completed', destinations: appliedDeltas, effectRowsBefore: effectsBefore, effectRowsAfter: effectsAfter })
      return { job, receipt, before, afterApplied }
    }

    async function undoAndCheck(source, family, saved, before) {
      await upload(source)
      await panel().getByRole('heading', { name: 'Review the import', exact: true }).waitFor()
      assert.equal(await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).isEnabled(), true)
      await capture(page, family, 'repeat-review-preview', viewport)
      const repeated = page.waitForResponse(response => response.url().endsWith('/feedback-import/apply') && response.request().method() === 'POST')
      await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).click()
      const replay = await (await repeated).json()
      assert.equal(replay.id, saved.job.id, `${family}: replay uses the original saved job`)
      await waitIdle()
      await panel().getByRole('button', { name: 'Undo unchanged imported effects', exact: true }).waitFor()
      await waitForReceipt()
      assert.deepEqual(await counts(runtime, [...businessTables, ...effectTables]), saved.afterApplied, `${family}: replay creates no duplicate destination rows`)

      const undo = page.waitForResponse(response => response.url().endsWith('/undo') && response.request().method() === 'POST')
      await panel().getByRole('button', { name: 'Undo unchanged imported effects', exact: true }).click()
      assert.equal((await undo).status(), 200)
      await waitIdle()
      for (let step = 0; step < 20; step++) {
        const resume = panel().getByRole('button', { name: 'Resume saved import', exact: true })
        if (!await resume.count()) break
        const continued = page.waitForResponse(response => response.url().endsWith('/resume') && response.request().method() === 'POST')
        await resume.click()
        assert.equal((await continued).status(), 200)
        await waitIdle()
      }
      await panel().getByRole('status').filter({ hasText: 'Imported effects removed' }).waitFor()
      await waitForReceipt()
      const receiptElement = panel().locator('section[aria-label="Move-in receipt"]')
      assert.match(await receiptElement.innerText(), /Undone\. The imported records are removed\./)
      const undone = await counts(runtime, [...businessTables, ...effectTables])
      for (const table of businessTables) assert.equal(undone[table], before[table], `${family}: undo returns ${table} to its prior count`)
      for (const table of effectTables) assert.equal(undone[table], before[table], `${family}: undo leaves ${table} unchanged`)
      await capture(page, family, 'undone-receipt', viewport)
      observedEffects.push({ family, phase: 'undone', destinationRows: Object.fromEntries(businessTables.map(table => [table, undone[table] - before[table]])) })
    }

    async function nativeEditUndoConflict(family, saved) {
      const target = await importedRequest(runtime, saved.job.id)
      assert.ok(target?.slug && target.boardSlug, `${family}: completed job owns an imported request`)
      const conflictBoardSlug = `native-conflict-${family}-${viewport.width}`
      const boardStatus = await page.evaluate(async ({ boardSlug, family }) => (await fetch('/api/operator/boards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: boardSlug, name: `Native conflict review ${family}`, visibility: 'internal' }),
      })).status, { boardSlug: conflictBoardSlug, family })
      assert.equal(boardStatus, 201, `${family}: native board creation uses the operator route`)
      const moveStatus = await page.evaluate(async ({ slug, boardSlug }) => (await fetch(`/api/operator/requests/${encodeURIComponent(slug)}/board`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardSlug }),
      })).status, { slug: target.slug, boardSlug: conflictBoardSlug })
      assert.equal(moveStatus, 200, `${family}: native request move uses the operator route`)
      assert.equal((await importedRequest(runtime, saved.job.id)).boardSlug, conflictBoardSlug, `${family}: imported request reflects the native edit`)

      const beforeConflictUndo = await counts(runtime, [...businessTables, ...effectTables])
      const consoleStart = trackers.errors.length
      const undoResponse = page.waitForResponse(response => response.url().endsWith('/undo') && response.request().method() === 'POST')
      const jobPath = `/api/operator/feedback-import/jobs/${encodeURIComponent(saved.job.id)}`
      const refreshedJobResponse = page.waitForResponse(response => response.url() === runtime.origin + jobPath && response.request().method() === 'GET' && response.status() === 200)
      const refreshedJobsResponse = page.waitForResponse(async response => {
        if (response.url() !== runtime.origin + '/api/operator/feedback-import/jobs' || response.request().method() !== 'GET' || response.status() !== 200) return false
        const rows = await response.json()
        return rows.some(row => row.id === saved.job.id && row.state === 'preflighting')
      })
      await panel().getByRole('button', { name: 'Undo unchanged imported effects', exact: true }).click()
      assert.equal((await undoResponse).status(), 409, `${family}: undo refuses to erase a native-edited row`)
      await waitIdle()
      const undoAlert = panel().getByRole('alert').filter({ hasText: 'later native work conflicts' })
      await undoAlert.waitFor()
      assert.match(await undoAlert.innerText(), /later native work conflicts/, `${family}: the native-conflict error remains visible after refresh`)
      const conflictConsoleErrors = classifyExpectedHttpConsole(trackers.errors, consoleStart, 409, `POST /api/operator/feedback-import/jobs/${saved.job.id}/undo`)
      expectedBoundaryFailures.push({ family, width: viewport.width, operation: `/api/operator/feedback-import/jobs/${saved.job.id}/undo`, method: 'POST', status: 409, consoleErrors: conflictConsoleErrors })

      const afterConflictUndo = await counts(runtime, [...businessTables, ...effectTables])
      assert.deepEqual(afterConflictUndo, beforeConflictUndo, `${family}: conflicting undo deletes no business or effect rows`)
      const jobsSummary = panel().getByText('Your saved imports', { exact: true })
      const jobsDetails = panel().locator('details:has(> summary:text-is("Your saved imports"))')
      if (await jobsDetails.getAttribute('open') === null) await jobsSummary.click()
      const savedJobEntry = panel().getByRole('button').filter({ hasText: saved.job.id })
      await savedJobEntry.filter({ hasText: 'preflighting' }).waitFor({ state: 'visible' })
      await panel().getByText(/Checking before undo · \d+ of \d+ source records/).waitFor({ state: 'visible' })
      await panel().getByRole('button', { name: 'Resume saved import', exact: true }).waitFor({ state: 'visible' })
      await waitForReceipt()
      const preflightReceipt = panel().locator('section[aria-label="Move-in receipt"]')
      assert.match(await preflightReceipt.innerText(), /Checking every imported record before undo\./, `${family}: selected job displays its persisted preflight state immediately`)
      const refreshedJob = await refreshedJobResponse
      assert.equal((await refreshedJob.json()).state, 'preflighting', `${family}: selected job refresh uses its public read route`)
      await refreshedJobsResponse
      assert.match(await savedJobEntry.innerText(), /^preflighting · /, `${family}: saved import list refresh exposes the reversal state`)

      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Workspace data', exact: true }).waitFor()
      await pickSavedJob(saved.job.id)
      await panel().getByText(/Checking before undo · \d+ of \d+ source records/).waitFor({ state: 'visible' })
      await panel().getByRole('button', { name: 'Resume saved import', exact: true }).waitFor({ state: 'visible' })
      const reopenedJobResponse = await page.request.get(runtime.origin + jobPath)
      assert.equal(reopenedJobResponse.status(), 200)
      assert.equal((await reopenedJobResponse.json()).state, 'preflighting', `${family}: the same saved job retains reversal intent after reopening`)

      const resumeConsoleStart = trackers.errors.length
      const resumeResponse = page.waitForResponse(response => response.url().endsWith('/resume') && response.request().method() === 'POST')
      await panel().getByRole('button', { name: 'Resume saved import', exact: true }).click()
      assert.equal((await resumeResponse).status(), 409, `${family}: resuming the retained undo intent rechecks native work and refuses again`)
      await waitIdle()
      const resumeAlert = panel().getByRole('alert').filter({ hasText: 'later native work conflicts' })
      await resumeAlert.waitFor()
      const resumeConsoleErrors = classifyExpectedHttpConsole(trackers.errors, resumeConsoleStart, 409, `POST /api/operator/feedback-import/jobs/${saved.job.id}/resume`)
      expectedBoundaryFailures.push({ family, width: viewport.width, operation: `/api/operator/feedback-import/jobs/${saved.job.id}/resume`, method: 'POST', status: 409, consoleErrors: resumeConsoleErrors })
      assert.deepEqual(await counts(runtime, [...businessTables, ...effectTables]), beforeConflictUndo, `${family}: resumed conflicting undo still changes no business or effect rows`)

      const receiptPath = `/api/operator/feedback-import/jobs/${encodeURIComponent(saved.job.id)}/receipt`
      const refreshedReceiptResponse = page.waitForResponse(response => response.url() === runtime.origin + receiptPath && response.request().method() === 'GET' && response.status() === 200)
      await panel().getByRole('button', { name: 'Refresh receipt', exact: true }).click()
      const receiptResponse = await refreshedReceiptResponse
      const receipt = await receiptResponse.json()
      assert.equal(receipt.phase, 'preflighting', `${family}: conflicting undo retains its reversal phase`)
      assert.equal(receipt.originalsRetained, true, `${family}: original source remains retained`)
      assert.ok(receipt.conflicts.length > 0, `${family}: receipt records native work conflict`)
      assert.ok(receipt.destinations.every(destination => destination.removed === 0), `${family}: conflict receipt reports zero removals`)
      const receiptPanel = panel().locator('section[aria-label="Move-in receipt"]')
      await receiptPanel.getByRole('heading', { name: /Kept because native work depends on it/ }).waitFor()
      const receiptText = await receiptPanel.innerText()
      assert.match(receiptText, /Native requests values or relationships changed/)
      assert.match(receiptText, /private source originals are retained/i)
      await capture(page, family, 'native-edit-conflict-receipt', viewport)
      observedEffects.push({ family, phase: 'undo-conflict', before: beforeConflictUndo, after: afterConflictUndo, zeroDeletions: true, conflictCount: receipt.conflicts.length })
    }

    async function familyJourney(family) {
      const source = await fixture(`browser-${family}-${viewport.width}`, family)
      if (family === 'classic') {
        const invalid = structuredClone(source)
        invalid.statuses = {}
        await upload(invalid)
        await panel().getByRole('heading', { name: 'Review the import', exact: true }).waitFor()
        assert.equal(await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).isDisabled(), true)
        await capture(page, family, 'rejected-preview', viewport)
      } else if (family === 'uservoice') {
        const workbook = structuredClone(source)
        workbook.files[1] = { ...workbook.files[1], name: 'voters.xlsx', base64: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('xl/workbook.xml')]).toString('base64') }
        const refusalConsoleStart = trackers.errors.length
        const refusalResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/operator/feedback-import/preview' && response.request().method() === 'POST')
        await upload(workbook)
        assert.equal((await refusalResponse).status(), 422, `${family}: a spreadsheet workbook is refused by preview`)
        const alert = panel().getByRole('alert')
        await alert.waitFor()
        assert.match(await alert.innerText(), /CSV UTF-8 \(Comma delimited\)/)
        const refusalConsoleErrors = classifyExpectedHttpConsole(trackers.errors, refusalConsoleStart, 422, 'POST /api/operator/feedback-import/preview')
        expectedBoundaryFailures.push({ family, width: viewport.width, operation: '/api/operator/feedback-import/preview', method: 'POST', status: 422, consoleErrors: refusalConsoleErrors })
        await capture(page, family, 'workbook-refusal', viewport)
      } else {
        const unmapped = structuredClone(source)
        delete unmapped.files[0].ideas
        const refusalConsoleStart = trackers.errors.length
        const refusalResponse = page.waitForResponse(response => {
          const url = new URL(response.url())
          return url.origin === runtime.origin && url.pathname === '/api/operator/feedback-import/preview' && response.request().method() === 'POST'
        })
        await upload(unmapped)
        const refusal = await refusalResponse
        assert.equal(refusal.status(), 422, `${family}: missing heading mappings are refused by preview`)
        const alert = panel().getByRole('alert')
        await alert.waitFor()
        assert.match(await alert.innerText(), /explicit key, title, details, status and created heading mappings/i)
        const refusalConsoleErrors = classifyExpectedHttpConsole(trackers.errors, refusalConsoleStart, 422, 'POST /api/operator/feedback-import/preview')
        expectedBoundaryFailures.push({ family, width: viewport.width, operation: '/api/operator/feedback-import/preview', method: 'POST', status: 422, consoleErrors: refusalConsoleErrors })
        await capture(page, family, 'heading-refusal', viewport)
      }

      await upload(source)
      await panel().getByRole('heading', { name: 'Review the import', exact: true }).waitFor()
      assert.equal(await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).isEnabled(), true)
      const previewReceipt = panel().locator('section[aria-label="Preview receipt"]')
      await previewReceipt.waitFor()
      assert.ok(await previewReceipt.getByRole('heading', { name: 'What Penny creates', exact: true }).count())
      if (viewport.width >= 640) assert.ok(await previewReceipt.getByRole('table', { name: 'Destination row counts by table' }).count())
      assert.ok(await panel().getByRole('heading', { name: 'Aggregate only', exact: true }).count(), `${family}: preview presents aggregate-only values`)
      if (family === 'ideas') {
        const aggregateText = await previewReceipt.innerText()
        assert.match(aggregateText, /Votes/)
        assert.match(aggregateText, /40/)
        assert.match(aggregateText, /Comments/)
        assert.match(aggregateText, /12/)
        assert.match(aggregateText, /Not summed/)
        assert.match(aggregateText, /Owner/)
        assert.match(aggregateText, /No requester or initial submission is invented/)
      }
      if (family === 'uservoice') {
        const history = previewReceipt.locator('[aria-label="UserVoice history"]')
        const historyText = await history.innerText()
        assert.match(historyText, /Partial history/)
        assert.match(historyText, /Status: open ideas; Forum: Product ideas/)
        assert.match(historyText, /Claimed by Voters Count\s+7/)
        assert.match(historyText, /Supplied supporters on those ideas\s+5/)
        assert.match(historyText, /Aggregate only, creates nothing\s+2/)
        assert.match(historyText, /Entered by a UserVoice admin \(proxy\)\s+1/)
      }
      await capture(page, family, 'review-preview', viewport)
      const before = await counts(runtime, [...businessTables, ...effectTables])
      const saved = await applyAndComplete(family, before)
      if (family === 'ideas') {
        const appliedText = await panel().locator('section[aria-label="Move-in receipt"]').innerText()
        assert.match(appliedText, /Historical identity/)
        assert.match(appliedText, /no login, verified identity, consent, outreach audience or commercial authority/i)
      }
      if (family === 'uservoice') {
        const appliedText = await panel().locator('section[aria-label="Move-in receipt"]').innerText()
        assert.match(appliedText, /Partial history/)
        assert.match(appliedText, /Aggregate only, creates nothing\s+2/)
        assert.equal(saved.afterApplied.request_vote_contributions - before.request_vote_contributions, 5, `${family}: only the supplied supporters become votes`)
        const target = await importedRequest(runtime, saved.job.id, 'Keyboard, labels')
        await page.goto(runtime.origin + '/app/moderation', { waitUntil: 'networkidle' })
        const card = page.locator(`article#request-${target.slug}`)
        await card.getByText(/^Supporters \(\d+\)$/).click()
        const supporters = card.getByRole('list', { name: 'Supporters' })
        await supporters.waitFor()
        const supporterText = await supporters.innerText()
        assert.match(supporterText, /Bea[\s\S]*Proxy, entered by a UserVoice admin/)
        assert.match(supporterText, /Alex[\s\S]*UserVoice, not marked as proxy/)
        assert.doesNotMatch(supporterText, /@example\.test/)
        await card.scrollIntoViewIfNeeded()
        await capture(page, family, 'request-supporters', viewport)
        await page.goto(runtime.origin + '/app/data', { waitUntil: 'networkidle' })
        await page.getByRole('heading', { name: 'Workspace data', exact: true }).waitFor()
        await pickSavedJob(saved.job.id)
      }

      if (family === 'classic') {
        // Dispose the old Vite client before restart: its reconnect reload can
        // otherwise abort the harness navigation. Keep this context's cookies.
        await page.goto('about:blank')
        if (runtimeMode === 'rer-dev') { await runtime.stop(); await runtime.start() }
        else await runtime.restart()
        await page.goto(runtime.origin + '/app/data', { waitUntil: 'networkidle' })
        await page.getByRole('heading', { name: 'Workspace data', exact: true }).waitFor()
        await pickSavedJob(saved.job.id)
        const reopened = panel().locator('section[aria-label="Move-in receipt"]')
        assert.match(await reopened.innerText(), /Imported\. These records are in Penny\./)
        await capture(page, family, 'persisted-receipt', viewport)
      }
      await undoAndCheck(source, family, saved, before)

      await upload(source)
      await panel().getByRole('heading', { name: 'Review the import', exact: true }).waitFor()
      assert.equal(await panel().getByRole('button', { name: 'Apply reviewed import', exact: true }).isEnabled(), true)
      const nextGenerationBefore = await counts(runtime, [...businessTables, ...effectTables])
      const conflictGeneration = await applyAndComplete(family, nextGenerationBefore, 'conflict-generation')
      await nativeEditUndoConflict(family, conflictGeneration)
    }

    await familyJourney('classic')
    await familyJourney('ideas')
    await familyJourney('uservoice')

    const receiptPanel = panel().locator('section[aria-label="Move-in receipt"]')
    const refresh = panel().getByRole('button', { name: 'Refresh receipt', exact: true })
    const consoleErrorsBeforeOffline = trackers.errors.length
    const failuresBeforeOffline = trackers.failed.length
    context.setOffline(true)
    await refresh.click()
    await panel().getByRole('alert').filter({ hasText: 'Move-in receipt could not be loaded' }).waitFor()
    await capture(page, 'uservoice', 'transport-error', viewport)
    const offlineConsoleErrors = trackers.errors.splice(consoleErrorsBeforeOffline)
    assert.ok(offlineConsoleErrors.every(message => message.includes('ERR_INTERNET_DISCONNECTED') || message === 'Failed to fetch'), `viewport ${viewport.width}: only the intentional offline receipt request may log an error`)
    const offlineFailures = trackers.failed.splice(failuresBeforeOffline)
    assert.ok(offlineFailures.length > 0, `viewport ${viewport.width}: offline receipt request failed at the browser network boundary`)
    assert.ok(offlineFailures.every(row => row.error.includes('ERR_INTERNET_DISCONNECTED') && new URL(row.url).pathname.endsWith('/receipt')), `viewport ${viewport.width}: only the receipt request failed while offline`)
    expectedBoundaryFailures.push(...offlineFailures.map(row => ({ width: viewport.width, url: new URL(row.url).pathname, error: row.error, consoleErrors: offlineConsoleErrors })))
    context.setOffline(false)
    await panel().getByRole('button', { name: 'Try again', exact: true }).click()
    await receiptPanel.waitFor({ state: 'visible' })

    const signedOut = await page.evaluate(async () => {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      return response.status
    })
    assert.equal(signedOut, 204)
    assert.equal((await page.request.get(runtime.origin + '/api/auth/session')).status(), 401, 'sign-out removes the active operator session')
    const consoleErrorsBeforeExpired = trackers.errors.length
    const authResponsesBeforeExpired = trackers.authResponses.length
    await refresh.waitFor({ state: 'visible' })
    await refresh.click()
    await panel().getByText('Your operator session has expired.', { exact: true }).waitFor({ state: 'visible' })
    await capture(page, 'uservoice', 'expired-session', viewport)
    const expiredConsoleErrors = trackers.errors.splice(consoleErrorsBeforeExpired)
    assert.ok(expiredConsoleErrors.every(message => /(?:401|Unauthorized)/i.test(message)), `viewport ${viewport.width}: only the expected expired receipt request may log an auth error`)
    const expiredResponses = trackers.authResponses.slice(authResponsesBeforeExpired)
    assert.equal(expiredResponses.length, 1, `viewport ${viewport.width}: the mounted receipt received one real 401 after sign-out`)
    expectedBoundaryFailures.push({ width: viewport.width, status: 401, operation: expiredResponses[0], consoleErrors: expiredConsoleErrors })

    const unexpectedFailed = trackers.failed.filter(row => !row.error.includes('ERR_INTERNET_DISCONNECTED'))
    clientCancellations.push({ width: viewport.width, count: trackers.cancelled.length, requests: trackers.cancelled.map(row => `${row.method} ${new URL(row.url).pathname}`) })
    assert.deepEqual(trackers.errors, [], `viewport ${viewport.width}: unexpected browser errors`)
    assert.deepEqual(trackers.external, [], `viewport ${viewport.width}: requests stayed same-origin`)
    assert.deepEqual(unexpectedFailed, [], `viewport ${viewport.width}: unexpected failed requests`)
    if (runtimeMode === 'base') assert.equal(runtime.outbox.length, 0)
  } catch (error) {
    journeyError = error
  }
  const cleanupFailures = []
  for (const cleanup of [() => context?.close(), () => runtime.close()]) {
    try { await cleanup() } catch (error) { cleanupFailures.push(error) }
  }
  if (cleanupFailures.length) throw new AggregateError([journeyError, ...cleanupFailures].filter(Boolean), 'Feedback-import browser journey cleanup failed.')
  if (journeyError) throw journeyError
}

try {
  browser = await chromium.launch(browserOptions())
  for (const viewport of viewportList) {
    const runtime = runtimeMode === 'rer-dev'
      ? await freshLocalRuntime(viewport, output)
      : await startBrowserRuntime({ bindings: { PENNY_ENVIRONMENT: 'local' } })
    await runJourney(runtime, viewport)
  }
  await writeFile(join(output, 'results.json'), JSON.stringify({
    runtimeMode,
    scope: runtimeMode === 'rer-dev' ? 'fresh rer dev runtime' : 'emitted modules in the existing Base browser runtime; local route probe only',
    clauses: ['IMP-001', 'IMP-002', 'IMP-003', 'IMP-004', 'IMP-007', 'IMP-008', 'BASE-ACCESS-002', 'BASE-UX-001'],
    checks,
    measuredEffects: observedEffects,
    expectedBoundaryFailures,
    clientCancellations,
    unexpectedErrors: 0,
    externalRequests: 0,
    providerCalls: 0,
    teardown: 'fulfilled',
  }, null, 2) + '\n')
  console.log(`feedback-import: ${checks.length} captures passed (${runtimeMode}); evidence: ${output}`)
} catch (error) {
  try { await browser?.close() }
  catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Feedback-import browser and teardown both failed.') }
  throw error
}
await browser?.close()
