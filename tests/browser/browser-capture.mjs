import assert from 'node:assert/strict'
import {mkdir,mkdtemp,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from '@playwright/test'
import {captureRuntime} from './browser-capture-runtime.mjs'

// Native extension action popups are Chromium `other` targets, rather than
// ordinary tabs. Ask Playwright to attach to those targets so this journey
// operates the real popup and preserves Chrome's activeTab consent grant.
process.env.PW_CHROMIUM_ATTACH_TO_OTHER='1'

// Use the real toolbar in headed Chromium (Xvfb on Linux CI). Keep the context
// viewport native: applying tab viewport emulation to extension popup targets
// crashes Chromium. Only the source tab is resized for the width proofs. Local
// system Chromium may forbid unpacked extensions by administrator policy; that
// refusal is an explicit failed check, never a simulated extension success.
const fixture=await captureRuntime(),{runtime,origin,sourceUrl,operator,json}=fixture,profile=await mkdtemp(join(tmpdir(),'penny-extension-'))
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/browser-capture');assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const extension=resolve('integrations/browser-extension'),context=await chromium.launchPersistentContext(profile,{
 executablePath:process.env.PENNY_BROWSER_EXECUTABLE??chromium.executablePath(),headless:false,viewport:null,
 ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox','--disable-gpu','--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
})
try{
 await fixture.addSession(context)
 const cdp=await context.browser().newBrowserCDPSession()
 const installed=await cdp.send('Extensions.getExtensions')
 const {id}=installed.extensions.find(item=>item.path===extension)??await cdp.send('Extensions.loadUnpacked',{path:extension})
 let worker=context.serviceWorkers().find(worker=>worker.url().startsWith(`chrome-extension://${id}/`))
 worker??=await context.waitForEvent('serviceworker',{predicate:worker=>worker.url().startsWith(`chrome-extension://${id}/`)})
 // Grant this fixture installation through Chrome's own site-access setting.
 // The production manifest and permissions.request path stay byte-identical;
 // this is native browser consent setup, with no extension API stubs.
 const siteAccess=await context.newPage();await siteAccess.goto('chrome://extensions')
 await siteAccess.evaluate(({id,origin})=>new Promise((resolve,reject)=>{chrome.developerPrivate.addHostPermission(id,origin+'/*',()=>{const error=chrome.runtime.lastError;if(error)reject(new Error(error.message));else resolve()})}),{id,origin})
 await siteAccess.close()
 const source=await context.newPage();await source.setViewportSize({width:1440,height:1000});await source.goto(sourceUrl);source.setDefaultTimeout(20000)
 async function popup(){
  // Playwright focus emulation can keep a prior native popup target alive.
  // Close it before the next toolbar action so we never drive a stale popup.
  for(const page of context.pages().filter(page=>page.url()===`chrome-extension://${id}/popup.html`))await page.close()
  await source.bringToFront()
  const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]})
  const targetInfo=targetInfos.find(target=>target.type==='tab'&&target.url===source.url());assert.ok(targetInfo,'The extension action needs the browser tab target, not its renderer page target.')
  await cdp.send('Extensions.triggerAction',{id,targetId:targetInfo.targetId})
  let page
  for(let attempt=0;attempt<200&&!page;attempt++){
   page=context.pages().find(page=>page.url()===`chrome-extension://${id}/popup.html`)
   if(!page)await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.ok(page,'The native extension action must open its popup.')
  await page.getByRole('button',{name:'Review capture',exact:true}).waitFor();return page
 }
 async function openReview(panel,button){
  const before=new Set(context.pages());let clickError
  // Native toolbar popups clamp their height and scroll independently of a
  // tab's viewport. Activate their focused button with a real keyboard event.
  try{await panel.getByRole('button',{name:button,exact:true}).press('Enter')}catch(error){clickError=error}
  for(let attempt=0;attempt<200;attempt++){
   const page=context.pages().find(page=>!before.has(page)&&page.url().startsWith(origin))
   if(page){page.setDefaultTimeout(20000);return page}
   await new Promise(resolve=>setTimeout(resolve,100))
  }
  throw clickError??new Error('The extension did not open a Penny review: '+await panel.locator('#status').textContent().catch(()=> 'popup closed'))
 }
 async function select(){await source.locator('#quote').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)})}
 await select()
 const selected=await source.evaluate(()=>window.getSelection().toString())
 let panel=await popup();await panel.getByLabel('Penny workspace URL',{exact:true}).fill(origin);await panel.getByLabel('Include a screenshot of the visible tab').check()
 await panel.screenshot({path:join(output,'extension-popup-1440.png')})
 await source.setViewportSize({width:390,height:844});panel=await popup();await panel.getByLabel('Penny workspace URL',{exact:true}).fill(origin);await panel.getByLabel('Include a screenshot of the visible tab').check();await panel.screenshot({path:join(output,'extension-popup-390.png')})
 await source.setViewportSize({width:1440,height:1000});panel=await popup();await panel.getByLabel('Penny workspace URL',{exact:true}).fill(origin);await panel.getByLabel('Include a screenshot of the visible tab').check()
 const review=await openReview(panel,'Review capture')
 await review.getByLabel('Selected excerpt',{exact:true}).waitFor()
 assert.equal(await review.getByLabel('Selected excerpt',{exact:true}).inputValue(),selected)
 assert.equal(await review.getByLabel('Original page URL',{exact:true}).inputValue(),sourceUrl)
 const screenshot=await review.getByRole('img',{name:'Visible source tab selected for private attachment'}).getAttribute('src')
 assert.ok(screenshot.startsWith('data:image/png;base64,'))
 await review.getByRole('button',{name:'Save to inbox',exact:true}).click();await review.getByRole('status').filter({hasText:'Completion is queued'}).waitFor()
 const rows=await json('/api/operator/browser-captures',undefined,operator),row=rows[0]
 assert.equal(row.page_url,sourceUrl)
 assert.equal((await json('/api/operator/evidence?item='+row.evidence_id,undefined,operator)).items[0].wording,selected.replace('source.person@example.test','[REDACTED:email]'))
 const attachments=(await json('/api/operator/evidence/'+row.evidence_id+'/attachments',undefined,operator)).files
 assert.equal(attachments.length,1)
 const downloaded=await fixture.send('/api/operator/evidence-attachments/'+attachments[0].id,undefined,operator)
 assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),Buffer.from(screenshot.split(',')[1],'base64'))
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 assert.equal((await json('/api/operator/browser-captures/'+row.id,undefined,operator)).state,'done')
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM evidence_items WHERE source_type=?').bind('browser_extension').first('n'),1)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n'),0)
 // The source fixture changes behind the same URL. The real extension performs
 // only a HEAD on the explicitly selected page and sends its selected new span.
 fixture.changeSource('changed');await source.reload();await select();panel=await popup()
 let check=await openReview(panel,'Check a saved source')
 await check.getByRole('button',{name:'Check this capture',exact:true}).click();await check.getByRole('status').filter({hasText:'Source: changed'}).waitFor()
 fixture.changeSource('removed');await source.reload();panel=await popup();check=await openReview(panel,'Check a saved source')
 await check.getByRole('button',{name:'Check this capture',exact:true}).click();await check.getByRole('status').filter({hasText:'Source: removed'}).waitFor()
 assert.ok(fixture.reads.filter(read=>read.method==='HEAD').length>=2);assert.ok(fixture.reads.filter(read=>read.method==='HEAD').every(read=>read.url.startsWith('/records/42')))
 // Signing out invalidates the actual extension on its next handoff/save. The
 // review draft stays in extension session custody so it can be resumed later.
 await fixture.send('/api/auth/sign-out',{},operator,'POST',204)
 fixture.changeSource('current');await source.reload();await select();panel=await popup();await panel.getByLabel('Include a screenshot of the visible tab').uncheck()
 const denied=await openReview(panel,'Review capture')
 await denied.waitForURL(origin+'/signin**')
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM evidence_items WHERE source_type=?').bind('browser_extension').first('n'),1)
 assert.equal((await fetch(origin+'/api/operator/browser-captures',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401)
 const stored=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}))
 assert.deepEqual(Object.keys(stored.local),['pennyOrigin']);assert.equal(stored.local.pennyOrigin,origin)
 assert.ok(stored.session.lastReview.draft.wording);assert.ok(!JSON.stringify(stored).includes('oa_session'))
 console.log('Actual Manifest V3 extension journey passed: selected-page text/PNG handoff, inbox and private attachment, explicit source edits/removal and signed-out refusal')
}catch(error){console.error('EXTENSION_JOURNEY_FAILURE',error.message);throw error}finally{await context.close();await rm(profile,{recursive:true,force:true});await fixture.close()}
