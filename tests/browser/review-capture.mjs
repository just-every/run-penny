import assert from 'node:assert/strict'
import {generateKeyPairSync,verify} from 'node:crypto'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/review-capture');assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const sites=['g2','capterra','trustradius','trustpilot','producthunt','appstore','googleplay'],fixtures=Object.fromEntries(await Promise.all(sites.map(async s=>[s,await readFile(new URL('../fixtures/reviews/'+s+(['capterra','trustradius'].includes(s)?'.html':'.json'),import.meta.url),'utf8')]))),reads=[],modelReads=[]
const apple=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),googleKey=generateKeyPairSync('rsa',{modulusLength:2048}),renewals=[];let trustRefresh='synthetic-trustpilot-refresh-original'
const appleCredential={kind:'appstore',issuerId:'12345678-1234-4234-8234-123456789012',keyId:'ABCDEF1234',privateKey:apple.privateKey.export({type:'pkcs8',format:'pem'})},googleCredential={kind:'googleplay',clientEmail:'reviews@fixture.iam.gserviceaccount.com',privateKey:googleKey.privateKey.export({type:'pkcs8',format:'pem'})}
const listing=s=>s==='appstore'?'123456789':s==='googleplay'?'com.example.penny':'penny'
let mode='normal',onRead=async()=>{}
const edge={name:'reviews-network-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(w){const r=await fetch(w.url,{method:w.method,headers:w.headers,body:w.method==='POST'?w.body:undefined,redirect:'manual'});return {status:r.status,headers:{},body:await r.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
 const u=new URL(request.url)
 if(u.hostname==='oauth2.googleapis.com'){
  const body=new URLSearchParams(await request.text());assert.equal(body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');const [header,payload,signature]=body.get('assertion').split('.'),claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.iss,googleCredential.clientEmail);assert.equal(claims.scope,'https://www.googleapis.com/auth/androidpublisher');assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.ok(verify('RSA-SHA256',Buffer.from(header+'.'+payload),googleKey.publicKey,Buffer.from(signature,'base64url')));renewals.push('googleplay');await onRead('google-oauth');return Response.json({access_token:'synthetic-review-token-googleplay',expires_in:60})
 }
 if(u.hostname==='api.trustpilot.com'&&u.pathname.includes('/oauth/')){
  assert.equal(request.headers.get('Authorization'),'Basic '+Buffer.from('synthetic-client:synthetic-client-secret').toString('base64'));const body=new URLSearchParams(await request.text());assert.equal(body.get('refresh_token'),trustRefresh);trustRefresh='synthetic-trustpilot-refresh-'+renewals.length;renewals.push('trustpilot');return Response.json({access_token:'synthetic-review-token-trustpilot',refresh_token:trustRefresh,expires_in:60})
 }
 if(u.hostname==='api.openai.com'){
  assert.equal(request.headers.get('Authorization'),'Bearer synthetic-review-model-key');const body=await request.json(),input=JSON.parse(body.messages[1].content);assert.ok(!JSON.stringify(input).includes('reviewer@example.test'));modelReads.push(input);await onRead('model')
  const span='Please add café exports.',endByte=Buffer.byteLength(span),proposals=[{problem:'Schedule café exports',startByte:0,endByte:mode==='bad-span'?endByte+1:endByte,span,closestRequestId:input.requests[0]?.id??null}]
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({proposals})}}],usage:{prompt_tokens:10,completion_tokens:10}})
 }
 const s=u.hostname==='data.g2.com'?'g2':u.hostname==='api.appstoreconnect.apple.com'?'appstore':u.hostname==='androidpublisher.googleapis.com'?'googleplay':u.hostname==='api.trustpilot.com'?'trustpilot':u.hostname==='api.producthunt.com'?'producthunt':u.hostname==='www.capterra.com'?'capterra':u.hostname==='www.trustradius.com'?'trustradius':null
 assert.ok(s,'No request may escape the selected vendor interfaces');reads.push({site:s,url:u.href,method:request.method});await onRead(s)
 if(['capterra','trustradius'].includes(s)){assert.equal(request.headers.get('Authorization'),null);assert.equal(u.pathname,'/products/penny/reviews');return new Response(fixtures[s],{headers:{'Content-Type':'text/html'}})}
 if(s==='appstore'){const [h,p,signature]=request.headers.get('Authorization').slice(7).split('.'),claims=JSON.parse(Buffer.from(p,'base64url'));assert.equal(claims.iss,appleCredential.issuerId);assert.equal(claims.aud,'appstoreconnect-v1');assert.equal(JSON.parse(Buffer.from(h,'base64url')).kid,appleCredential.keyId);assert.ok(verify('sha256',Buffer.from(h+'.'+p),{key:apple.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')))}else assert.equal(request.headers.get('Authorization'),'Bearer synthetic-review-token-'+s)
 if(s==='producthunt'){const body=await request.json();assert.equal(body.variables.id,listing(s));assert.ok(body.query.includes('comments'));return Response.json(JSON.parse(fixtures[s]))}
 const detail=s==='g2'?u.pathname.endsWith('/g2-review-1'):s==='appstore'?u.pathname.endsWith('/customerReviews/appstore-review-1'):s==='googleplay'?u.pathname.endsWith('/reviews/googleplay-review-1'):u.pathname.endsWith('/reviews/trustpilot-review-1')
 if(detail)return Response.json({}, {status:mode==='removed'&&s==='googleplay'?404:200})
 if(s==='g2'&&mode==='revoked')return Response.json({error:'scope revoked'},{status:403})
 if(s==='g2'){assert.equal(u.searchParams.get('filter[product_id]'),listing(s));if(mode==='rate-limit')return Response.json({error:'fixture rate limit'},{status:429})}
 if(s==='appstore')assert.equal(u.pathname,`/v1/apps/${listing(s)}/customerReviews`)
 if(s==='googleplay')assert.equal(u.pathname,`/androidpublisher/v3/applications/${listing(s)}/reviews`)
 if(s==='trustpilot')assert.equal(u.pathname,`/v1/private/business-units/${listing(s)}/reviews`)
 const data=JSON.parse(fixtures[s])
 if(s==='appstore'){if(u.searchParams.get('page')==='second')data.data=[];else data.links.next=`https://api.appstoreconnect.apple.com/v1/apps/${listing(s)}/customerReviews?limit=50&page=second`}
 if(s==='g2'&&['extra-review','budget'].includes(mode)){const number=mode==='budget'?3:2;data.data[0].id='g2-review-'+number;data.data[0].attributes.url='https://www.g2.com/products/penny/reviews/penny-review-'+number}
 if(s==='g2'&&mode==='changed')data.data[0].attributes.body='Edited source: request already captured.'
 if(s==='googleplay'&&mode==='removed')data.reviews=[]
 return Response.json(data)
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_AI:JSON.stringify({openai:{apiKey:'synthetic-review-model-key',models:[{id:'review-fixture',inputMicrosPerToken:1,outputMicrosPerToken:1,maxOutputTokens:1000}]}})},networkWorker:edge,networkBinding:['PENNY_REVIEWS_EGRESS','PENNY_LEARNING_EGRESS']}),browser=await chromium.launch(browserOptions()),contexts=[]
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.18.${Math.floor(ip/250)}.${++ip%250+1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`);return response}
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Review owner'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 await json('/api/operator/settings/ai',{monthlyBudgetMicros:10000000,includePrivate:false,choices:[{capability:'extraction',provider:'openai',model:'review-fixture'}]},operator,'PUT')
 await json('/api/operator/boards',{slug:'feedback',name:'Feedback',visibility:'public'},operator,'POST',201)
 const closest=await json('/api/operator/requests',{title:'Scheduled exports',description:'An existing unpublished request.',boardSlug:'feedback'},operator,'POST',201)
 const path='/api/operator/integrations/reviews'
 const connection=s=>{if(s==='trustpilot')trustRefresh='synthetic-trustpilot-refresh-original';return {site:s,listing:listing(s),...(['capterra','trustradius'].includes(s)?{publicUrl:`https://www.${s}.com/products/penny/reviews`,termsAccepted:true}:s==='appstore'?{credential:appleCredential}:s==='googleplay'?{credential:googleCredential}:s==='trustpilot'?{credential:{kind:'trustpilot',clientId:'synthetic-client',clientSecret:'synthetic-client-secret',refreshToken:trustRefresh}}:{token:'synthetic-review-token-'+s})}}
 await send(path,connection('g2'),{},'POST',401);await send(path,connection('g2'),{...operator,Origin:'https://evil.test'},'POST',403)
 await send(path,{...connection('googleplay'),intervalHours:169},operator,'POST',400)
 await send(path,{...connection('capterra'),termsAccepted:false},operator,'POST',400)
 await send(path,{...connection('capterra'),publicUrl:'https://internal.example.test/reviews'},operator,'POST',400)
 const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context);await context.addCookies([{name:Cookie.split('=')[0],value:Cookie.slice(Cookie.indexOf('=')+1),url:origin}]);const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)errors.push('External browser request: '+new URL(request.url()).hostname)})
 await page.goto(origin+'/app/settings#review-capture',{waitUntil:'networkidle'});const panel=page.getByRole('region',{name:'Review capture',exact:true})
 await panel.getByRole('combobox',{name:/^Review site/}).selectOption('g2');await panel.getByLabel('Product listing ID',{exact:true}).fill(listing('g2'));await panel.getByLabel('Vendor access token',{exact:true}).fill('synthetic-review-token-g2');await panel.getByRole('button',{name:'Connect review listing',exact:true}).click();await panel.getByText('Review settings saved.',{exact:true}).waitFor();assert.equal(await panel.getByLabel('Vendor access token',{exact:true}).inputValue(),'')
 for(const s of sites.filter(s=>s!=='g2'))await json(path,connection(s),operator,'POST',201)
 let status=await json(path,undefined,operator);assert.equal(status.connections.length,7);assert.ok(status.connections.every(c=>c.interval_hours===24));assert.ok(status.connections.every(c=>c.ownerName==='Review owner'));assert.ok(!JSON.stringify(status).includes('synthetic-review-token'))
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 let cards=(await json('/api/operator/evidence',undefined,operator)).items;cards=cards.filter(c=>c.review)
 assert.equal(cards.length,7,JSON.stringify(await json(path,undefined,operator)))
 const original=new Map(cards.map(c=>[c.review.site,c])),span='Please add café exports.'
 for(const c of cards){assert.equal(c.sourceType,'review');assert.equal(c.requester,null);assert.equal(c.namedSpeaker,'Casey Reviewer '+c.review.site);assert.match(c.wording,/\[REDACTED:email\]/);assert.ok(Number.isFinite(Date.parse(c.observedAt)));assert.equal(c.review.rating,c.review.site==='producthunt'?null:4);assert.ok(c.review.url.startsWith('https://'));assert.ok(c.review.url.includes(c.review.site==='appstore'?'appstore-review-1':c.review.site+'-review-1')||c.review.site==='g2');const proposals=await json('/api/operator/evidence/'+c.id+'/review-proposals',undefined,operator);assert.equal(proposals.length,1,c.review.site+JSON.stringify(c.review));const p=proposals[0];assert.equal(Buffer.from(c.wording).subarray(p.start_byte,p.end_byte).toString('utf8'),span);assert.equal(p.span,span);assert.equal(p.closest_request_id,closest.id);assert.equal(p.closest_request_slug,closest.slug)}
 await send('/api/operator/requests/'+closest.slug+'/proxy-votes',{contact:{displayName:'Review source',email:'not-a-contact@example.test'},source:'Review',evidenceId:original.get('g2').id},operator,'POST',409)
 assert.equal(modelReads.length,7);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requesters').first('n'),0);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions').first('n'),0);assert.equal(runtime.outbox.length,0);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requests').first('n'),1,'Extraction publishes and creates nothing automatically')
 const report=await json('/api/operator/settings/ai',undefined,operator);assert.equal(report.report.meteredMicros,140)
 const tomorrow=Date.now()+25*3600000
 await runtime.schedule(tomorrow);await runtime.schedule(tomorrow+1000);await runtime.restart();await runtime.schedule(tomorrow+2000)
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_review_sources').first('n'),7);assert.equal(modelReads.length,7,'Re-reading a review never repeats extraction');assert.ok(renewals.includes('googleplay'));assert.ok(renewals.filter(s=>s==='trustpilot').length>1,'Rotated refresh credentials survive the next scheduled read')
 assert.ok(reads.every(r=>!r.url.includes('unselected')))

 // Interrupted authorization exchange is durable and never silently replayed.
 await json(path,connection('googleplay'),operator,'POST',201)
 const authClock=Date.now(),authGate=holdRead('google-oauth'),authorizing=runtime.schedule(authClock);authorizing.catch(()=>{});await authGate.entered
 try{await runtime.restart()}finally{authGate.release()}
 await settled(authorizing);await runtime.schedule(authClock+300001)
 const authorizationReads=renewals.filter(s=>s==='googleplay').length
 await json(path+'/actions',{id:'googleplay/'+listing('googleplay'),action:'retry'},operator);await runtime.schedule(authClock+301000)
 assert.equal((await json(path,undefined,operator)).connections.find(c=>c.site==='googleplay').failure,'reviews_credential_refresh_reconciliation_required');assert.equal(renewals.filter(s=>s==='googleplay').length,authorizationReads)
 await json(path,connection('googleplay'),operator,'POST',201);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_review_sources').first('n'),7)
 // A failed sync survives restart; explicit retry preserves its cursor and receipts.
 mode='rate-limit';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule();await runtime.restart();await runtime.schedule()
 status=await json(path,undefined,operator);assert.equal(status.connections.find(c=>c.site==='g2').state,'failed');assert.equal(status.connections.find(c=>c.site==='g2').failure,'reviews_rate_limited')
 mode='normal';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_review_sources').first('n'),7)
 // Kill the actual emitted Worker during a vendor read, then resume its durable checkpoint.
 await json(path+'/actions',{id:'g2/penny',action:'retry'},operator)
 const clock=Date.now(),gate=holdRead('g2'),running=runtime.schedule(clock);running.catch(()=>{});await gate.entered
 try{await runtime.restart()}finally{gate.release()}
 await settled(running);await runtime.schedule(clock+300001)
 status=await json(path,undefined,operator);assert.equal(status.connections.find(c=>c.site==='g2').failure,'reviews_interrupted_retry_required');const interruptedReads=reads.filter(r=>r.site==='g2').length
 await runtime.restart();await runtime.schedule(clock+301000);assert.equal(reads.filter(r=>r.site==='g2').length,interruptedReads)
 await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule(clock+302000);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_review_sources').first('n'),7)
 // Kill a source-check Worker and keep its interruption visible until deliberate recovery.
 await runtime.db.prepare("UPDATE penny_review_sources SET next_check='2000-01-01T00:00:00Z' WHERE site='appstore'").run()
 const sourceClock=Date.now(),sourceGate=holdRead('appstore'),checking=runtime.schedule(sourceClock);checking.catch(()=>{});await sourceGate.entered
 try{await runtime.restart()}finally{sourceGate.release()}
 await settled(checking);await runtime.schedule(sourceClock+300001)
 let checked=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.review?.site==='appstore');assert.equal(checked.review.checkFailure,'reviews_interrupted_check_retry_required')
 const sourceReads=reads.filter(r=>r.url.includes('/customerReviews/appstore-review-1')).length;await runtime.restart();await runtime.schedule(sourceClock+301000);assert.equal(reads.filter(r=>r.url.includes('/customerReviews/appstore-review-1')).length,sourceReads)
 await json(path+'/actions',{id:'appstore/'+listing('appstore'),action:'retry'},operator);await runtime.schedule(sourceClock+302000)
 checked=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.review?.site==='appstore');assert.equal(checked.review.checkFailure,null)
 // Scope/authority changes during the edge read win before any completion.
 await json(path+'/actions',{id:'trustpilot/penny',action:'retry'},operator);onRead=async s=>{if(s==='trustpilot'){onRead=async()=>{};await json(path+'/actions',{id:'trustpilot/penny',action:'disconnect'},operator)}};await runtime.schedule()
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM penny_review_credentials WHERE connection_id='trustpilot/penny'").first('n'),0);assert.equal((await json(path,undefined,operator)).connections.find(c=>c.site==='trustpilot').state,'disconnected')
 const beforeDisconnect=reads.filter(r=>r.site==='trustpilot').length;await runtime.schedule(tomorrow+5000);assert.equal(reads.filter(r=>r.site==='trustpilot').length,beforeDisconnect)
 await json(path,connection('trustpilot'),operator,'POST',201)

 // A source edit preserves captured text; a removed review loses all excerpts at policy time.
 mode='changed';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule();let g2=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.id===original.get('g2').id);assert.equal(g2.review.sourceState,'changed');assert.equal(g2.wording,original.get('g2').wording)
 mode='removed';await runtime.db.prepare("UPDATE penny_review_sources SET next_check='2000-01-01T00:00:00Z' WHERE site='googleplay'").run();await runtime.schedule(tomorrow+6000)
 let google=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.id===original.get('googleplay').id);assert.equal(google.review.sourceState,'purged');assert.equal(google.wording,'[Source removed]');assert.equal(google.namedSpeaker,null);assert.deepEqual(await json('/api/operator/evidence/'+google.id+'/review-proposals',undefined,operator),[])
 await runtime.schedule(tomorrow+7000);assert.equal(await runtime.db.prepare("SELECT count(*) n FROM audit_entries WHERE action='review.source_purged' AND entity_id=?").bind(google.id).first('n'),1)
 mode='normal'

 // Follow each original-review link against its recorded public-page edge, with no referrer.
 await context.route(/^https:\/\//,async route=>{const wanted=cards.find(c=>{const u=new URL(c.review.url);u.hash='';return u.href===route.request().url()});assert.ok(wanted,'Only an explicitly selected review link may open');assert.equal(route.request().headers().referer,undefined);await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><h1>Original review '+wanted.review.reviewId+'</h1>'})})
 await page.goto(origin+'/app/feedback',{waitUntil:'networkidle'})
 for(const c of cards){const popup=page.waitForEvent('popup');await page.locator('#evidence-'+c.id).getByRole('link',{name:'Open original review',exact:true}).click();const opened=await popup;await opened.getByRole('heading',{name:'Original review '+c.review.reviewId,exact:true}).waitFor();await opened.close()}
 // Exact-SHA screenshots show each changed screen once at both supported widths.
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:900});for(const screen of ['settings','inbox']){
  await page.goto(origin+(screen==='settings'?'/app/settings#review-capture':'/app/feedback'),{waitUntil:'networkidle'});const region=screen==='settings'?panel:page.locator('#evidence-'+g2.id)
  await region.scrollIntoViewIfNeeded();if(screen==='inbox'){await region.getByRole('link',{name:'Open original review',exact:true}).waitFor();assert.equal(await region.getByRole('link',{name:'Open original review',exact:true}).getAttribute('href'),g2.review.url);await region.getByText('Source: changed',{exact:true}).waitFor();await region.getByText(span,{exact:true}).waitFor()}
  await page.evaluate(async()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(axe);assert.deepEqual(await region.evaluate(async element=>(await window.axe.run(element)).violations.filter(v=>['serious','critical'].includes(v.impact))),[]);await page.evaluate(()=>scrollTo(0,0));const clip=await region.boundingBox();assert.ok(clip);await page.screenshot({path:join(output,`review-${screen}-${width}.png`),fullPage:true,clip})
 }}
 // Portable archives retain evidence and exact proposals, omit keys and hold restored work.
 const portable=await json('/api/operator/data/export',undefined,operator),archive=portable.archive
 assert.ok(!Object.hasOwn(archive.tables,'penny_review_credentials'));assert.ok(archive.tables.penny_review_connections.every(c=>c.state==='held'));assert.doesNotMatch(JSON.stringify(archive),/synthetic-review-token|synthetic-review-model-key|reviewer@example.test|OMITTED_/)
 const restored=await startBrowserRuntime()
 try{
  const boot=await fetch(restored.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'})});assert.equal(boot.status,303);const cookie=boot.headers.get('set-cookie').split(';')[0]
  async function post(path,body){const response=await fetch(restored.origin+path,{method:'POST',headers:{Origin:restored.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
  let operation=await post('/api/operator/data/import',portable);for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await post(`/api/operator/data/operations/${operation.operationId}/resume`,{})
  assert.equal(operation.status,'complete');await restored.schedule();assert.equal(await restored.db.prepare('SELECT count(*) n FROM penny_review_credentials').first('n'),0);assert.equal(await restored.db.prepare("SELECT count(*) n FROM penny_review_connections WHERE state='held'").first('n'),7)
 }finally{await restored.close()}
 // Erasure through the data door keeps a wording-free digest that blocks re-import.
 async function dataPost(path,body){const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,...operator,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
 let preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:g2.id});for(let step=0;preview.status==='pending'&&step<100;step++)preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:g2.id,continuation:preview.continuation})
 assert.deepEqual(preview.blockedCopies,[]);assert.equal(preview.counts.penny_review_sources,1);assert.equal(preview.counts.penny_review_proposals,1)
 let erased=await dataPost('/api/operator/data/erasure',{table:'evidence_items',id:g2.id,planHash:preview.planHash});for(let step=0;erased.status!=='complete'&&step<100;step++)erased=await dataPost(`/api/operator/data/operations/${erased.operationId}/resume`,{})
 assert.equal(erased.status,'complete');await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM evidence_items WHERE id=?').bind(g2.id).first('n'),0);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_review_sources').first('n'),6)
 // A killed paid extraction holds its reservation and needs an acknowledged retry.
 mode='extra-review';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator)
 const paidClock=Date.now(),paidGate=holdRead('model'),extracting=runtime.schedule(paidClock);extracting.catch(()=>{});await paidGate.entered
 try{await runtime.restart()}finally{paidGate.release()}
 await settled(extracting);await runtime.schedule(paidClock+300001)
 let extra=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.review?.reviewId==='g2-review-2');assert.equal(extra.review.aiState,'failed');assert.equal(extra.review.aiFailure,'reviews_extraction_interrupted_reconcile_before_retry')
 const paidReads=modelReads.length;await runtime.restart();await runtime.schedule(paidClock+301000);assert.equal(modelReads.length,paidReads)
 await send(path+'/actions',{id:'g2/penny',action:'retry-extraction'},operator,'POST',409)
 mode='bad-span';await json(path+'/actions',{id:'g2/penny',action:'retry-extraction',acknowledgePaidRetry:true},operator);await runtime.schedule()
 extra=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.id===extra.id);assert.equal(extra.review.aiFailure,'reviews_span_invalid');assert.deepEqual(await json('/api/operator/evidence/'+extra.id+'/review-proposals',undefined,operator),[])
 mode='normal';await json(path+'/actions',{id:'g2/penny',action:'retry-extraction',acknowledgePaidRetry:true},operator);await runtime.schedule();assert.equal((await json('/api/operator/evidence/'+extra.id+'/review-proposals',undefined,operator)).length,1)
 await json('/api/operator/settings/ai',{monthlyBudgetMicros:0,includePrivate:false,choices:[{capability:'extraction',provider:'openai',model:'review-fixture'}]},operator,'PUT')
 mode='budget';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule()
 const budgetReview=(await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.review?.reviewId==='g2-review-3');assert.ok(budgetReview);assert.equal(budgetReview.review.aiFailure,'ai_budget_exhausted')
 await json('/api/operator/evidence/'+budgetReview.id+'/review',{reviewed:true,reason:'Manual triage remains available without AI.'},operator)
 assert.equal((await json('/api/operator/evidence',undefined,operator)).items.find(c=>c.id===budgetReview.id).reviewState,'reviewed');const manual=await json('/api/operator/evidence/'+budgetReview.id+'/request',{title:'Review improvements',description:'An operator chose this request.',boardSlug:'feedback'},operator,'POST',201);assert.equal(await runtime.db.prepare('SELECT public_state FROM requests WHERE id=?').bind(manual.id).first('public_state'),'unpublished');assert.equal(runtime.outbox.length,0)
 mode='revoked';await json(path+'/actions',{id:'g2/penny',action:'retry'},operator);await runtime.schedule();assert.equal((await json(path,undefined,operator)).connections.find(c=>c.site==='g2').failure,'reviews_access_revoked');assert.equal(await runtime.db.prepare("SELECT count(*) n FROM penny_review_sources WHERE site='g2' AND source_state<>'purged'").first('n'),0,'Explicit listing access revocation purges every retained excerpt at its policy window')
 const visitor=await browser.newPage();await visitor.goto(origin+'/portal/feedback',{waitUntil:'networkidle'});assert.doesNotMatch(await visitor.content(),/Casey Reviewer|reviewer@example|café exports|g2-review|trustpilot-review/);await visitor.close();await send(path,undefined,{},'GET',401);assert.deepEqual(errors,[])
 console.log('CAP-020 public-door journey passed: seven providers, exact-byte proposals, private replay-safe capture, durable recovery, source changes/removal, responsive UI, archives, restore holds and erasure.')
 function holdRead(site){let enter,release;const entered=new Promise(r=>enter=r),waiting=new Promise(r=>release=r);onRead=async s=>{if(s===site){onRead=async()=>{};enter();await waiting}};return {entered,release}}
 async function settled(promise){await Promise.race([promise.catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))])}
}catch(error){for(const c of contexts)for(const p of c.pages()){console.error('FAILURE_URL',p.url());console.error((await p.locator('body').innerText()).slice(-14000));await p.screenshot({path:join(output,'failure.png'),fullPage:true})}throw error}finally{for(const c of contexts)await c.close();await browser.close();await runtime.close()}
