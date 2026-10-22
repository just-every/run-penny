import { browserOptions } from './browser-options.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { finishFirstRun } from './local-signin.mjs'

const evidenceRoot = resolve(process.env.PENNY_EVIDENCE_ROOT ?? join(process.env.PENNY_WORK_ROOT ?? '..', 'evidence'))
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const output = resolve(process.env.PENNY_EVIDENCE ?? join(evidenceRoot, 'route-review', runId))
assert.ok(output.startsWith(resolve(process.env.PENNY_WORK_ROOT??'..')+'/evidence/'),'[E.2] evidence stays under work-root/evidence')
assert.ok(!output.startsWith(resolve('.')+'/'),'[E.2] evidence stays outside product source')

const tempRoot = process.env.TMPDIR ?? join(evidenceRoot, 'tmp', `route-review-${runId}`)
process.env.TMPDIR = tempRoot
process.env.TMP = tempRoot
process.env.TEMP = tempRoot
await mkdir(output, { recursive: true })
await mkdir(tempRoot, { recursive: true })

const { chromium } = await import('@playwright/test')
const { createUnsubscribeLink, longCustomerText, longProviderReceiptId, routeFixtures, seedDeliveryReviewStates, seedRouteReviewDatabase } = await import('./route-review-data.mjs')
const { startBrowserRuntime } = await import('./base-runtime.mjs')
const browserPath = browserOptions().executablePath
const runtime = await startBrowserRuntime()
const { origin } = runtime
const axeSource = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const accessibilityFailures = []
const captures = []
const checks = []
const pageErrors = []
const consoleErrors = [], externalRequests = [], expectedDiagnostics = []
const expectedFailures = new Map(), observedFailures = new Set()
let reviewState = 'populated'
function expectFailure(path,status) { expectedFailures.set(new URL(path,origin).href,status) }
function watch(page) {
 page.on('pageerror', error => pageErrors.push({route:new URL(page.url()).pathname,message:error.message}))
 page.on('request', request => { const url=new URL(request.url()); if(['http:','https:'].includes(url.protocol)&&url.origin!==origin) externalRequests.push({origin:url.origin,path:url.pathname}) })
 page.on('response', response => {if(expectedFailures.get(response.url())===response.status()) observedFailures.add(response.url())})
 page.on('console', message => { if(message.type()!=='error')return;const url=message.location().url,status=expectedFailures.get(url); if(status&&observedFailures.has(url)&&message.text().startsWith(`Failed to load resource: the server responded with a status of ${status} (`))expectedDiagnostics.push({path:new URL(url).pathname,status});else consoleErrors.push({route:new URL(page.url()).pathname,kind:'unexpected console.error',location:safeUrl(url||origin)}) })
}
const layoutFailures = []
const developmentCopyFailures = []
const requestedPaths = []
let browser
let deliveryFixturesSeeded = false
// DOCS-001: the published docs page (docs/site.json) the review opens for the /docs/$slug route.
const docsSampleSlug = 'install'

function safeUrl(value) {
  const url = new URL(value)
  for (const key of ['token', 'sig', 'signature']) if (url.searchParams.has(key)) url.searchParams.set(key, '[redacted]')
  if (url.hash && /token=/i.test(url.hash)) url.hash = '#token=[redacted]'
  return url.toString()
}

function assertNoDevelopmentCopy(text, route, width) {
  const developmentCopy = /not available in this build|not available here|not available on this page|in this milestone|in this build|local review|read[- ]spine|scaffold|development|owner CLI|owner recovery command|durable inbox|durable record|build[- ]stage|\bstage\s+[a-z0-9]+/i
  const match = developmentCopy.exec(text)
  if (match) developmentCopyFailures.push({ route, width, match: match[0], excerpt: text.slice(Math.max(0, match.index - 80), match.index + 160) })
}

async function verifyLayout(page, route, width) {
  const metrics = await page.evaluate(() => {
    const html = document.documentElement
    const body = document.body
    // Content cut off inside a scroll container is reachable by scrolling it, so only its visible part counts; hidden or clipped content is lost, so it counts whole.
    const visibleBox = (element) => {
      let { left, right } = element.getBoundingClientRect()
      for (let ancestor = element.parentElement; ancestor && ancestor !== body; ancestor = ancestor.parentElement) {
        if (!['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowX)) continue
        const clipLeft = ancestor.getBoundingClientRect().left + ancestor.clientLeft
        left = Math.max(left, clipLeft)
        right = Math.min(right, clipLeft + ancestor.clientWidth)
      }
      return { left, right }
    }
    const outside = [...document.querySelectorAll('body *')].flatMap((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return []
      if (style.position === 'fixed') return []
      const visible = visibleBox(element)
      return visible.left < -1 || visible.right > innerWidth + 1
        ? [{ tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '', text: (element.textContent ?? '').trim().slice(0, 70), left: Math.round(rect.left), right: Math.round(rect.right), scrollWidth: element.scrollWidth, minWidth: style.minWidth, overflowWrap: style.overflowWrap }]
        : []
    }).sort((left, right) => right.right - left.right).slice(0, 12)
    return { viewport: innerWidth, html: html.scrollWidth, body: body.scrollWidth, outside }
  })
  const problems = []
  if (metrics.html > width) problems.push(`document scrollWidth ${metrics.html}px exceeds ${width}px`)
  if (metrics.body > width) problems.push(`body scrollWidth ${metrics.body}px exceeds ${width}px`)
  if (metrics.outside.length > 0) problems.push('visible content extends beyond the viewport')
  if (problems.length > 0) layoutFailures.push({ route, width, metrics, problems })
  return { ...metrics, overflow: problems.length > 0 }
}

async function capture(page, route, requestedUrl, responseStatus, auth, width) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))
  })
  await page.evaluate(axeSource)
  const accessibility = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(({id,impact,nodes}) => ({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})))
  if (accessibility.length) accessibilityFailures.push({route,width,violations:accessibility})
  const severe=await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact)).map(({id,impact,nodes})=>({id,impact,targets:nodes.map(n=>n.target)})))
  if(severe.length)accessibilityFailures.push({route,width,scope:'all axe rules',violations:severe})
  const visibleText = await page.locator('body').innerText()
  assertNoDevelopmentCopy(visibleText, route, width)
  const layout = await verifyLayout(page, route, width)
  const file = `${reviewState}-${route.replace(/[^a-zA-Z0-9_-]+/g, '-')}-${width}.jpg`
  const bytes = await page.screenshot({ path: join(output, file), fullPage: true, type: 'jpeg', quality: 72 })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  captures.push({ state:reviewState, route, requestedUrl: safeUrl(requestedUrl), url: safeUrl(page.url()), status: responseStatus, auth, viewport: { width, height: width === 390 ? 844 : 900 }, file, sha256, overflow: layout.overflow })
  return visibleText
}

/** The installed root is the real public board, with search and operator admission. */
async function assertLanding(page, route) {
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, `${route} has one page heading`)
  await page.locator('#feedback-heading').waitFor({state:'visible'})
  await page.getByRole('textbox', {name:'Search feedback'}).waitFor({state:'visible'})
  assert.ok(await page.locator('header a[href="/signin"]').filter({visible:true}).count() > 0)
}

async function visit(page, width, { route, path, auth, contains, finalPath, status = 200, expectPage }) {
  const requestedUrl = path.startsWith('http') ? path : `${origin}${path}`
  requestedPaths.push(new URL(requestedUrl).pathname)
  expectedFailures.clear();observedFailures.clear()
  if(status>=400)expectFailure(requestedUrl,status)
  if(path.startsWith('/app/')&&(route.includes('missing')||path.includes('no-such-record')))expectFailure(path.replace('/app/customers/','/api/operator/accounts/').replace('/app/','/api/operator/'),404)
  const response = await page.goto(requestedUrl, { waitUntil: 'load' })
  await page.locator('body').waitFor({ state: 'visible' })
  // Client route canonicalization must finish before axe evaluates the document.
  await page.waitForLoadState('networkidle')
  const actualStatus = response?.status() ?? 0
  if(response) assertNoDevelopmentCopy(await response.text(),route+'-SSR',width)
  assert.equal(actualStatus, status, `${route} returned HTTP ${actualStatus}`)
  assert.equal(new URL(page.url()).pathname, finalPath ?? new URL(requestedUrl).pathname, `${route} navigated to an unexpected URL`)
  // Hidden controls (closed editors) can repeat record titles earlier in the document, so wait for a visible match.
  if (contains) await page.getByText(contains, { exact: false }).filter({ visible: true }).first().waitFor({ state: 'visible' })
  console.log(`route-review: ${reviewState} ${route} ${width}`)
  const text = await capture(page, route, requestedUrl, actualStatus, auth, width)
  if (contains) assert.ok(text.includes(contains), `${route} did not show expected content: ${contains}`)
  if (expectPage) await expectPage(page, route)
  checks.push({ route, requestedUrl: safeUrl(requestedUrl), finalUrl: safeUrl(page.url()), status: actualStatus, auth, contains: contains ?? null })
  return { response, text }
}

async function api(path, body, headers = {}, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(origin + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: origin, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
  return response
}

function latestLink(email) {
  const message = runtime.outbox.findLast((item) => item.email === email)
  assert.ok(message, `No test-provider message was captured for ${email}.`)
  return message.url
}

function cookieHeader(cookies) {
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
}

async function checkOperatorRoutes(page, width) {
  const routes = [
    { route: 'operator-app', path: '/app', contains: 'Make the next roadmap call defensible.' },
    { route: 'operator-app-slash', path: '/app/', finalPath: '/app', contains: 'Make the next roadmap call defensible.' },
    { route: 'operator-overview', path: '/app/overview', contains: 'Make the next roadmap call defensible.' },
    { route: 'operator-unknown-route', path: '/app/no-such-page', status: 404, contains: 'Check the address or return to your workspace overview.' },
    { route: 'operator-feedback', path: '/app/feedback', contains: 'Review the evidence before it becomes a roadmap promise.' },
    { route: 'operator-moderation', path: '/app/moderation', contains: 'Review feedback before it becomes public.' },
    { route: 'operator-decisions', path: '/app/decisions', contains: 'Make the trade-off visible before you commit.' },
    { route: 'operator-decisions-index', path: '/app/decisions/', finalPath: '/app/decisions', contains: 'Make the trade-off visible before you commit.' },
    { route: 'operator-decision-detail', path: `/app/decisions/${routeFixtures.decision}`, contains: longCustomerText },
    { route: 'operator-decision-missing', path: '/app/decisions/no-such-decision', contains: 'Decision not found' },
    { route: 'operator-roadmap', path: '/app/roadmap', contains: 'SCIM' },
    { route: 'operator-roadmap-active', path: '/app/roadmap?active=true', contains: 'Showing Planned and In progress delivery items.' },
    { route: 'operator-releases', path: '/app/releases', contains: 'Close the loop with the customers who made the decision possible.' },
    { route: 'operator-releases-index', path: '/app/releases/', finalPath: '/app/releases', contains: 'Close the loop with the customers who made the decision possible.' },
    { route: 'operator-release-detail', path: `/app/releases/${routeFixtures.release}`, contains: 'Publication readiness' },
    { route: 'operator-release-missing', path: '/app/releases/no-such-release', contains: 'Release not found' },
    { route: 'operator-customers', path: '/app/customers', contains: 'See who is represented in a product decision.' },
    { route: 'operator-customers-index', path: '/app/customers/', finalPath: '/app/customers', contains: 'See who is represented in a product decision.' },
    { route: 'operator-customer-detail', path: `/app/customers/${routeFixtures.account}`, contains: longCustomerText },
    { route: 'operator-customer-missing', path: '/app/customers/no-such-account', contains: 'Account not found' },
    { route: 'operator-data', path: '/app/data', contains: 'Workspace data' },
    { route: 'operator-settings', path: '/app/settings', contains: 'Requester email delivery' },
  ]
  for (const item of routes) await visit(page, width, { ...item, auth: 'operator-session' })
}

async function checkPublicRoutes(page, width, requesterEmail) {
  const routes = [
    { route: 'public-root', path: '/', expectPage: assertLanding },
    { route: 'public-feedback-home', path: '/portal/feedback', contains: 'What should we improve?' },
    { route: 'public-feedback-filtered', path: '/portal/feedback?sort=votes&status=shipped&board=enterprise-identity&q=SCIM', contains: 'Search feedback' },
    { route: 'public-roadmap', path: '/portal/roadmap', contains: "What we're working toward" },
    { route: 'public-roadmap-detail', path: `/portal/roadmap/${routeFixtures.publicRoadmapSlug}`, contains: longCustomerText },
    { route: 'public-roadmap-missing', path: '/portal/roadmap/no-such-roadmap', status:404, contains:'This public record is not available.' },
    { route: 'public-roadmap-trailing-slash', path: '/portal/roadmap/', finalPath: '/portal/roadmap', contains: "What we're working toward" },
    { route: 'public-updates', path: '/portal/updates', contains: 'Product updates' },
    { route: 'public-updates-index', path: '/portal/updates/', finalPath: '/portal/updates', contains: 'Product updates' },
    { route: 'public-update-detail', path: `/portal/updates/${routeFixtures.release}`, contains: longCustomerText },
    { route: 'public-update-missing', path: '/portal/updates/no-such-release', status: 404, contains: 'This public record is not available.' },
    { route: 'public-feedback-detail', path: `/portal/feedback/${routeFixtures.request}`, contains: longCustomerText },
    { route: 'public-feedback-withdrawn', path: `/portal/feedback/${routeFixtures.withdrawnRequest}`, status: 410, contains: 'This feedback has been withdrawn.' },
    { route: 'public-feedback-missing', path: '/portal/feedback/no-such-feedback', status: 404, contains: 'This public record is not available.' },
    { route: 'public-submit', path: '/portal/feedback/new', contains: 'Submit feedback' },
    { route: 'public-unknown-route', path: '/portal/no-such-page', status: 404, contains: 'That page does not exist.' },
    { route: 'worker-not-found', path: '/no-such-page', status: 404, contains: 'That page does not exist.' },
    { route: 'public-docs', path: '/docs', contains: 'Overview' },
    { route: 'public-docs-index', path: '/docs/', finalPath: '/docs', contains: 'Overview' },
    { route: 'public-docs-page', path: `/docs/${docsSampleSlug}`, contains: 'Install and deploy' },
    { route: 'public-docs-missing', path: '/docs/no-such-page', status: 404, contains: 'That page does not exist.' },
  ]
  for (const item of routes) await visit(page, width, { ...item, auth: 'public' })

  await visit(page, width, { route: 'requester-verify-invalid-link', path: `/portal/verify#token=${'A'.repeat(43)}`, auth: 'anonymous', contains: 'Verify your email' })
  expectFailure('/api/public/identity/email/verify',401)
  const invalidVerification = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/public/identity/email/verify')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  const invalidVerificationResponse = await invalidVerification
  assert.equal(invalidVerificationResponse.status(), 401, 'Invalid requester verification token did not return 401.')
  await page.getByText('This link has expired or has already been used. Request a new link.', { exact: true }).waitFor()
  await capture(page, 'requester-verify-invalid-result', page.url(), 200, 'anonymous', width)
  checks.push({ route: 'requester-verify-invalid-result', requestedUrl: safeUrl(page.url()), finalUrl: safeUrl(page.url()), status: 200, auth: 'anonymous', contains: 'This link has expired or has already been used. Request a new link.' })
  checks.push({ route: 'requester-verify-invalid-api', requestedUrl: `${origin}/api/public/identity/email/verify`, finalUrl: `${origin}/api/public/identity/email/verify`, status: 401, auth: 'anonymous', contains: 'invalid_magic_link' })

  const aliases = [
    { route: 'portal-alias', path: '/portal', finalPath: '/' },
    { route: 'portal-trailing-slash', path: '/portal/', finalPath: '/' },
    { route: 'feedback-alias', path: '/portal/feedback', finalPath: '/portal/feedback' },
    { route: 'feedback-trailing-slash', path: '/portal/feedback/', finalPath: '/portal/feedback' },
  ]
  for (const item of aliases) await visit(page, width, { ...item, auth: 'public', contains: 'What should we improve?' })

  const email = requesterEmail
  const issued = await api('/api/public/identity/email', { email, displayName: `Route reviewer ${width}` })
  assert.equal(issued.status, 202, `Requester verification issuance returned ${issued.status}`)
  checks.push({ route: 'requester-verification-issued', requestedUrl: `${origin}/api/public/identity/email`, finalUrl: `${origin}/api/public/identity/email`, status: issued.status, auth: 'anonymous', contains: 'accepted' })
  const verificationLink = latestLink(email)
  await visit(page, width, { route: 'requester-verify-link', path: verificationLink, finalPath: '/portal/verify', auth: 'unverified-requester', contains: 'Verify your email' })
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await page.getByText('Email verified.', { exact: true }).waitFor()
  assert.ok(await page.evaluate(() => localStorage.getItem('penny_requester_session')))
  await capture(page, 'requester-verify-complete', page.url(), 200, 'requester-session', width)
  checks.push({ route: 'requester-verify-complete', requestedUrl: safeUrl(page.url()), finalUrl: safeUrl(page.url()), status: 200, auth: 'requester-session', contains: 'Email verified.' })

  await page.goto(`${origin}/portal/feedback/new`, { waitUntil: 'load' })
  await page.getByLabel('Title', { exact: true }).waitFor()
  const requestTitle = `Route ${width} ${longCustomerText.slice(0, 120)}`
  await page.getByLabel('Title', { exact: true }).fill(requestTitle)
  await page.getByLabel('Problem description', { exact: true }).fill(`A route review submission used to check requester activity at ${width}px. Customer reference ${longCustomerText}.`)
  await page.locator('select[name=board]').selectOption(routeFixtures.board)
  await page.getByRole('button', { name: 'Send for review', exact: true }).click()
  await page.getByRole('heading', { name: 'Feedback is awaiting review', exact: true }).waitFor()
  await capture(page, 'requester-submission-held', page.url(), 200, 'requester-session', width)
  checks.push({ route: 'requester-submission-held', requestedUrl: safeUrl(page.url()), finalUrl: safeUrl(page.url()), status: 200, auth: 'requester-session', contains: 'Feedback is awaiting review' })

  await visit(page, width, { route: 'requester-activity', path: '/portal/feedback/activity', auth: 'requester-session', contains: requestTitle })

  const unsubscribeLink = await createUnsubscribeLink(runtime.db, origin, requesterEmail, routeFixtures.request)
  await visit(page, width, { route: 'requester-unsubscribe-confirmation', path: unsubscribeLink, finalPath: '/api/public/notifications/unsubscribe', auth: 'signed-unsubscribe-link', contains: 'Stop updates for this request' })
  const unsubscribeDocumentOrigin = await page.evaluate(() => location.origin)
  const [unsubscribeResponse] = await Promise.all([
    page.waitForNavigation(),
    page.getByRole('button', { name: 'Unsubscribe', exact: true }).click(),
  ])
  const unsubscribeResponseBody = await unsubscribeResponse?.text()
  const unsubscribeRequest = unsubscribeResponse?.request()
  const unsubscribeOrigin = await unsubscribeRequest?.headerValue('origin')
  const unsubscribeFetchSite = await unsubscribeRequest?.headerValue('sec-fetch-site')
  if (unsubscribeResponse?.status() !== 200) {
    await writeFile(join(output, 'unsubscribe-form-failure.json'), `${JSON.stringify({ route: 'requester-unsubscribe-form-submit', requestedUrl: safeUrl(unsubscribeResponse?.url() ?? unsubscribeLink), status: unsubscribeResponse?.status() ?? 0, auth: 'signed-unsubscribe-link', documentOrigin: unsubscribeDocumentOrigin, origin: unsubscribeOrigin ?? null, secFetchSite: unsubscribeFetchSite ?? null, body: unsubscribeResponseBody }, null, 2)}\n`)
  }
  assert.equal(unsubscribeResponse?.status(), 200, `Valid requester unsubscribe did not return its confirmation page: ${unsubscribeResponse?.status()} ${safeUrl(unsubscribeResponse?.url() ?? unsubscribeLink)} document-origin=${unsubscribeDocumentOrigin} origin=${unsubscribeOrigin ?? 'none'} sec-fetch-site=${unsubscribeFetchSite ?? 'none'} body=${unsubscribeResponseBody}`)
  await page.getByRole('heading', { name: 'Unsubscribed', exact: true }).waitFor()
  const mute = await runtime.db.prepare(`
    SELECT m.request_id AS requestId
    FROM request_notification_mutes m
    JOIN requester_addresses a ON a.requester_id=m.requester_id
    JOIN requests r ON r.id=m.request_id
    WHERE a.email=? AND r.slug=?
  `).bind(requesterEmail, routeFixtures.request).first()
  assert.ok(mute, 'Unsubscribe confirmation did not mute the followed request in D1.')
  await capture(page, 'requester-unsubscribe-applied', unsubscribeLink, unsubscribeResponse.status(), 'signed-unsubscribe-link', width)
  checks.push({ route: 'requester-unsubscribe-applied', requestedUrl: safeUrl(unsubscribeLink), finalUrl: safeUrl(page.url()), status: unsubscribeResponse.status(), auth: 'signed-unsubscribe-link', contains: 'Email updates for this request are muted.' })

  await visit(page, width, { route: 'requester-unsubscribe-invalid', path: '/api/public/notifications/unsubscribe?token=invalid', auth: 'anonymous', status: 400, contains: 'This email preference link is invalid or expired.' })
  if (!deliveryFixturesSeeded) {
    await seedDeliveryReviewStates(runtime.db, requesterEmail, routeFixtures.request)
    deliveryFixturesSeeded = true
  }
  return { requestTitle }
}

function routeSamplePath(routePath) {
  const samples = {
    accountSlug: routeFixtures.account,
    decisionSlug: routeFixtures.decision,
    releaseSlug: routeFixtures.release,
    requestSlug: routeFixtures.request,
    roadmapSlug: routeFixtures.publicRoadmapSlug,
    slug: docsSampleSlug,
  }
  return routePath.replace(/\$([A-Za-z0-9_]+)/g, (match, name) => {
    assert.ok(samples[name], `No route-review fixture is configured for ${match}.`)
    return samples[name]
  })
}

async function assertMountedRouteCoverage() {
  const routeFiles = (await readdir('src/routes')).filter((file) => file.endsWith('.tsx'))
  const declarations = []
  for (const file of routeFiles) {
    const source = await readFile(join('src/routes', file), 'utf8')
    const paths = file === '__root.tsx'
      ? source.includes('createRootRoute(') ? ['/'] : []
      : [...source.matchAll(/createFileRoute\(['"]([^'"]+)['"]\)/g)].map((match) => match[1])
    assert.equal(paths.length, 1, `${file} should declare exactly one file route.`)
    declarations.push({ file, path: paths[0] })
  }
  const inventory = declarations.map(({ file, path }) => ({
    file,
    sourcePath: path,
    requestedPath: requestedPaths.includes(routeSamplePath(path)) ? routeSamplePath(path) : null,
  }))
  const uncovered = inventory.filter(({ requestedPath }) => requestedPath === null)
  assert.deepEqual(uncovered, [], `Mounted source routes without a direct route check: ${JSON.stringify(uncovered)}`)
  checks.push({ route: 'mounted-route-inventory', requestedUrl: 'src/routes/*.tsx', finalUrl: 'src/routes/*.tsx', status: 200, auth: 'source-inventory', contains: `${declarations.length} declared routes covered` })
  return inventory
}

async function checkEmptyRoutes() {
 reviewState='empty'
 for(const table of ['boards','requests','evidence_items','decisions','roadmap_items','releases','requesters'])assert.equal((await runtime.db.prepare(`SELECT count(*) n FROM ${table}`).first()).n,0,'[E.2/G.2] native empty D1 fixture has no business data')
 const routeFiles=(await readdir('src/routes')).filter(f=>f.endsWith('.tsx')&&f!=='__root.tsx')
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}})
  try {
   const page=await context.newPage();watch(page)
   await authenticateOperator(page,context,width)
   for(const file of routeFiles) {
    const source=await readFile(join('src/routes',file),'utf8'),declaration=source.match(/createFileRoute\(['"]([^'"]+)['"]\)/)[1]
    let path=declaration.replace(/\$[A-Za-z0-9_]+/g,'no-such-record')
    if(path.endsWith('/')&&path!=='/')path=path.slice(0,-1)
    if(path==='/portal')path='/'
    const isMissing=declaration.includes('$'),isPublic=path.startsWith('/portal/')||path.startsWith('/docs/'),status=isMissing&&isPublic?404:200
    if(path==='/signin') {await visit(page,width,{route:'empty-signin-existing-session',path,status:200,contains:'You are already signed in.',auth:'operator-session'});continue}
    await visit(page,width,{route:'empty-'+file.replace('.tsx',''),path,status,auth:path.startsWith('/app')?'operator-session':'public'})
   }
   await visit(page,width,{route:'empty-roadmap-active',path:'/app/roadmap?active=true',contains:'No active delivery items.',auth:'operator-session'})
   await visit(page,width,{route:'empty-updates-explicit',path:'/portal/updates',contains:'There are no updates yet.',auth:'public'})
   assert.equal(await page.locator('article').count(),0,'[REL-010] empty updates contains no draft or sample entry')
   await visit(page,width,{route:'empty-decision-create-form',path:'/app/decisions',contains:'No decisions have been recorded.',auth:'operator-session'})
   await page.getByText('Create decision',{exact:true}).first().click()
   assert.equal(await page.getByRole('form',{name:'New decision',exact:true}).count(),1,'[DEC-001] empty decision editor is reachable')
   await capture(page,'empty-decision-editor',page.url(),200,'operator-session',width)
   await visit(page,width,{route:'empty-record-evidence-form',path:'/app/feedback',contains:'Record evidence',auth:'operator-session'})
   assert.equal(await page.getByRole('form',{name:'New evidence',exact:true}).count(),1,'[EVID-001] empty evidence recorder is reachable')
  } finally {await context.close()}
 }
}

async function authenticateOperator(page, context, width) {
  const email = 'owner@penny.invalid'
  await visit(page, width, { route: 'operator-signin', path: '/signin', auth: 'anonymous', contains: 'Sign in to Penny' })
  await page.getByLabel('Operator email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send sign-in link', exact: true }).click()
  await page.getByText('If your address is allowed, check your email for a sign-in link.', { exact: true }).waitFor()
  await capture(page, 'operator-signin-requested', page.url(), 200, 'anonymous', width)
  checks.push({ route: 'operator-signin-requested', requestedUrl: safeUrl(page.url()), finalUrl: safeUrl(page.url()), status: 200, auth: 'anonymous', contains: 'If your address is allowed, check your email for a sign-in link.' })

  const confirmationLink = latestLink(email)
  await visit(page, width, { route: 'base-confirm-signin', path: confirmationLink, finalPath: '/auth/confirm', auth: 'sign-in-link', contains: 'Confirm sign-in' })
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.waitForURL((url) => ['/setup', '/app', '/app/'].includes(url.pathname))
  await finishFirstRun(page, async () => {})
  await page.waitForURL((url) => url.pathname === '/app' || url.pathname === '/app/')
  assert.match(await page.locator('body').innerText(), /Make the next roadmap call defensible\./)
  await capture(page, 'operator-confirmed', page.url(), 200, 'operator-session', width)
  checks.push({ route: 'operator-confirmed', requestedUrl: safeUrl(page.url()), finalUrl: safeUrl(page.url()), status: 200, auth: 'operator-session', contains: 'Make the next roadmap call defensible.' })
  const cookies = await context.cookies(origin)
  assert.ok(cookies.some((cookie) => cookie.name.startsWith('operator_session')), 'Base confirmation did not create an operator session cookie.')
  return cookieHeader(cookies)
}

try {
  await access(browserPath).catch(() => { throw new Error(`Headless Chrome is missing at ${browserPath}.`) })
  const bootstrap = await api('/auth/bootstrap', { token: 'synthetic-base-browser-setup-token-12345', displayName: 'Route Review Owner', returnTo: '/app' })
  assert.equal(bootstrap.status, 303, `Base operator bootstrap returned ${bootstrap.status}.`)
  assert.equal(new URL(bootstrap.headers.get('location'), origin).pathname, '/app', 'Base operator bootstrap returned to an unexpected route.')
  checks.push({ route: 'operator-bootstrap', requestedUrl: `${origin}/auth/bootstrap`, finalUrl: `${origin}/app`, status: bootstrap.status, auth: 'setup-token', contains: 'active Base operator created' })
  browser = await chromium.launch(browserOptions())

  await checkEmptyRoutes()
  await seedRouteReviewDatabase(runtime.db)
  reviewState='populated'
  for (const width of [1440, 390]) {
    const operatorContext = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const publicContext = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const anonymousContext = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } })
    const operatorPage = await operatorContext.newPage()
    const publicPage = await publicContext.newPage()
    const anonymousPage = await anonymousContext.newPage()
    for(const page of [operatorPage,publicPage,anonymousPage])watch(page)

    await visit(anonymousPage, width, { route: 'requester-activity-anonymous', path: '/portal/feedback/activity', auth: 'anonymous', contains: 'Verify your email to see your feedback.' })

    await visit(operatorPage, width, { route: 'operator-protected-redirect', path: '/app/moderation', finalPath: '/signin', auth: 'anonymous', contains: 'Sign in to Penny' })
    const cookie = await authenticateOperator(operatorPage, operatorContext, width)
    await visit(operatorPage, width, { route: 'operator-signin-existing-session', path: '/signin', auth: 'operator-session', contains: 'You are already signed in.' })

    const requesterEmail = `route-review-${width}-${Date.now().toString(36)}@example.test`
    const { requestTitle } = await checkPublicRoutes(publicPage, width, requesterEmail)

    const unauthenticatedNotifications = await api('/api/operator/notifications')
    assert.equal(unauthenticatedNotifications.status, 401, 'Operator delivery data was readable without a session.')
    checks.push({ route: 'operator-notifications-unauthenticated', requestedUrl: `${origin}/api/operator/notifications`, finalUrl: `${origin}/api/operator/notifications`, status: 401, auth: 'anonymous', contains: null })
    const authenticatedNotifications = await api('/api/operator/notifications', undefined, { Cookie: cookie })
    assert.equal(authenticatedNotifications.status, 200, 'Authenticated operator could not read delivery review data.')
    const notificationBody = await authenticatedNotifications.json()
    assert.ok(Array.isArray(notificationBody.deliveries), 'Delivery review response has no deliveries list.')
    const deliveryStates = new Set(notificationBody.deliveries.map((delivery) => delivery.state))
    for (const state of ['queued', 'accepted', 'failed', 'unknown']) assert.ok(deliveryStates.has(state), `Delivery review endpoint omitted the ${state} state.`)
    checks.push({ route: 'operator-notifications-authenticated', requestedUrl: `${origin}/api/operator/notifications`, finalUrl: `${origin}/api/operator/notifications`, status: 200, auth: 'operator-session', contains: 'queued, accepted, failed, and unknown delivery records' })

    await checkOperatorRoutes(operatorPage, width)
    await operatorPage.getByRole('heading', { name: 'Acceptance not confirmed', exact: true }).waitFor()
    await operatorPage.getByRole('heading', { name: 'Message failed', exact: true }).waitFor()
    await operatorPage.getByText('This message could not be sent. Check the email configuration and provider records before deciding what to do.', { exact: true }).waitFor()
    await operatorPage.getByText(longProviderReceiptId, { exact: true }).waitFor()
    assert.equal(await operatorPage.getByText('retry_window_exhausted', { exact: true }).count(), 0, 'Delivery review must not expose internal failure codes.')
    assert.equal(await operatorPage.getByRole('heading', { name: 'Acceptance not confirmed', exact: true }).count(), 1, 'Unknown delivery state should be displayed once.')
    assert.equal(await operatorPage.getByRole('heading', { name: 'Message failed', exact: true }).count(), 1, 'Failed delivery state should be displayed once.')
    assert.equal(await operatorPage.getByRole('button', { name: /retry|send again/i }).count(), 0, 'Delivery review must not offer a blind retry action.')
    await capture(operatorPage, 'operator-settings-delivery-review', `${origin}/app/settings`, 200, 'operator-session', width)
    checks.push({ route: 'operator-settings-delivery-review', requestedUrl: `${origin}/app/settings`, finalUrl: safeUrl(operatorPage.url()), status: 200, auth: 'operator-session', contains: 'unknown and failed delivery details with no retry action' })
    await visit(operatorPage, width, { route: 'operator-moderation-populated', path: '/app/moderation', auth: 'operator-session', contains: requestTitle })
    await visit(operatorPage,width,{route:'populated-record-evidence-form',path:'/app/feedback',auth:'operator-session',contains:'Record evidence'})
    assert.equal(await operatorPage.getByRole('form',{name:'New evidence',exact:true}).count(),1,'[EVID-001] populated evidence recording form reachable')
    await visit(operatorPage,width,{route:'populated-create-decision-form',path:'/app/decisions',auth:'operator-session',contains:'Create decision'})
    await operatorPage.getByText('Create decision',{exact:true}).first().click()
    await capture(operatorPage,'populated-decision-editor',operatorPage.url(),200,'operator-session',width)
    assert.equal(await operatorPage.getByRole('form',{name:'New decision',exact:true}).count(),1,'[DEC-001] populated decision form reachable')
    await visit(operatorPage,width,{route:'populated-roadmap-editor',path:'/app/roadmap',auth:'operator-session',contains:'Edit, approve or move'})
    await operatorPage.getByText('Edit, approve or move',{exact:true}).first().click()
    for(const title of ['Edit internal record','Approve public projection','Move roadmap item'])await operatorPage.getByRole('form',{name:title,exact:true}).first().waitFor()
    await capture(operatorPage,'populated-roadmap-editor-expanded',operatorPage.url(),200,'operator-session',width)

    await operatorContext.close()
    await publicContext.close()
    await anonymousContext.close()
  }

  const mountedRoutes = await assertMountedRouteCoverage()
  const canonicalPath=path=>path.replace(/\/$/,'')==='/portal'?'/':path.replace(/\/$/,'')==='/portal/feedback'?'/portal/feedback':path==='/'?'/':path.replace(/\/$/,'')
  const stateCoverage=mountedRoutes.map(({sourcePath,file})=>({file,sourcePath,states:['empty','populated'].map(state=>{
    const expected=canonicalPath(state==='empty'?sourcePath.replace(/\$[A-Za-z0-9_]+/g,'no-such-record'):routeSamplePath(sourcePath))
    const widths=[1440,390].filter(width=>captures.some(c=>c.state===state&&c.viewport.width===width&&canonicalPath(new URL(c.requestedUrl).pathname)===expected))
    assert.deepEqual(widths,[1440,390],`[E.2] ${sourcePath} reviewed in ${state} at both widths`)
    return {state,widths,expectedPath:expected}
  })}))

  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
  const manifest = {
    sourceCommit,
    dirty: Boolean(dirty),
    generatedAt: new Date().toISOString(),
    runtime: 'Exact emitted production Start Worker modules in workerd; D1 migrations and Penny sample data seeded inside this browser test; local Base mail sent only to a test HTTP fixture; no hosted delivery claim.',
    browser: browserPath,
    viewports: [1440, 390],
    mountedRoutes, stateCoverage,
    captures,
    pageErrors, consoleErrors, externalRequests, expectedDiagnostics,
    layoutFailures,
    developmentCopyFailures,
    accessibilityFailures,
    checks,
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(output, 'runtime.log'), `Captured ${captures.length} pages at 1440px and 390px.\nChecked ${checks.length} route and auth states.\nPage errors: ${pageErrors.length}.\nLayout failures: ${layoutFailures.length}.\nDevelopment-copy failures: ${developmentCopyFailures.length}.\n`)
  await writeFile(join(output, 'axe.json'), JSON.stringify(accessibilityFailures,null,2))
  assert.deepEqual(accessibilityFailures, [], '[BASE-PUBLIC-003] all public and operator route captures pass WCAG AA axe checks')
  assert.ok(captures.filter(c=>c.state==='populated').length>=116,'[BASE-PUBLIC-003] retain original 116 populated captures')
  assert.ok(checks.length>=126,'[BASE-PUBLIC-003] retain original 126 checks plus expansion')
  assert.deepEqual(consoleErrors,[],'[E.2] no unexpected console errors')
  assert.deepEqual(externalRequests,[],'[E.2] no external browser requests')
  assert.deepEqual(pageErrors, [], `Browser page errors were reported: ${JSON.stringify(pageErrors)}`)
  assert.deepEqual(layoutFailures, [], `Responsive layout failures were retained: ${JSON.stringify(layoutFailures)}`)
  assert.deepEqual(developmentCopyFailures, [], `User-visible development copy was retained: ${JSON.stringify(developmentCopyFailures)}`)
  console.log(`Route review passed: ${captures.length} screenshots, ${checks.length} route/auth checks, no page errors or horizontal overflow.`)
  console.log(`Evidence: ${output}`)
} finally {
  await browser?.close()
  await runtime.close()
}
