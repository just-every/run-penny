import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'
import {finishFirstRun} from './local-signin.mjs'
import {learningBindings,learningProvider} from './learning-provider.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/learning-browser'),checks=[]
const futureDate=days=>new Date(Date.now()+days*24*60*60*1000).toISOString().slice(0,16)
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
// Use the pinned Playwright installation, matching the README browser journey.
process.env.PENNY_BROWSER_EXECUTABLE ??= chromium.executablePath()
const browser=await chromium.launch(browserOptions())
try {
 for(const width of [1440,390]) {
  const runtime=await startBrowserRuntime({bindings:learningBindings,networkWorker:learningProvider});let context
  try {
   const origin=runtime.origin,bootstrap=await fetch(origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Owner',returnTo:'/app'})});assert.equal(bootstrap.status,303)
   const pair=bootstrap.headers.get('set-cookie').split(';')[0],split=pair.indexOf('=')
   context=await browser.newContext({viewport:{width,height:width===390?844:1000}});await context.addCookies([{name:pair.slice(0,split),value:pair.slice(split+1),url:origin}]);const page=await context.newPage(),errors=[],external=[]
   page.on('pageerror',()=>errors.push('pageerror'));page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(new URL(r.url()).origin)})
   async function capture(label,target=page) {
    await target.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
    assert.equal(await target.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false,label+' overflow')
    await target.evaluate(axe);assert.deepEqual(await target.evaluate(async()=>(await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[],label+' serious/critical accessibility')
    await target.screenshot({path:join(output,label+'-'+width+'.png'),fullPage:true});checks.push({label,width,buttonColors:await target.locator('.penny-learning .control-actions form > button,.penny-learning .decision-actions form > button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>({label:n.textContent,color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor})))})
   }
   async function submit(form,name) {const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/operator/'));await form.getByRole('button',{name,exact:true}).focus();await page.keyboard.press('Enter');const result=await response;assert.ok(result.ok(),name+' returned '+result.status());await result.finished()}
   await page.goto(origin+'/setup');await finishFirstRun(page,async()=>{})
   await page.goto(origin+'/app/learning');await page.getByRole('heading',{name:'Turn customer evidence into a decision.'}).waitFor();await capture('empty-learning')
   await page.getByText('Record native feedback',{exact:true}).click();const native=page.getByRole('form',{name:'New evidence',exact:true});await native.getByLabel('Source',{exact:true}).selectOption('free_text');await native.getByLabel('Source label (required for free text)',{exact:true}).fill('Owner-authorized customer interview');await native.getByLabel('Original wording',{exact:true}).fill('Private native feedback: I cannot find the month-end export.');await native.getByLabel('Observed time',{exact:true}).fill('2026-10-14T09:00');await submit(native,'Record evidence')
   await page.getByText('Start a bounded investigation',{exact:true}).click();const grant=page.getByRole('form',{name:'Authorize learning',exact:true})
   await grant.getByRole('checkbox').first().check();await grant.getByLabel('Purpose and scope',{exact:true}).fill('Read selected evidence; prepare options only. No customer contact.');await grant.getByLabel('Grant expiry',{exact:true}).fill(futureDate(30));await grant.getByLabel('Total spend limit (USD)',{exact:true}).fill('10');await grant.getByLabel('Maximum check cost (USD)',{exact:true}).fill('1');await submit(grant,'Start learning')
   await page.getByText('Scope, cost and controls',{exact:true}).click();await submit(page.getByRole('form',{name:'run investigation',exact:true}),'Check now')
   await page.getByRole('heading',{name:'Source-cited facts',exact:true}).waitFor();await page.getByRole('heading',{name:'Why is month-end export difficult?',exact:true}).waitFor();await capture('thin-native-learning')
   await page.getByText('Sources, permission and erasure',{exact:true}).click()
   const nativeSource=page.locator('.source-row');assert.equal(await nativeSource.count(),1);assert.equal(await nativeSource.locator('input[name="sourcePersonId"]').count(),0);assert.equal(await nativeSource.locator('a[href="/app/data"]').isVisible(),true)
   await page.getByText('Sources, permission and erasure',{exact:true}).click()
   await page.getByText('Connect selected Orbit sales evidence',{exact:true}).click();const source=page.getByRole('form',{name:'Grant a source',exact:true})
   await source.getByLabel('Source name',{exact:true}).fill('Selected sales evidence');await source.getByLabel('Selected sales record IDs (one per line)',{exact:true}).fill('opportunities/close-friction');await source.getByLabel('Permission and permitted use',{exact:true}).fill('Owner-authorized internal investigation of month-end export friction.');await source.getByRole('checkbox').check();await submit(source,'Connect selected records')
   await page.getByText('Sources, permission and erasure',{exact:true}).click()
   const orbitSource=page.locator('.source-row').filter({has:page.getByRole('heading',{name:'Selected sales evidence · active',exact:true})});await orbitSource.getByText("Erase a source person's contribution",{exact:true}).click();assert.equal(await orbitSource.getByLabel('Source person ID',{exact:true}).isVisible(),true)
   await page.getByText('Sources, permission and erasure',{exact:true}).click()
   await page.getByText('Add a permitted source to this question',{exact:true}).click();const extend=page.getByRole('form',{name:'Extend selected source evidence',exact:true});await extend.getByLabel('Previously granted source',{exact:true}).selectOption({label:'Selected sales evidence'});await submit(extend,'Use selected source');await submit(page.getByRole('form',{name:'run investigation',exact:true}),'Check now');await page.getByRole('heading',{name:'Source-cited facts',exact:true}).waitFor();await page.getByText('Scope, cost and controls',{exact:true}).click();for(const summary of await page.locator('.capture > details > summary').all())if(await summary.evaluate(el=>el.parentElement.open))await summary.click();await capture('actionable-learning')
   await page.getByText('Inspect exact sources',{exact:true}).click();await page.getByText('Original evidence',{exact:true}).first().waitFor();await capture('source-drilldown');await submit(page.getByRole('form',{name:'Defer this recommendation',exact:true}),'Not now');await page.getByRole('heading',{name:'Nothing needs your decision.',exact:true}).waitFor()
   await page.getByText('Contest or correct interpretation',{exact:true}).click();const correct=page.getByRole('form',{name:'Correct interpretation',exact:true});await correct.getByLabel('Correction and its evidence',{exact:true}).fill('Distinguish discoverability from missing export fields; do not infer cancellations.');await submit(correct,'Record correction');await page.getByText('Scope, cost and controls',{exact:true}).click();await page.getByText('Inspect history and prior versions',{exact:true}).click();await page.getByRole('heading',{name:'Operator corrections',exact:true}).waitFor();await capture('contested-history');await page.getByText('Inspect history and prior versions',{exact:true}).click()
   await submit(page.getByRole('form',{name:'run investigation',exact:true}),'Check now');await page.getByText('The operator correction contests the initial workflow explanation.',{exact:true}).waitFor()
   const choice=page.getByRole('form',{name:'Record accountable choice',exact:true});await choice.getByText('Change it',{exact:true}).click();await choice.getByLabel('Chosen intervention',{exact:true}).selectOption('export');await choice.getByLabel('Decision rationale',{exact:true}).fill('Use a reversible prototype to distinguish the capability gap.');await choice.getByLabel('Your confidence',{exact:true}).selectOption('low');await choice.getByLabel('Review date',{exact:true}).fill(futureDate(7));await choice.getByText('Review and edit measurement before action',{exact:true}).click();await choice.getByLabel('Cohort denominator',{exact:true}).fill('12');await choice.getByLabel('Baseline',{exact:true}).fill('Measure export time before prototype exposure');await capture('editable-pre-action-protocol');await submit(choice,'Do this')
   await page.getByRole('heading',{name:'Decision recorded · outcome incomplete',exact:true}).waitFor();await capture('incomplete-result');await page.getByText('Contest or correct interpretation',{exact:true}).click();const revise=page.getByRole('form',{name:'Correct interpretation',exact:true});await revise.getByLabel('Correction and its evidence',{exact:true}).fill('The committed comparison lacked observed baseline evidence; reassess before action.');await submit(revise,'Record correction');await page.getByRole('heading',{name:'Decision invalidated · reassessment needed',exact:true}).waitFor();await capture('invalidated-result')
   await submit(page.getByRole('form',{name:'Pause all learning',exact:true}),'Pause all')
   await page.getByText('Sources, permission and erasure',{exact:true}).click();await submit(page.getByRole('form',{name:'Disconnect Selected sales evidence',exact:true}),'Disconnect and purge');await page.getByRole('heading',{name:'Turn customer evidence into a decision.'}).waitFor();await capture('disconnected-learning')
   const publicContext=await browser.newContext();try{const publicPage=await publicContext.newPage();await publicPage.goto(origin+'/portal/feedback');assert.doesNotMatch(await publicPage.locator('body').innerText(),/Private learning source|Private native feedback|internal investigation|reversible prototype|fixture-customer/);assert.equal((await publicContext.request.get(origin+'/api/operator/learning')).status(),401);await publicPage.goto(origin+'/app/learning');await publicPage.waitForURL('**/signin*')}finally{await publicContext.close()}
   await runtime.configure({PENNY_LEARNING:''});await page.reload();await page.getByText('Connect selected Orbit sales evidence',{exact:true}).click();assert.equal(await page.getByRole('form',{name:'Grant a source',exact:true}).getByRole('button',{name:'Connect selected records',exact:true}).isDisabled(),true);await capture('unconfigured-source')
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push({width,privacy:true,sourceDisconnect:true,nativePersonErasureUsesData:true,orbitPersonErasureAvailable:true,realProtocolCommit:true})
  } finally {await context?.close();await runtime.close()}
 }
 await writeFile(join(output,'receipt.json'),JSON.stringify({checks,visualAuthority:resolve('../evidence/learning-design.png')},null,2));console.log('Learning browser journey passed at 1440 and 390.')
} finally {await browser.close()}
