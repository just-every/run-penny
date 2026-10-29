import {checkEmptyOverview,checkPopulatedOverview} from './operator-overview-checks.mjs'
import {reviewRedaction} from './redaction-journey.mjs'
import {reviewRequesterOAuth} from './requester-oauth-journey.mjs'
import {requesterOAuthBindings,requesterOAuthEdge} from './requester-oauth-edge.mjs'
import {reviewEmailCapture} from './email-capture-journey.mjs'
import { reviewOperatorCompleteness,reviewOperatorFields } from './operator-completeness.mjs'
import {pacePublicContext,pacePublicPhase} from './public-entry-pacing.mjs'
import { localProofBindings } from './operator-completeness-auth.mjs'
import { reviewClauseStates } from './operator-pages-clause-states.mjs'
import { browserOptions } from './browser-options.mjs'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { startBrowserRuntime } from './base-runtime.mjs'
import { reviewStatusDrafts } from './operator-pages-status.mjs'
import { reviewDecisionPages } from './operator-pages-decisions.mjs'
import { seedOverviewAttention, duplicateOverviewAttention, seedLoopHealth, clearLoopHealth, loopHealthProof } from './operator-pages-data.mjs'
import { prepareHostedDataReview, reviewHostedData } from './operator-pages-hosted-data.mjs'
import { finishFirstRun } from './local-signin.mjs'
process.env.PENNY_BROWSER_EXECUTABLE ??= chromium.executablePath()
// REQ-014, REQ-018: moderation and settings forms wear the operator kit's own card and label, whatever those classes are.
const { fieldLabelClass, paperCardClass } = await import('../../src/core/ui/app/classes.ts')

const output = resolve(process.env.PENNY_EVIDENCE ?? '../evidence/decision-loop-resume')
assert.ok(!output.startsWith(resolve('.') + '/'), 'Screenshots must stay outside the repository')
await mkdir(output, { recursive: true })
const axe = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const checks = [], negativeChecks = []
const captureOnly=process.env.PENNY_CAPTURE_ONLY==='1'
const oauthOnly=process.env.PENNY_OAUTH_ONLY==='1'
const redactionOnly=process.env.PENNY_REDACTION_ONLY==='1'
const focusedOnly=captureOnly||oauthOnly||redactionOnly
const coreOnly=process.env.PENNY_OPERATOR_CORE_ONLY==='1'
const loopHealthOnly=process.env.PENNY_LOOP_HEALTH_ONLY==='1'
const fieldsOnly=process.env.PENNY_OPERATOR_FIELDS_ONLY==='1'
const completenessOnly=!loopHealthOnly&&(fieldsOnly||process.env.PENNY_OPERATOR_COMPLETENESS_ONLY==='1')
let browser, hosted
// Only paths enter diagnostics: sign-in and development URLs can carry secrets
// in their query or fragment. Never log request headers, cookies or URL values.
function diagnosticPath(value) {
  try { return new URL(value).pathname }
  catch { return '[no URL]' }
}
function diagnosticMessage(value) {
  return value.replace(/https?:\/\/[^\s)]+/g,diagnosticPath)
}
function sanitizeDiagnosticError(error) {
  if(!error||typeof error!=='object')return
  if(typeof error.message==='string')error.message=diagnosticMessage(error.message)
  if(typeof error.stack==='string')error.stack=diagnosticMessage(error.stack)
  if(Array.isArray(error.log))error.log=error.log.map(value=>typeof value==='string'?diagnosticMessage(value):value)
  if(Array.isArray(error.errors))error.errors.forEach(sanitizeDiagnosticError)
}
async function capturePage(width,label,targetPage,details={}) {
  await targetPage.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
  assert.equal(await targetPage.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,`[OPS-003] ${label} overflow at ${width}`)
  await targetPage.evaluate(axe)
  const violations=await targetPage.evaluate(async()=>(await window.axe.run(document)).violations.filter(row=>['serious','critical'].includes(row.impact)))
  assert.deepEqual(violations,[],`[BASE-UX-001] ${label} axe at ${width}`)
  assert.doesNotMatch(await targetPage.locator('body').innerText(),/not available in this build|not available here|not available on this page|in this milestone|Local review/i)
  await targetPage.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true})
  checks.push({label,width,phase:label.startsWith('negative-')?'negative':'positive',...details})
}
async function reviewLoopHealth({page,db,goto,capture}) {
  const read=path=>page.request.get(new URL(path,page.url()).href)
  assert.equal((await fetch(new URL('/api/operator/loop-health?metric=ownership',page.url()))).status,401,'[MEAS-006] loop records require operator authority')
  assert.equal((await read('/api/operator/loop-health?metric=unknown')).status(),400,'[MEAS-006] unknown cohorts are refused')
  assert.equal((await read('/api/operator/loop-health?metric=ownership&page=0')).status(),400,'[MEAS-006] invalid pages are refused')
  await seedLoopHealth(db)
  try {
    await goto('/app/overview')
    const response=await read('/api/operator/overview')
    assert.equal(response.status(),200,'[MEAS-006] overview exposes loop-health figures')
    assert.deepEqual((await response.json()).loopHealth,loopHealthProof.summary,'[MEAS-006] hand-counted current ownership, first-response median, delivered notifications and distinct promise risks')
    const figures=page.locator('[aria-labelledby="overview-loop-health"] > ul > li')
    assert.equal(await figures.count(),4,'[MEAS-006] overview has four actionable loop-health figures')
    await capture('loop-health-overview')
    for(const [metric,title,value] of [
      ['ownership','Requests with an owner','60%'],
      ['response','Time to first public response','3 hours'],
      ['notified','Shipped requests notified','33.3%'],
      ['promises','Promises at risk','2'],
    ]) {
      const link=page.getByRole('link',{name:title,exact:true})
      assert.equal(await link.locator('article > p').first().innerText(),value,`[MEAS-006] ${metric} figure equals hand count`)
      const href=await link.getAttribute('href')
      assert.equal(new URL(href,page.url()).hash,`#loop-health-${metric}`,'[MEAS-006] figure opens its own record list')
      const recordsResponse=await read(`/api/operator/loop-health?metric=${metric}&page=1`)
      assert.equal(recordsResponse.status(),200,`[MEAS-006] ${metric} drilldown is a real operator read`)
      const records=await recordsResponse.json(),expected=loopHealthProof.records[metric]
      assert.equal(records.metric,metric)
      assert.equal(records.page,1)
      assert.equal(records.total,expected.length,`[MEAS-006] ${metric} includes exactly the counted population`)
      assert.deepEqual(records.items.map(item=>item.id).sort(),[...expected].sort(),`[MEAS-006] ${metric} excludes held, withdrawn, merged, blocked and non-risk rows`)
      if(metric==='ownership') {
        assert.equal(records.items.filter(item=>item.detail==='Owner: Maya Patel').length,3,'[MEAS-006] ownership drilldown explains the numerator')
        assert.equal(records.items.filter(item=>item.detail==='Unassigned').length,2,'[MEAS-006] unassigned requests remain in the denominator')
      }
      if(metric==='notified') {
        assert.equal(records.items.find(item=>item.id==='loop-health-delivered').detail,'Fully delivered recipient snapshot','[MEAS-006] every recipient was delivered')
        for(const id of ['loop-health-accepted','loop-health-no-snapshot'])
          assert.equal(records.items.find(item=>item.id===id).detail,'No fully delivered recipient snapshot','[MEAS-006] acceptance and missing snapshots are not notification')
      }
      await link.click()
      await page.waitForURL(url=>url.hash===`#loop-health-${metric}`)
      const section=page.locator(`#loop-health-${metric}`)
      await section.getByRole('heading',{name:title,exact:true}).waitFor()
      await section.getByRole('navigation',{name:'Loop health pages'}).waitFor()
      if(page.viewportSize().width===390) {
        const heading=await section.getByRole('heading',{name:title,exact:true}).boundingBox(),header=await page.getByRole('banner').boundingBox()
        assert.ok(heading.y>=header.y+header.height,'[MEAS-006] mobile figure links leave the drilldown heading below the sticky header')
      }
      assert.equal(await section.locator('li').count(),expected.length,`[MEAS-006] ${metric} link renders every counted record once`)
      for(const item of records.items) {
        const row=section.locator('li').filter({has:page.getByRole('link',{name:item.title,exact:true})})
        assert.equal(await row.count(),1)
        assert.equal(await row.getByRole('link',{name:item.title,exact:true}).getAttribute('href'),item.href)
        assert.ok(item.detail.length>0,'[MEAS-006] drilldown explains inclusion or delivery/ownership state')
        assert.ok((await row.innerText()).includes(item.detail),'[MEAS-006] drilldown displays the real record detail')
      }
      await capture(`loop-health-${metric}`)
    }
  } finally { await clearLoopHealth(db) }
  await goto('/app/overview')
  const cleared=await read('/api/operator/overview')
  assert.deepEqual((await cleared.json()).loopHealth,{ownership:{owned:0,total:0,share:0},firstResponse:{medianSeconds:null,responded:0,total:0},notified:{notified:0,total:0,share:0},promises:{atRisk:0}},'[MEAS-006] clearing proof rows restores a truthful empty overview')
  for(const title of ['Requests with an owner','Time to first public response','Shipped requests notified'])
    assert.equal(await page.getByRole('link',{name:title,exact:true}).locator('article > p').first().innerText(),'No data','[MEAS-006] an empty population does not invent a figure')
  assert.equal(await page.getByRole('link',{name:'Promises at risk',exact:true}).locator('article > p').first().innerText(),'0')
  await capture('loop-health-empty')
}
try {
  if(!focusedOnly&&!completenessOnly&&!loopHealthOnly)hosted = await prepareHostedDataReview()
  const options=browserOptions()
  browser = await chromium.launch({...options,args:[...options.args,...(hosted?[hosted.trustArgument]:[])]})
  async function reviewWidth(width) {
    const runtime = await startBrowserRuntime({bindings:{...localProofBindings,...(oauthOnly?requesterOAuthBindings:{})},...(oauthOnly?{networkWorker:requesterOAuthEdge}:{})})
    let context
    try {
      const {origin} = runtime
      const bootstrap = await fetch(origin+'/auth/bootstrap',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'}),redirect:'manual'})
      assert.equal(bootstrap.status,303)
      const pair = bootstrap.headers.get('set-cookie').split(';')[0], split=pair.indexOf('=')
      context = await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane',extraHTTPHeaders:{'CF-Connecting-IP':width===390?'198.51.100.10':'198.51.100.11'}})
      // This small operator-only flow keeps the live limiter and cache; any 429
      // still fails the normal network assertions, without full-journey pauses.
      if(!focusedOnly&&!loopHealthOnly)await pacePublicContext(context,runtime,width===390?'198.51.100.10':'198.51.100.11')
      await context.addCookies([{name:pair.slice(0,split),value:pair.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}])
      const page = await context.newPage(), errors=[], external=[], failedRequests=[]
      let phase='first-run'
      page.on('pageerror',error=>errors.push({width,phase,message:diagnosticMessage(error.message)}))
      page.on('console',message=>{
        if(message.type()!=='error')return
        const diagnostic={width,phase,message:diagnosticMessage(message.text()),path:diagnosticPath(message.location().url)}
        if(oauthOnly&&diagnostic.path==='/api/operator/settings/requester-oauth'&&/status of 409/.test(message.text()))return
        errors.push(diagnostic)
        console.error('operator-pages browser error: '+JSON.stringify(diagnostic))
      })
      page.on('response',response=>{if(response.status()>=400)failedRequests.push({phase,path:diagnosticPath(response.url()),status:response.status(),method:response.request().method()})})
      page.on('requestfailed',request=>failedRequests.push({phase,path:diagnosticPath(request.url()),method:request.method(),failure:request.failure()?.errorText}))
      page.on('request',request=>{if(new URL(request.url()).origin!==origin)external.push(new URL(request.url()).origin)})
      async function capture(label,targetPage=page) {
        phase=label
        await capturePage(width,label,targetPage)
        if(!focusedOnly&&!loopHealthOnly)await pacePublicPhase(targetPage)
      }
      async function goto(path) { phase=diagnosticPath(origin+path);const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.locator('main h1').waitFor() }
      await goto('/setup')
      assert.equal(await finishFirstRun(page,focusedOnly?async()=>{}:(targetPage,label)=>capture(label,targetPage)),true,'[BASE-ACCESS-002] native owner finishes the real first-run form')
      if(redactionOnly){
        await reviewRedaction({page,runtime,goto,capture})
      } else if(oauthOnly){
        await reviewRequesterOAuth({page,browser,runtime,width,goto,capture})
      } else if(captureOnly){
        await reviewEmailCapture({page,runtime,goto,capture})
      } else if(loopHealthOnly) {
        const response=await fetch(origin+'/api/operator/boards',{method:'POST',headers:{Cookie:pair,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Finance workflows',slug:'attention-board',visibility:'public'})})
        assert.equal(response.status,201,'[MEAS-006] create the fixture board through the real operator route')
        await reviewLoopHealth({page,db:runtime.db,goto,capture})
      } else if(!completenessOnly) {
      await goto('/app/overview')
      await page.getByText('Needs you',{exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'Create a board to collect feedback.'}).getAttribute('href'),'/app/settings#create-board')
      assert.equal(await page.locator('[aria-labelledby="overview-attention"] li').count(),0,'[OPS-003] zero attention has no placeholder rows')
      await checkEmptyOverview(page)
      await capture('empty-overview')
      await goto('/app/settings')
      await page.getByText('No boards yet',{exact:true}).waitFor()
      await capture('empty-settings')
      const form = page.locator('form').filter({has:page.getByRole('button',{name:'Create board',exact:true})})
      await form.getByLabel('Name',{exact:true}).fill('Attention board')
      await form.getByLabel('URL name',{exact:true}).fill('attention-board')
      await form.getByRole('button',{name:'Create board',exact:true}).click()
      await page.getByText('URL name: attention-board',{exact:false}).waitFor()
      assert.equal(await form.getByLabel('Name',{exact:true}).inputValue(),'')
      assert.equal(await form.getByLabel('URL name',{exact:true}).inputValue(),'')
      assert.match(await page.getByRole('status').filter({hasText:'Saved.'}).getAttribute('class'),/text-penny-moss/)
      assert.equal(await page.getByRole('link',{name:'Open public board'}).getAttribute('href'),'/portal/feedback?board=attention-board')
      assert.ok((await form.locator('xpath=ancestor::section[1]').getAttribute('class')).includes(paperCardClass),'[REQ-018] settings reuses operator card')
      assert.equal(await form.locator('label').first().getAttribute('class'),fieldLabelClass,'[REQ-018] settings uses operator labels')
      await capture('created-board-settings')
      await goto('/app/overview')
      await page.getByRole('link',{name:'Record evidence to inform your next decision.'}).waitFor()
      await capture('board-overview')
      await reviewLoopHealth({page,db:runtime.db,goto,capture})
      if(!loopHealthOnly) {
      await seedOverviewAttention(runtime.db)
      await goto('/app/overview')
      for(const [name,to] of [['1 request awaiting moderation','/app/moderation'],['1 unreviewed evidence item','/app/feedback'],['1 ready decision','/app/decisions'],['1 unpublished status update','/app/roadmap'],['1 Shipped item without a published release','/app/releases']]) {
        assert.equal(await page.getByRole('link',{name,exact:true}).getAttribute('href'),to,`[DEC-001 EVID-003 ROAD-007 ROAD-008 REL-001 REQ-014] ${name}`)
      }
      await checkPopulatedOverview({page,db:runtime.db,goto,capture})
      await capture('populated-overview')
      await duplicateOverviewAttention(runtime.db)
      await goto('/app/overview')
      for(const name of ['2 requests awaiting moderation','2 unreviewed evidence items','2 ready decisions','2 unpublished status updates','2 Shipped items without a published release'])
        await page.getByRole('link',{name,exact:true}).waitFor()
      await capture('plural-overview')
      await page.getByRole('link',{name:'2 unpublished status updates',exact:true}).click()
      await page.getByRole('heading',{name:'Pending status updates',exact:true}).waitFor()
      await page.getByRole('button',{name:'Publish status update',exact:true}).first().waitFor()
      assert.equal(await page.getByRole('button',{name:'Publish status update',exact:true}).count(),2,'[ROAD-007 ROAD-008] Needs you leads to an actionable publisher')
      await capture('roadmap-status-publisher')
      await goto('/app/overview')
      if(width===390)await page.locator('header summary').click()
      const nav=page.locator('nav[aria-label="Operator workspace"]:visible')
      const icons=await nav.locator('svg path').evaluateAll(paths=>paths.map(path=>path.getAttribute('d')))
      assert.ok(icons.length>0,'[OPS-003] workspace destinations have navigation icons')
      for(const path of ['/app/overview','/app/feedback','/app/moderation','/app/decisions','/app/roadmap','/app/releases','/app/accounts','/app/settings','/app/data','/app/search'])assert.equal(await nav.locator(`a[href="${path}"]`).count(),1,`[OPS-003 OPS-004] navigation reaches ${path}`)
      assert.equal(await nav.getByRole('link',{name:'Overview',exact:true}).getAttribute('aria-current'),'page')
      await nav.getByRole('link',{name:'Feedback settings',exact:true}).click()
      await page.getByRole('heading',{name:'Feedback settings',exact:true}).waitFor()
      if(width===390)assert.equal(await page.locator('header details').getAttribute('open'),null,'[OPS-003] mobile menu closes after navigation')
      await capture('sidebar-settings')
      await goto('/app/moderation')
      assert.equal(await page.getByRole('heading',{name:'attention-request',exact:true}).count(),2,'[REQ-014] both pending request cards remain visible')
      await page.getByRole('heading',{name:'attention-request',exact:true}).first().waitFor()
      assert.equal(await page.locator('a[href="/app/settings"]:visible').last().getAttribute('href'),'/app/settings')
      assert.ok(await page.locator('main section, main article').filter({has:page.getByRole('heading',{name:'attention-request',exact:true})}).last().getAttribute('class').then(value=>value.includes('shadow-')),'[REQ-014] moderation reuses operator card')
      assert.ok((await page.getByLabel('Public title').first().locator('xpath=..').getAttribute('class')).includes(fieldLabelClass),'[REQ-014] moderation uses operator labels')
      await capture('moderation')
      negativeChecks.push(await reviewDecisionPages({page,db:runtime.db,goto,capture,width}))
      await reviewStatusDrafts({page,db:runtime.db,goto,capture})
      if(!coreOnly)await reviewClauseStates({page,goto,capture})
      }
      }
      if(!focusedOnly&&!loopHealthOnly) {
        if(fieldsOnly)await reviewOperatorFields({page,browser,runtime,width,capture,checks})
        else if(!coreOnly)await reviewOperatorCompleteness({page,browser,runtime,width,capture,checks})
      }
      assert.deepEqual(errors,[],`No console or page errors; failed requests: ${JSON.stringify(failedRequests)}`)
      assert.deepEqual(external,[],'No external browser requests')
    } finally {
      try {await context?.close()}
      finally {await runtime.close()}
    }
    if(!focusedOnly&&!completenessOnly&&!loopHealthOnly)await reviewHostedData({browser,hosted,width,capture:(label,page,details)=>capturePage(width,label,page,details)})
  }
  if(completenessOnly) {
    // Both isolated runtimes must finish cleanup before the shared browser closes.
    const results=await Promise.allSettled([1440,390].map(reviewWidth))
    const failures=results.filter(result=>result.status==='rejected')
    if(failures.length===1)throw failures[0].reason
    if(failures.length>1)throw new AggregateError(failures.map(result=>result.reason),'Operator completeness failed at both widths')
  } else {
    for(const width of [1440,390])await reviewWidth(width)
  }
  await writeFile(join(output,'results.json'),JSON.stringify({clauses:'[MEAS-006 OPS-001 OPS-002 OPS-004 REQ-027 REQ-028 EVID-009 DATA-004 BASE-ACCESS-003 BASE-OPS-005 OPS-003 REQ-014 REQ-030 EVID-003 DEC-001 ROAD-007 ROAD-008 REL-001 DATA-001 DATA-003]',checks,negativeChecks},null,2)+'\n')
  console.log(`operator-pages: ${checks.length} captures passed`)
} catch(error) {
  sanitizeDiagnosticError(error)
  throw error
} finally {try{await browser?.close()}finally{await hosted?.close()}}
