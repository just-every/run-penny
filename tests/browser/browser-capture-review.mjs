import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {browserOptions} from './browser-options.mjs'
import {captureRuntime} from './browser-capture-runtime.mjs'
import {startBrowserRuntime} from './base-runtime.mjs'

const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/browser-capture')
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const fixture=await captureRuntime(),{runtime,origin,sourceUrl,operator,json,send,request,customer}=fixture,browser=await chromium.launch(browserOptions())
const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[]
try{
 await fixture.addSession(context)
 const source=await context.newPage();await source.goto(sourceUrl)
 const original=await source.locator('#quote').textContent(),png=await source.screenshot(),image='data:image/png;base64,'+png.toString('base64'),hash=createHash('sha256').update(png).digest('hex')
 const draft={id:crypto.randomUUID(),mode:'capture',pageUrl:sourceUrl,wording:original,observedAt:'2026-10-28T12:00:00Z',status:200,image}
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message))
 await page.goto(origin+'/app/browser-capture',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.pennyCapture==='ready')
 // The untrusted handoff is the real isolated-content-script DOM bridge. Extension APIs are
 // exercised separately by browser-capture.mjs, with the identical review route.
 await page.evaluate(draft=>document.dispatchEvent(new CustomEvent('penny-browser-draft',{detail:JSON.stringify(draft)})),draft)
 await page.getByLabel('Selected excerpt',{exact:true}).waitFor()
 await page.getByLabel('Source time (ISO date, time and timezone)').fill('2026-10-27T14:00:00Z')
 await page.getByLabel('Author as named at the source (optional)').fill('Source author source.person@example.test')
 await page.getByLabel('Days to keep the excerpt after source removal').fill('0')
 await page.getByLabel('Find a customer',{exact:true}).fill('Nina')
 await page.getByRole('button',{name:'Search customers',exact:true}).click();await page.getByRole('option',{name:/Nina Rao/}).waitFor({state:'attached'})
 assert.equal(await page.getByLabel('Customer',{exact:true}).inputValue(),'','Search never silently selects a person')
 await page.getByLabel('Customer',{exact:true}).selectOption(customer.requesterId)
 await page.getByLabel('Find a request',{exact:true}).fill('Monthly finance')
 await page.getByRole('button',{name:'Search requests',exact:true}).click();await page.getByRole('option',{name:'Monthly finance exports',exact:true}).waitFor({state:'attached'})
 await page.getByLabel('Request',{exact:true}).selectOption(request.id)
 await page.getByLabel('Record a proxy vote from this excerpt').check()
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 async function proof(name){
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  if(page.viewportSize().width===1440){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[])}
  await page.screenshot({path:join(output,name+'.png'),fullPage:true})
 }
 // Behavioral assertions use one width. Each changed screen is shown once at
 // desktop and phone widths, without repeating the functional journey.
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await proof(`review-${width}`)}
 await page.setViewportSize({width:1440,height:1000})
 await page.getByRole('button',{name:'Save to inbox',exact:true}).click();await page.getByRole('status').filter({hasText:'Completion is queued'}).waitFor()
 const jobs=await json('/api/operator/browser-captures',undefined,operator),job=jobs.find(row=>row.id===draft.id)
 assert.equal(job.state,'pending');assert.equal(job.page_url,sourceUrl);assert.equal(job.proxy_vote,1);assert.equal(job.owner_name,'Maya Patel')
 const evidence=(await json('/api/operator/evidence?item='+job.evidence_id,undefined,operator)).items[0]
 assert.equal(evidence.reviewState,'unreviewed');assert.equal(evidence.requester.id,customer.requesterId);assert.match(evidence.wording,/\[REDACTED:email\]/);assert.doesNotMatch(evidence.wording,/UNSELECTED_|source.person@example/);assert.match(evidence.namedSpeaker,/\[REDACTED:email\]/)
 const attachments=await json(`/api/operator/evidence/${job.evidence_id}/attachments`,undefined,operator)
 assert.equal(attachments.files.length,1)
 const file=await send('/api/operator/evidence-attachments/'+attachments.files[0].id,undefined,operator),bytes=Buffer.from(await file.arrayBuffer())
 assert.equal(createHash('sha256').update(bytes).digest('hex'),hash)
 await send('/api/operator/evidence-attachments/'+attachments.files[0].id,undefined,{},'GET',401)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:['monthly']},operator,'PUT')
 await runtime.restart();await runtime.schedule();await runtime.schedule()
 assert.equal((await json('/api/operator/browser-captures/'+job.id,undefined,operator)).state,'done')
 await page.getByRole('button',{name:'Check completion',exact:true}).click();await page.getByRole('status').filter({hasText:'Capture completed.'}).waitFor()
 // Reopening the original raw extension draft loads the saved redacted
 // excerpt and source time, retaining the deliberately selected native people.
 await page.goto(origin+'/app/browser-capture',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.pennyCapture==='ready')
 await page.evaluate(draft=>document.dispatchEvent(new CustomEvent('penny-browser-draft',{detail:JSON.stringify(draft)})),draft)
 await page.getByRole('status').filter({hasText:'Saved choices: Nina Rao · Monthly finance exports'}).waitFor()
 assert.equal(await page.getByLabel('Source time (ISO date, time and timezone)').inputValue(),'2026-10-27T14:00:00Z')
 assert.equal(await page.getByLabel('Days to keep the excerpt after source removal').inputValue(),'0')
 assert.match(await page.getByLabel('Selected excerpt',{exact:true}).inputValue(),/\[REDACTED:email\]/)
 const votes=await runtime.db.prepare('SELECT COUNT(*) n FROM request_votes WHERE request_id=? AND requester_id=?').bind(request.id,customer.requesterId).first('n');assert.equal(votes,1)
 const proxy=await runtime.db.prepare('SELECT source,source_url,evidence_id,recorder_operator_id FROM penny_proxy_votes WHERE request_id=? AND requester_id=?').bind(request.id,customer.requesterId).first()
 assert.equal(proxy.source_url,sourceUrl);assert.equal(proxy.evidence_id,job.evidence_id);assert.match(proxy.source,/\[REDACTED:email\]/);assert.match(proxy.source,/\[REDACTED:custom\]/);assert.ok(proxy.recorder_operator_id)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 assert.equal(await runtime.db.prepare('SELECT verified_at FROM requester_addresses WHERE requester_id=?').bind(customer.requesterId).first('verified_at'),null)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requester_update_permissions WHERE requester_id=?').bind(customer.requesterId).first('n'),0)
 await json('/api/operator/browser-captures/'+job.id+'/ready',{},operator)
 await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM request_votes WHERE request_id=? AND requester_id=?').bind(request.id,customer.requesterId).first('n'),1)
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(origin+`/app/feedback?item=${job.evidence_id}`,{waitUntil:'networkidle'})
  await page.getByRole('link',{name:'Open captured page',exact:true}).waitFor();if(width===1440)assert.equal(await page.getByRole('link',{name:'Open captured page',exact:true}).getAttribute('href'),sourceUrl)
  await proof(`inbox-${width}`)
 }
 const base={id:crypto.randomUUID(),pageUrl:sourceUrl,wording:'A separate selected passage.',observedAt:draft.observedAt,proxyVote:false,purgeDays:0}
 await send('/api/operator/browser-captures',base,{},'POST',401)
 await send('/api/operator/browser-captures',base,{...operator,Origin:'https://foreign.example.test'},'POST',403)
 await send('/api/operator/browser-captures',{...base,pageUrl:'javascript:alert(1)'},operator,'POST',400)
 const interrupted=await json('/api/operator/browser-captures',base,operator,'POST',201)
 await runtime.restart();await runtime.schedule(Date.now()+300001)
 let failed=await json('/api/operator/browser-captures/'+interrupted.id,undefined,operator);assert.equal(failed.state,'failed');assert.match(failed.failure,/interrupted/)
 await runtime.restart();assert.equal((await json('/api/operator/browser-captures/'+interrupted.id,undefined,operator)).state,'failed')
 assert.equal((await json('/api/operator/browser-captures',base,operator,'POST',201)).evidence_id,interrupted.evidence_id)
 await send('/api/operator/browser-captures',{...base,wording:'Different wording'},operator,'POST',409)
 await json('/api/operator/browser-captures/'+interrupted.id+'/ready',{},operator,'POST',202);await runtime.schedule();assert.equal((await json('/api/operator/browser-captures/'+interrupted.id,undefined,operator)).state,'done')
 // Screenshot-only capture remains useful with no customer or request. Its
 // stable upload identity preserves original bytes across an upload retry.
 const screenshotOnly=await json('/api/operator/browser-captures',{...base,id:crypto.randomUUID(),wording:'',screenshot:{hash,bytes:png.length}},operator,'POST',201)
 const form=new FormData();form.set('file',new File([png],'browser-screenshot.png',{type:'image/png'}))
 for(let attempt=0;attempt<2;attempt++){const response=await fetch(origin+`/api/operator/browser-captures/${screenshotOnly.id}/screenshot`,{method:'POST',headers:{Origin:origin,...operator},body:form});assert.equal(response.status,200,await response.clone().text())}
 await json(`/api/operator/browser-captures/${screenshotOnly.id}/ready`,{},operator,'POST',202);await runtime.schedule()
 assert.equal((await json('/api/operator/evidence/'+screenshotOnly.evidence_id+'/attachments',undefined,operator)).files.length,1)
 assert.equal((await json('/api/operator/browser-captures/'+screenshotOnly.id,undefined,operator)).state,'done')
 const stopped=await json('/api/operator/browser-captures',{...base,id:crypto.randomUUID()},operator,'POST',201);await json('/api/operator/browser-captures/'+stopped.id+'/stop',{},operator);await send('/api/operator/browser-captures/'+stopped.id+'/ready',{},operator,'POST',409)
 // Recheck only the explicit source. Capture preserves its version on edits.
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/app/browser-capture',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.pennyCapture==='ready')
 await page.evaluate(draft=>document.dispatchEvent(new CustomEvent('penny-browser-draft',{detail:JSON.stringify(draft)})),{...draft,mode:'check',wording:'Source wording after its edit.',image:undefined})
 const sourceRow=page.getByRole('article').filter({has:page.locator(`a[href='/app/feedback?item=${job.evidence_id}#evidence-${job.evidence_id}']`)})
 await sourceRow.getByRole('button',{name:'Check this capture',exact:true}).waitFor()
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await proof(`source-check-${width}`)}
 await page.setViewportSize({width:1440,height:1000});await sourceRow.getByRole('button',{name:'Check this capture',exact:true}).click();await page.getByRole('status').filter({hasText:'Source: changed'}).waitFor();await sourceRow.getByRole('link',{name:'Open captured evidence · changed',exact:true}).waitFor()

 assert.equal((await json('/api/operator/browser-captures/'+job.id,undefined,operator)).source_state,'changed')
 assert.equal((await json('/api/operator/evidence?item='+job.evidence_id,undefined,operator)).items[0].wording,evidence.wording)
 await send('/api/operator/browser-captures/'+job.id+'/check',{pageUrl:sourceUrl+'/different',wording:'Not selected',status:200},operator,'POST',409)
 await json('/api/operator/browser-captures/'+job.id+'/check',{pageUrl:sourceUrl,wording:'',status:404},operator)
 await Promise.all([runtime.schedule(),runtime.schedule()]);await runtime.schedule()
 assert.equal((await json('/api/operator/browser-captures/'+job.id,undefined,operator)).source_state,'purged')
 assert.equal((await json('/api/operator/evidence/'+job.evidence_id+'/versions',undefined,operator))[0].wording,'[Source removed]')
 await send('/api/operator/browser-captures/'+job.id+'/check',{pageUrl:sourceUrl,wording:original,status:200},operator,'POST',409)
 assert.equal(await runtime.db.prepare("SELECT COUNT(*) n FROM audit_entries WHERE action='browser.source_purged' AND entity_id=?").bind(job.evidence_id).first('n'),1)
 const held=await json('/api/operator/browser-captures',{...base,id:crypto.randomUUID()},operator,'POST',201),portable=await json('/api/operator/data/export',undefined,operator)
 assert.equal(portable.archive.tables.penny_browser_captures.find(row=>row.id===held.id).state,'held')
 assert.equal(portable.archive.tables.penny_browser_authority,undefined)
 assert.ok(portable.archive.tables.attachments.some(file=>file.id===job.id))
 const restored=await startBrowserRuntime()
 try{
  const boot=await fetch(restored.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'})});assert.equal(boot.status,303)
  const Cookie=boot.headers.get('set-cookie').split(';')[0]
  async function post(path,body){const response=await fetch(restored.origin+path,{method:'POST',headers:{Origin:restored.origin,Cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
  let operation=await post('/api/operator/data/import',portable)
  for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await post(`/api/operator/data/operations/${operation.operationId}/resume`,{})
  assert.equal(operation.status,'complete');await restored.schedule()
  assert.equal(await restored.db.prepare('SELECT state FROM penny_browser_captures WHERE id=?').bind(held.id).first('state'),'held')
  assert.equal(await restored.db.prepare('SELECT COUNT(*) n FROM penny_browser_authority').first('n'),0)
 }finally{await restored.close()}
 // Erasure traverses provenance and deletes screenshot originals, while a
 // wording-free receipt refuses a delayed replay of the old capture identity.
 async function dataPost(path,body){const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,Connection:'close',...operator,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
 let preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:job.evidence_id})
 for(let step=0;preview.status==='pending'&&step<100;step++)preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:job.evidence_id,continuation:preview.continuation})
 assert.deepEqual(preview.blockedCopies,[]);assert.equal(preview.counts.penny_browser_captures,1)
 const response=await fetch(origin+'/api/operator/data/erasure',{method:'POST',headers:{Origin:origin,Connection:'close',...operator,'Content-Type':'application/json'},body:JSON.stringify({table:'evidence_items',id:job.evidence_id,planHash:preview.planHash})});assert.ok([200,202].includes(response.status),await response.clone().text());let operation=await response.json()
 for(let step=0;operation.status!=='complete'&&step<100;step++){const response=await fetch(origin+`/api/operator/data/operations/${operation.operationId}/resume`,{method:'POST',headers:{Origin:origin,Connection:'close',...operator,'Content-Type':'application/json'},body:'{}'});assert.ok([200,202].includes(response.status),await response.clone().text());operation=await response.json()}
 assert.equal(operation.status,'complete');await send('/api/operator/evidence-attachments/'+job.id,undefined,operator,'GET',404)
 // A signed-out current operator cannot create a capture or complete queued work.
 const revoked=await json('/api/operator/browser-captures',{...base,id:crypto.randomUUID()},operator,'POST',201);await json(`/api/operator/browser-captures/${revoked.id}/ready`,{},operator,'POST',202)
 await send('/api/auth/sign-out',{},operator,'POST',204)
 await runtime.schedule();await send('/api/operator/browser-captures',base,operator,'POST',401)
 assert.equal(await runtime.db.prepare('SELECT state FROM penny_browser_captures WHERE id=?').bind(revoked.id).first('state'),'failed')
 const visitor=await browser.newPage();await visitor.goto(origin+'/portal/feedback');assert.doesNotMatch(await visitor.content(),/source.person@example|UNSELECTED_PRIVATE|records\/42/);await visitor.close()
 assert.equal(runtime.outbox.some(item=>item.email==='nina@example.test'),false);assert.deepEqual(errors,[])
 console.log('Browser capture review journey passed: private selected-source evidence, original PNG, explicit picks/proxy, session/origin refusal, durable restart/stop, source policy, portability and erasure; 1440/390 proof')
}catch(error){console.error('REVIEW_FAILURE',error.message);for(const page of context.pages()){console.error('PAGE',page.url(),(await page.locator('body').innerText().catch(()=>'' )).slice(-5000));await page.screenshot({path:join(output,'failure-'+context.pages().indexOf(page)+'.png'),fullPage:true}).catch(()=>{})}console.error('PAGE_ERRORS',errors);throw error}finally{await context.close();await browser.close();await fixture.close()}
