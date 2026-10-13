import { reviewClauseStates } from './operator-pages-clause-states.mjs'
import { browserOptions } from './browser-options.mjs'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { startBrowserRuntime } from './base-runtime.mjs'
import { reviewStatusDrafts } from './operator-pages-status.mjs'
import { reviewDecisionPages } from './operator-pages-decisions.mjs'
import { seedOverviewAttention, duplicateOverviewAttention } from './operator-pages-data.mjs'
import { prepareHostedDataReview, reviewHostedData } from './operator-pages-hosted-data.mjs'
import { finishFirstRun } from './local-signin.mjs'
// REQ-014, REQ-018: moderation and settings forms wear the operator kit's own card and label, whatever those classes are.
const { fieldLabelClass, paperCardClass } = await import('../../src/core/ui/app/classes.ts')

const output = resolve(process.env.PENNY_EVIDENCE ?? '../evidence/decision-loop-resume')
assert.ok(!output.startsWith(resolve('.') + '/'), 'Screenshots must stay outside the repository')
await mkdir(output, { recursive: true })
const axe = await readFile(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
const checks = [], negativeChecks = []
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
try {
  hosted = await prepareHostedDataReview()
  const options=browserOptions()
  browser = await chromium.launch({...options,args:[...options.args,hosted.trustArgument]})
  for (const width of [1440,390]) {
    const runtime = await startBrowserRuntime()
    let context
    try {
      const {origin} = runtime
      const bootstrap = await fetch(origin+'/auth/bootstrap',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'}),redirect:'manual'})
      assert.equal(bootstrap.status,303)
      const pair = bootstrap.headers.get('set-cookie').split(';')[0], split=pair.indexOf('=')
      context = await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane'})
      await context.addCookies([{name:pair.slice(0,split),value:pair.slice(split+1),url:origin,httpOnly:true,sameSite:'Lax'}])
      const page = await context.newPage(), errors=[], external=[], failedRequests=[]
      let phase='first-run'
      page.on('pageerror',error=>errors.push({phase,message:diagnosticMessage(error.message)}))
      page.on('console',message=>{
        if(message.type()!=='error')return
        const diagnostic={phase,message:diagnosticMessage(message.text()),path:diagnosticPath(message.location().url)}
        errors.push(diagnostic)
        console.error('operator-pages browser error: '+JSON.stringify(diagnostic))
      })
      page.on('response',response=>{if(response.status()>=400)failedRequests.push({phase,path:diagnosticPath(response.url()),status:response.status(),method:response.request().method()})})
      page.on('requestfailed',request=>failedRequests.push({phase,path:diagnosticPath(request.url()),method:request.method(),failure:request.failure()?.errorText}))
      page.on('request',request=>{if(new URL(request.url()).origin!==origin)external.push(new URL(request.url()).origin)})
      async function capture(label,targetPage=page) {
        phase=label
        await capturePage(width,label,targetPage)
      }
      async function goto(path) { phase=diagnosticPath(origin+path);const response=await page.goto(origin+path);assert.equal(response.status(),200);await page.locator('main h1').waitFor() }
      await goto('/setup')
      assert.equal(await finishFirstRun(page,(targetPage,label)=>capture(label,targetPage)),true,'[BASE-ACCESS-002] native owner finishes the real first-run form')
      await goto('/app/overview')
      await page.getByText('Needs you',{exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'Create a board to collect feedback.'}).getAttribute('href'),'/app/settings')
      assert.equal(await page.locator('[aria-labelledby="overview-attention"] li').count(),0,'[OPS-003] zero attention has no placeholder rows')
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
      await seedOverviewAttention(runtime.db)
      await goto('/app/overview')
      for(const [name,to] of [['1 request awaiting moderation','/app/moderation'],['1 unreviewed evidence item','/app/feedback'],['1 ready decision','/app/decisions'],['1 unpublished status update','/app/roadmap'],['1 Shipped item without a published release','/app/releases']]) {
        assert.equal(await page.getByRole('link',{name,exact:true}).getAttribute('href'),to,`[DEC-001 EVID-003 ROAD-007 ROAD-008 REL-001 REQ-014] ${name}`)
      }
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
      assert.equal(new Set(icons).size,icons.length,'[OPS-003] sidebar icons are unique')
      assert.equal(icons.length,9,'[OPS-003] all nine destinations have distinct icons')
      assert.deepEqual(await nav.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),['/app/overview','/app/feedback','/app/moderation','/app/decisions','/app/roadmap','/app/releases','/app/customers','/app/settings','/app/data'],'[OPS-003] sidebar reaches every destination')
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
      await reviewClauseStates({page,goto,capture})
      assert.deepEqual(errors,[],`No console or page errors; failed requests: ${JSON.stringify(failedRequests)}`)
      assert.deepEqual(external,[],'No external browser requests')
    } finally {await context?.close();await runtime.close()}
    await reviewHostedData({browser,hosted,width,capture:(label,page,details)=>capturePage(width,label,page,details)})
  }
  await writeFile(join(output,'results.json'),JSON.stringify({clauses:'[OPS-003 REQ-014 REQ-030 EVID-003 DEC-001 ROAD-007 ROAD-008 REL-001 DATA-001 DATA-003]',checks,negativeChecks},null,2)+'\n')
  console.log(`operator-pages: ${checks.length} captures passed`)
} finally {try{await browser?.close()}finally{await hosted?.close()}}
