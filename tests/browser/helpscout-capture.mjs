import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
import {helpScoutEdge} from '../fixtures/helpscout/edge.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/helpscout-capture');assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const config={mailboxId:12,tag:'feedback',sidebarUserId:42,purgeDays:0,clientId:'synthetic-helpscout-client-id',clientSecret:'synthetic-helpscout-client-secret',appSecret:'synthetic-helpscout-app-secret',webhookSecret:'synthetic-helpscout-webhook-secret'}
const edge=helpScoutEdge(config),runtime=await startBrowserRuntime({networkWorker:edge.worker,networkBinding:'PENNY_HELPSCOUT_EGRESS'}),browser=await chromium.launch(browserOptions()),contexts=[]
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.18.${Math.floor(ip/250)}.${++ip%250+1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`);return response}
 const json=async(...args)=>(await send(...args)).json(),path='/api/operator/integrations/helpscout',door='/api/integrations/helpscout'
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Penny fixture business',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 await json('/api/operator/boards',{slug:'feedback',name:'Feedback',visibility:'public'},operator,'POST',201)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 const existing=await json('/api/operator/requests',{title:'Scheduled CSV exports',description:'Support scheduled exports.',boardSlug:'feedback'},operator,'POST',201)
 await json(`/api/operator/requests/${existing.slug}/moderate`,{verdict:'approved',title:'Scheduled CSV exports',description:'Support scheduled exports.',boardSlug:'feedback'},operator)
 await send(path,config,{},'POST',401);await send(path,config,{...operator,Origin:'https://evil.test'},'POST',403)
 const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context);await context.addCookies([{name:Cookie.split('=')[0],value:Cookie.slice(Cookie.indexOf('=')+1),url:origin}]);const settings=await context.newPage(),errors=[];settings.on('pageerror',e=>errors.push(e.message))
 await settings.goto(origin+'/app/settings#helpscout-capture',{waitUntil:'networkidle'});const panel=settings.getByRole('region',{name:'Help Scout capture',exact:true})
 await panel.getByText('Connect or replace credentials',{exact:true}).click()
 for(const [label,key] of [['Help Scout mailbox ID','mailboxId'],['Your Help Scout user ID','sidebarUserId'],['Automatic capture tag','tag'],['OAuth application ID','clientId'],['OAuth application secret','clientSecret'],['Dynamic App secret','appSecret'],['Webhook secret','webhookSecret']])await panel.getByLabel(label,{exact:true}).fill(String(config[key]))
 await panel.getByRole('button',{name:'Connect Help Scout',exact:true}).click();await panel.getByText('Help Scout settings saved.',{exact:true}).waitFor()
 assert.equal((await json(path,undefined,operator)).credentialStored,true)
 async function signed(kind,value,secret,{bad=false,raw}={}){const body=raw??JSON.stringify(value);return fetch(origin+door+'/'+kind,{method:'POST',headers:{'CF-Connecting-IP':`198.18.${Math.floor(ip/250)}.${++ip%250+1}`,'Content-Type':'application/json','X-HelpScout-Signature':bad?'a'.repeat(27)+'=':createHmac('sha1',secret).update(body).digest('base64')},body})}
 const webhook=id=>({id,mailboxId:config.mailboxId,tags:[{tag:config.tag}],preview:'UNTRUSTED_WEBHOOK_WORDING'})
 async function sidebar(id,user=config.sidebarUserId){const response=await signed('sidebar',{ticket:{id},mailbox:{id:config.mailboxId},user:{id:user}},config.appSecret);assert.equal(response.status,200,await response.clone().text());const {html}=await response.json(),url=new URL(/src="([^"]+)"/.exec(html)[1].replaceAll('&amp;','&'));return {url:url.href,token:new URLSearchParams(url.hash.slice(1)).get('context')}}
 async function act(token,body,status=200){return json(door+'/action',body,{Authorization:'Bearer '+token},'POST',status)}
 assert.equal((await signed('webhook',null,config.webhookSecret,{bad:true,raw:'{malformed'})).status,401)
 assert.equal((await signed('webhook',null,config.webhookSecret,{raw:'{malformed'})).status,400)
 assert.equal((await signed('sidebar',{ticket:{id:101},mailbox:{id:12},user:{id:99}},config.appSecret)).status,403)
 for(const item of [{...webhook(999),mailboxId:99},{...webhook(998),tags:[{tag:'other'}]}])assert.equal((await signed('webhook',item,config.webhookSecret)).status,202)
 const before=(await json('/api/operator/evidence',undefined,operator)).items.length
 for(let n=0;n<3;n++)assert.equal((await signed('webhook',webhook(101),config.webhookSecret)).status,202)
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/101').length,1)
 assert.deepEqual(edge.calls.filter(c=>c.path==='/v2/conversations/101/threads').map(c=>c.query),['','?page=2'])
 assert.equal(edge.calls.some(c=>/999|998/.test(c.path)),false)
 const first=(await json('/api/operator/evidence',undefined,operator)).items.find(e=>e.sourceLabel==='Help Scout conversation 101');assert.ok(first)
 assert.match(first.wording,/\[REDACTED:email\]/);assert.equal(first.namedSpeaker,'Morgan Lopez');assert.equal(first.requester.displayName,'Riley Chen');assert.equal(first.account.name,'Harbor customer company');assert.equal(first.reviewState,'unreviewed');assert.equal(first.helpScout.sourceState,'current')
 const a=await sidebar(101),side=await context.newPage();side.on('pageerror',e=>errors.push(e.message));await side.goto(a.url,{waitUntil:'networkidle'})
 await side.getByLabel('Find a request',{exact:true}).fill('Scheduled CSV');await side.getByRole('button',{name:'Search requests',exact:true}).click();await side.getByLabel('Request to link',{exact:true}).selectOption(existing.id);await side.getByRole('button',{name:'Link conversation',exact:true}).click();await side.locator('#linked').filter({hasText:'Scheduled CSV exports · open'}).waitFor()
 await act(a.token,{action:'link',requestId:existing.id})
 await side.getByLabel('Source justifying this vote',{exact:true}).fill('Riley requested exports in conversation 101.');await side.getByLabel('I reviewed the linked request and the conversation’s customer.').check();await side.getByRole('button',{name:'Record proxy vote',exact:true}).click();await side.getByRole('status').filter({hasText:'Customer vote recorded once.'}).waitFor()
 await act(a.token,{action:'vote',source:'Repeated vote in the same conversation',reviewed:true})
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_proxy_votes').first('n'),1)
 const second=await sidebar(102);await act(second.token,{action:'capture'});await runtime.schedule();await runtime.restart()
 const create={action:'create',title:'One conversation request',description:'Build a monthly export schedule.',boardSlug:'feedback'}
 const created=await act(second.token,create),duplicate=await act(second.token,create);assert.equal(created.id??created.requestId,duplicate.id??duplicate.requestId)
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM requests WHERE title='One conversation request'").first('n'),1)
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_companies').first('n'),1)
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM requester_addresses WHERE email='customer@example.test'").first('n'),1,'Embedded provider emails reuse one unverified requester')
 const person=await runtime.db.prepare("SELECT * FROM requester_addresses WHERE email='customer@example.test'").first();assert.equal(person.verified_at,null);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions').first('n'),0)
 assert.equal((await json('/api/operator/evidence',undefined,operator)).items.length,before+2)
 assert.equal(edge.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/reply')).length,0,'Drafts never send themselves')
 await json(`/api/operator/requests/${existing.slug}/status-updates`,{status:'shipped',body:'Scheduled exports are available.',idempotencyKey:'fixture-shipped'},operator)
 await runtime.schedule();await side.getByRole('button',{name:'Refresh progress and status',exact:true}).click();await side.locator('#linked').filter({hasText:'Scheduled CSV exports · shipped'}).waitFor();const draft=(await act(a.token,{action:'view'})).replies[0];assert.ok(draft)
 await act(a.token,{action:'send',replyId:draft.id,text:'Unreviewed reply',reviewed:false},400)
 await act(a.token,{action:'send',replyId:draft.id,text:'Harbor customer company is our private account name.',reviewed:true},422)
 await side.getByLabel('Edited reply',{exact:true}).fill('Scheduled exports have shipped. Thank you for your feedback.');await side.getByLabel('I reviewed this exact reply and approve sending it to this customer.').check();await side.getByRole('button',{name:'Send reviewed reply',exact:true}).click();await side.getByRole('status').filter({hasText:'Reviewed reply sent.'}).waitFor()
 await act(a.token,{action:'send',replyId:draft.id,text:'Try again',reviewed:true},409)
 assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/101/reply').length,1)
 const delivered=edge.calls.find(c=>c.path==='/v2/conversations/101/reply');assert.equal(JSON.parse(delivered.body).text,'Scheduled exports have shipped. Thank you for your feedback.')
 await side.getByRole('button',{name:'Refresh progress and status',exact:true}).click();await side.locator('#reply-state').filter({hasText:'Reply sent.'}).waitFor()
 // An ambiguous customer send remains visible after an actual Worker restart.
 await json(`/api/operator/requests/${existing.slug}/status-updates`,{status:'in_progress',body:'Further export improvements are in progress.',idempotencyKey:'fixture-progress'},operator)
 await runtime.schedule();await side.getByRole('button',{name:'Refresh progress and status',exact:true}).click()
 edge.sendStatus=503
 await side.getByLabel('Edited reply',{exact:true}).fill('We are improving scheduled exports.');await side.getByLabel('I reviewed this exact reply and approve sending it to this customer.').check();await side.getByRole('button',{name:'Send reviewed reply',exact:true}).click()
 await side.getByRole('alert').filter({hasText:'Delivery is uncertain.'}).waitFor()
 await runtime.restart();await runtime.schedule()
 const ambiguous=await sidebar(101);await side.goto('about:blank');await side.goto(ambiguous.url,{waitUntil:'networkidle'});await side.locator('#reply-state').filter({hasText:'Delivery is uncertain.'}).waitFor();assert.match(await side.locator('#reply-state').innerText(),/Check this conversation in Help Scout.*will not retry/);assert.equal(await side.getByRole('button',{name:'Send reviewed reply',exact:true}).isDisabled(),true)
 const uncertain=(await act(ambiguous.token,{action:'view'})).replies[0];assert.equal(uncertain.state,'unknown');await act(ambiguous.token,{action:'send',replyId:uncertain.id,text:'Do not replay',reviewed:true},409)
 assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/101/reply').length,2);edge.sendStatus=201
 // One failed provider read remains visible through restart, then explicit retry.
 edge.modes.set(103,429);await signed('webhook',webhook(103),config.webhookSecret);await runtime.schedule();await runtime.restart();await runtime.schedule();assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/103').length,1)
 edge.modes.delete(103);await json(path+'/control',{action:'retry',conversationId:103},operator);await runtime.schedule()
 // Killing the built Worker during a read leaves a durable failed checkpoint.
 let releaseRead,enteredRead;const entered=new Promise(resolve=>{enteredRead=resolve}),held=new Promise(resolve=>{releaseRead=resolve})
 edge.onRead=async id=>{if(id===106){edge.onRead=async()=>{};enteredRead();await held}}
 await signed('webhook',webhook(106),config.webhookSecret);const interrupted=runtime.schedule();interrupted.catch(()=>{});await Promise.race([entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Provider read never started')),10000);timer.unref()})])
 try{await runtime.restart()}finally{releaseRead()}
 await interrupted.catch(()=>{});await runtime.schedule(Date.now()+300001)
 assert.equal((await json(path,undefined,operator)).jobs.find(j=>j.conversation_id===106).failure,'interrupted_read_retry_required');await runtime.restart();await runtime.schedule();assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/106').length,1)
 await json(path+'/control',{action:'retry',conversationId:106},operator);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_captures WHERE conversation_id=106 AND evidence_id IS NOT NULL').first('n'),1)
 // Pausing while a provider GET is in flight fences the completion transaction.
 edge.onRead=async id=>{if(id===104){edge.onRead=async()=>{};await json(path+'/control',{action:'pause'},operator)}};await signed('webhook',webhook(104),config.webhookSecret);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT evidence_id FROM penny_helpscout_captures WHERE conversation_id=104').first('evidence_id'),null)
 await act(a.token,{action:'view'},409);await json(path+'/control',{action:'resume'},operator)
 const next=await sidebar(101)
 const exported=await json('/api/operator/data/export',undefined,operator),archive=exported.archive;assert.ok(!Object.hasOwn(archive.tables,'penny_helpscout_secrets'));assert.ok(!Object.hasOwn(archive.tables,'penny_helpscout_contexts'));assert.ok(archive.tables.penny_helpscout_connection.every(c=>c.enabled===0))
 const archiveText=JSON.stringify(archive);for(const value of [config.clientSecret,config.appSecret,config.webhookSecret,'synthetic-helpscout-access-token','OMITTED_PRIVATE_NOTE','OMITTED_PREVIEW','OMITTED_COMPANY_DESCRIPTION','UNTRUSTED_WEBHOOK_WORDING'])assert.equal(archiveText.includes(value),false,value+' stays out of product archive')
 // A portable restore has source data but no credential or active work.
 const restored=await startBrowserRuntime()
 try{
  const restoredSend=async(path,body,cookie,statuses=[200])=>{const response=await fetch(restored.origin+path,{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});assert.ok(statuses.includes(response.status),await response.clone().text());return response}
  const boot=await restoredSend('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'},null,[303]),cookie=boot.headers.get('set-cookie').split(';')[0]
  let result=await (await restoredSend('/api/operator/data/import',{archive,journal:exported.journal},cookie,[200,202])).json()
  for(let step=0;result.status!=='complete'&&step<100;step++)result=await (await restoredSend(`/api/operator/data/operations/${result.operationId}/resume`,{},cookie,[200,202])).json()
  assert.equal(result.status,'complete');assert.equal(await restored.db.prepare('SELECT count(*) n FROM penny_helpscout_secrets').first('n'),0);await restored.schedule();assert.equal(await restored.db.prepare('SELECT enabled FROM penny_helpscout_connection').first('enabled'),0)
 }finally{await restored.close()}
 // A later public revision cannot hide unresolved delivery from this conversation.
 await side.goto('about:blank');await side.goto(next.url,{waitUntil:'networkidle'});await side.locator('#reply-state').filter({hasText:'Delivery is uncertain.'}).waitFor()
 await json(`/api/operator/requests/${existing.slug}/status-updates`,{status:'planned',body:'Additional export controls are planned.',idempotencyKey:'fixture-planned'},operator)
 await runtime.schedule();await side.getByRole('button',{name:'Refresh progress and status',exact:true}).click();await side.locator('#reply-state').filter({hasText:'Draft ready for review.'}).waitFor();await side.locator('#reply-warning').filter({hasText:'An earlier reply still has uncertain delivery.'}).waitFor()
 await runtime.restart();assert.equal((await act(next.token,{action:'view'})).deliveryUncertain,true);assert.equal(edge.calls.filter(c=>c.path==='/v2/conversations/101/reply').length,2)
 // Visual proof uses the same final screens once at each requested width.
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 await side.getByRole('button',{name:'Refresh progress and status',exact:true}).click();assert.equal(await side.getByRole('alert').isVisible(),false);await side.locator('#reply-warning').filter({hasText:'An earlier reply still has uncertain delivery.'}).waitFor()
 for(const width of [1440,390]){for(const [page,label] of [[settings,'helpscout-settings'],[side,'helpscout-sidebar']]){await page.setViewportSize({width,height:width===390?844:900});if(page===settings){await page.reload({waitUntil:'networkidle'});await panel.scrollIntoViewIfNeeded();await settings.evaluate(()=>window.scrollBy(0,-120))}await page.evaluate(axe);assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(output,`${label}-${width}.png`),fullPage:page!==settings})}}
 // Source change keeps captured wording; removal purges all versions at the policy window.
 edge.modes.set(101,'changed');await runtime.schedule(Date.now()+3600001);assert.equal((await act(next.token,{action:'view'})).capture.sourceState,'changed');assert.match((await json('/api/operator/evidence',undefined,operator)).items.find(e=>e.id===first.id).wording,/scheduled CSV/)
 // All source-loss doors, including a merged conversation, use removal custody.
 for(const id of [107,108]){await signed('webhook',webhook(id),config.webhookSecret)}
 await runtime.schedule()
 const lost=[[101,'threads-403'],[103,'threads-404'],[106,'threads-410'],[107,'threads-301'],[108,301]]
 const evidenceById=new Map()
 for(const [id] of lost){const selected=await sidebar(id);await act(selected.token,{action:'link',requestId:existing.id});const view=await act(selected.token,{action:'view'});evidenceById.set(id,view.capture.evidenceId);assert.ok(view.replies.length)}
 const removalReadsStart=edge.calls.length
 for(const [id,mode] of lost)edge.modes.set(id,mode)
 await runtime.schedule(Date.now()+7200002)
 for(const [id] of lost){const capture=await runtime.db.prepare('SELECT source_state,state,failure FROM penny_helpscout_captures WHERE conversation_id=?').bind(id).first();assert.deepEqual(capture,{source_state:'removed',state:'done',failure:'source_removed'})}
 assert.equal(edge.calls.slice(removalReadsStart).some(c=>c.path==='/v2/conversations/999'),false,'Merged-conversation redirects never get followed')
 assert.equal(edge.calls.slice(removalReadsStart).some(c=>c.path==='/v2/conversations/108/threads'||c.path.startsWith('/v2/customers/')),false,'No further source or customer reads after access loss')
 await runtime.restart();await runtime.schedule(Date.now()+7200003)
 for(const evidenceId of evidenceById.values()){
  const versions=(await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(evidenceId).all()).results;assert.ok(versions.length);assert.ok(versions.every(v=>v.wording==='[Source removed]'))
  const replies=(await runtime.db.prepare('SELECT body,edited_body,state FROM penny_helpscout_replies WHERE evidence_id=?').bind(evidenceId).all()).results;assert.ok(replies.length);assert.ok(replies.every(r=>r.body==='[Source removed]'&&r.edited_body===null&&r.state==='held'))
 }
 assert.equal((await json('/api/operator/evidence',undefined,operator)).items.find(e=>e.id===first.id).wording,'[Source removed]')
 const publicBytes=JSON.stringify(await json('/api/public/requests/'+existing.slug));for(const value of ['customer@example.test','Riley Chen','Morgan Lopez','Harbor customer company','secure.helpscout.net'])assert.equal(publicBytes.includes(value),false)
 // Erase the remaining live capture through the native door; already-purged
 // items share the removal marker, which native erasure conservatively holds.
 const erasableId=await runtime.db.prepare('SELECT evidence_id FROM penny_helpscout_captures WHERE conversation_id=102').first('evidence_id')
 const erasePost=async(path,body)=>{const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,...operator,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
 let preview=await erasePost('/api/operator/data/erasure/preview',{table:'evidence_items',id:erasableId})
 for(let step=0;preview.status==='pending'&&step<100;step++)preview=await erasePost('/api/operator/data/erasure/preview',{table:'evidence_items',id:erasableId,continuation:preview.continuation})
 assert.deepEqual(preview.blockedCopies,[])
 let erased=await erasePost('/api/operator/data/erasure',{table:'evidence_items',id:erasableId,planHash:preview.planHash})
 for(let step=0;erased.status!=='complete'&&step<100;step++)erased=await erasePost(`/api/operator/data/operations/${erased.operationId}/resume`,{})
 assert.equal(erased.status,'complete');assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_captures WHERE evidence_id=?').bind(erasableId).first('n'),0)
 await signed('webhook',webhook(102),config.webhookSecret);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_captures WHERE conversation_id=102').first('n'),0)
 await json(path,undefined,operator,'DELETE');assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_secrets').first('n'),0);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_helpscout_contexts').first('n'),0);await act(next.token,{action:'capture'},409);const count=edge.calls.length;await signed('webhook',webhook(105),config.webhookSecret);await runtime.schedule();assert.equal(edge.calls.length,count)
 assert.deepEqual(errors,[]);console.log('Help Scout: one HTTP/browser journey passed; before=0 after=6 captured conversations; paginated capture, embedded emails, persistent uncertain delivery and source-loss purge; no live provider account used')
}finally{for(const c of contexts)await c.close();await browser.close();await runtime.close()}
