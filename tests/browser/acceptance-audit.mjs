import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'

export const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }]
export const prohibitedCopy = /not available in this build|not available here|not available on this page|in this milestone|local review/i
export function safePath(value) { const url = new URL(value); return url.pathname }
export function evidenceDirectory(name) {
  const repo = resolve(process.cwd()), workRoot = resolve(process.env.PENNY_WORK_ROOT ?? dirname(repo))
  const output = resolve(process.env.PENNY_EVIDENCE ?? join(workRoot, 'evidence', name, new Date().toISOString().replace(/[:.]/g, '-')))
  assert.ok(output.startsWith(join(workRoot, 'evidence') + sep), 'Evidence must be under work-root/evidence')
  assert.ok(!output.startsWith(repo + sep), 'Evidence must stay outside the product repository')
  return output
}
export async function createAudit(context, origin, output, viewport, {expectedHttpError,expectedHttpErrors=[]} = {}) {
  await mkdir(output, { recursive: true })
  const require = createRequire(import.meta.url)
  const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8')
  const errors = [], external = [], captures = [], expectedNetworkDiagnostics = []
  const expectedResponses = new Set()
  const auxiliaryResponses = new Map(), auxiliaryDiagnostics = new Map()
  const auxiliaryExpected = value => {
    const url=new URL(value)
    return expectedHttpErrors.find(item=>url.origin===origin&&url.pathname+url.search===item.path)
  }
  context.on('page', page => {
    page.on('pageerror', error => errors.push({ path: safePath(page.url()), kind: 'pageerror', text: String(error.message).slice(0, 300) }))
    page.on('response', response => {
      if (expectedHttpError && response.url()===expectedHttpError.url && response.status()===expectedHttpError.status && response.request().isNavigationRequest()) expectedResponses.add(response.url())
      const expected=auxiliaryExpected(response.url())
      if(expected&&response.status()>=400){
        if(response.status()===expected.status&&response.request().method()==='GET'&&!response.request().isNavigationRequest())auxiliaryResponses.set(expected.path,(auxiliaryResponses.get(expected.path)??0)+1)
        else errors.push({path:expected.path,kind:'unexpected HTTP rejection',status:response.status(),method:response.request().method(),navigation:response.request().isNavigationRequest()})
      }
    })
    page.on('console', message => {
      if(message.type()!=='error')return
      const location=message.location()
      if(expectedHttpError && location.url===expectedHttpError.url && expectedResponses.has(location.url) && message.text()===`Failed to load resource: the server responded with a status of ${expectedHttpError.status} (Bad Request)`) {
        expectedNetworkDiagnostics.push({path:safePath(location.url),status:expectedHttpError.status,kind:'expected document HTTP rejection'})
      } else {
        const expected=location.url?auxiliaryExpected(location.url):undefined
        const reason=expected?.status===500?'Internal Server Error':expected?.status===401?'Unauthorized':undefined
        if(expected&&reason&&(auxiliaryDiagnostics.get(expected.path)??0)<(auxiliaryResponses.get(expected.path)??0)&&message.text()===`Failed to load resource: the server responded with a status of ${expected.status} (${reason})`){
          auxiliaryDiagnostics.set(expected.path,(auxiliaryDiagnostics.get(expected.path)??0)+1)
          expectedNetworkDiagnostics.push({path:expected.path,status:expected.status,kind:'expected auxiliary GET rejection'})
        }else errors.push({path:safePath(page.url()),kind:'console.error',text:message.text().slice(0,300),source:location.url?safePath(location.url):''})
      }
    })
  })
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin && ['http:', 'https:'].includes(url.protocol)) { external.push({ origin: url.origin, path: url.pathname }); await route.abort() }
    else await route.continue()
  })
  async function audit(page, label, { axeZero = false, redact = false, viewport: actualViewport = viewport } = {}) {
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) })
    assert.equal(prohibitedCopy.test(await page.locator('body').innerText()), false, `[E.2] ${label}: prohibited build copy`)
    const layout = await page.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: innerWidth }))
    assert.ok(layout.html <= layout.viewport && layout.body <= layout.viewport, `[E.1] ${label}: horizontal overflow ${JSON.stringify(layout)}`)
    await page.evaluate(axeSource)
    const violations = await page.evaluate(async () => (await window.axe.run(document)).violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => node.target) })))
    assert.deepEqual(axeZero ? violations : violations.filter(v => ['serious', 'critical'].includes(v.impact)), [], `[${axeZero ? 'G.6/H.2' : 'E.1'}] ${label}: axe violations`)
    // Outbox detail/confirm tokens are necessary in the UI but never in screenshots.
    const sensitive = redact ? page.locator('pre:visible, a[href*="token="]:visible, a[href*="#token"]:visible, input[name=token]:visible') : undefined
    const file = `${label.replace(/[^a-z0-9_-]/gi, '-')}-${actualViewport.width}.png`
    const bytes = await page.screenshot({ path: join(output, file), fullPage: true, ...(sensitive ? { mask: [sensitive] } : {}) })
    captures.push({ label, path: safePath(page.url()), viewport: actualViewport, file, sha256: createHash('sha256').update(bytes).digest('hex'), violations, layout })
  }
  async function finish(name, extra = {}) {
    await writeFile(join(output, `${name}-${viewport.width}.json`), JSON.stringify({ ...extra, captures, errors, external, expectedNetworkDiagnostics }, null, 2) + '\n')
    assert.deepEqual(errors, [], '[E.1/G.6/H.2] No application console errors, page errors or unexpected diagnostics')
    if(expectedHttpError) assert.equal(expectedResponses.has(expectedHttpError.url),true,'[H.2] exact negative document returned its expected HTTP status')
    else if(!expectedHttpErrors.length)assert.deepEqual(expectedNetworkDiagnostics,[],'[G.6] successful journey permits no console diagnostic exceptions')
    for(const expected of expectedHttpErrors){
      const responses=auxiliaryResponses.get(expected.path)??0
      if(expected.count!==undefined)assert.equal(responses,expected.count,'[BASE-OPS-004] exact count of deliberately failed auxiliary GETs')
      else assert.ok(responses>=expected.minCount&&responses<=expected.maxCount,'[BASE-OPS-004] bounded deliberately failed mount GETs, allowing an aborted development replay')
      assert.ok((auxiliaryDiagnostics.get(expected.path)??0)<=responses,'[BASE-OPS-004] no negative HTTP diagnostic without its exact rejected auxiliary GET')
    }
    assert.deepEqual(external, [], '[E.1/G.6] No external browser requests')
  }
  return { audit, finish, captures }
}
