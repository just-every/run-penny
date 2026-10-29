import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from '@playwright/test'
import {captureRuntime} from './browser-capture-runtime.mjs'

// Full Chromium is required: headless-shell has no extension runtime. Local
// system Chromium may forbid unpacked extensions by administrator policy; that
// refusal is an explicit failed check, never a simulated extension success.
const fixture=await captureRuntime(),{runtime,origin,sourceUrl,operator,json}=fixture,profile=await mkdtemp(join(tmpdir(),'penny-extension-'))
const extension=resolve('integrations/browser-extension'),context=await chromium.launchPersistentContext(profile,{
 executablePath:process.env.PENNY_BROWSER_EXECUTABLE??chromium.executablePath(),headless:true,viewport:{width:1440,height:1000},
 ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox','--disable-gpu','--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
})
try{
 await fixture.addSession(context)
 const cdp=await context.browser().newBrowserCDPSession()
 const installed=await cdp.send('Extensions.getExtensions')
 const {id}=installed.extensions.find(item=>item.path===extension)??await cdp.send('Extensions.loadUnpacked',{path:extension})
 let worker=context.serviceWorkers().find(worker=>worker.url().startsWith(`chrome-extension://${id}/`))
 worker??=await context.waitForEvent('serviceworker',{predicate:worker=>worker.url().startsWith(`chrome-extension://${id}/`)})
 const source=await context.newPage();await source.goto(sourceUrl);source.setDefaultTimeout(20000)
 async function popup(){
  await source.bringToFront()
  const target=await context.newCDPSession(source),{targetInfo}=await target.send('Target.getTargetInfo');await target.detach()
  const opened=context.waitForEvent('page',{predicate:page=>page.url().startsWith(`chrome-extension://${id}/`)})
  await cdp.send('Extensions.triggerAction',{id,targetId:targetInfo.targetId})
  const page=context.pages().find(page=>page.url()===`chrome-extension://${id}/popup.html`)??await opened
  await page.getByRole('button',{name:'Review capture',exact:true}).waitFor();return page
 }
 async function select(){await source.locator('#quote').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)})}
 await select()
 let panel=await popup();await panel.getByLabel('Penny workspace URL',{exact:true}).fill(origin);await panel.getByLabel('Include a screenshot of the visible tab').check()
 const reviewOpened=context.waitForEvent('page',{predicate:page=>page.url().startsWith(origin)})
 await panel.getByRole('button',{name:'Review capture',exact:true}).click()
 const review=await reviewOpened;review.setDefaultTimeout(20000)
 await review.getByLabel('Selected excerpt',{exact:true}).waitFor()
 assert.match(await review.getByLabel('Selected excerpt',{exact:true}).inputValue(),/Please add monthly exports/)
 assert.equal(await review.getByLabel('Original page URL',{exact:true}).inputValue(),sourceUrl)
 assert.ok((await review.getByRole('img',{name:'Visible source tab selected for private attachment'}).getAttribute('src')).startsWith('data:image/png;base64,'))
 await review.getByRole('button',{name:'Save to inbox',exact:true}).click();await review.getByRole('status').filter({hasText:'Completion is queued'}).waitFor()
 const rows=await json('/api/operator/browser-captures',undefined,operator),row=rows[0]
 assert.equal(row.page_url,sourceUrl);assert.equal((await json('/api/operator/evidence/'+row.evidence_id+'/attachments',undefined,operator)).files.length,1)
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 assert.equal((await json('/api/operator/browser-captures/'+row.id,undefined,operator)).state,'done')
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM evidence_items WHERE source_type=?').bind('browser_extension').first('n'),1)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n'),0)
 // The source fixture changes behind the same URL. The real extension performs
 // only a HEAD on the explicitly selected page and sends its selected new span.
 fixture.changeSource('changed');await source.reload();await select();panel=await popup()
 let nextReview=context.waitForEvent('page',{predicate:page=>page.url().startsWith(origin)})
 await panel.getByRole('button',{name:'Check a saved source',exact:true}).click();let check=await nextReview
 await check.getByRole('button',{name:'Check this capture',exact:true}).click();await check.getByRole('status').filter({hasText:'Source: changed'}).waitFor()
 fixture.changeSource('removed');await source.reload();panel=await popup();nextReview=context.waitForEvent('page',{predicate:page=>page.url().startsWith(origin)})
 await panel.getByRole('button',{name:'Check a saved source',exact:true}).click();check=await nextReview
 await check.getByRole('button',{name:'Check this capture',exact:true}).click();await check.getByRole('status').filter({hasText:'Source: removed'}).waitFor()
 assert.ok(fixture.reads.filter(read=>read.method==='HEAD').length>=2);assert.ok(fixture.reads.filter(read=>read.method==='HEAD').every(read=>read.url.startsWith('/records/42')))
 // Signing out invalidates the actual extension on its next handoff/save. The
 // review draft stays in extension session custody so it can be resumed later.
 await fixture.send('/api/auth/sign-out',{},operator,'POST',204)
 fixture.changeSource('current');await source.reload();await select();panel=await popup();await panel.getByLabel('Include a screenshot of the visible tab').uncheck()
 const signedOut=context.waitForEvent('page',{predicate:page=>page.url().startsWith(origin)})
 await panel.getByRole('button',{name:'Review capture',exact:true}).click();const denied=await signedOut
 await denied.waitForURL(origin+'/signin**')
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM evidence_items WHERE source_type=?').bind('browser_extension').first('n'),1)
 assert.equal((await fetch(origin+'/api/operator/browser-captures',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401)
 const stored=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}))
 assert.deepEqual(Object.keys(stored.local),['pennyOrigin']);assert.equal(stored.local.pennyOrigin,origin)
 assert.ok(stored.session.lastReview.draft.wording);assert.ok(!JSON.stringify(stored).includes('oa_session'))
 console.log('Actual Manifest V3 extension journey passed: selected-page text/PNG handoff, inbox and private attachment, explicit source edits/removal and signed-out refusal')
}finally{await context.close();await rm(profile,{recursive:true,force:true});await fixture.close()}
