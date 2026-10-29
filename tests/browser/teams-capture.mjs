import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/teams-capture')
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const key=generateKeyPairSync('rsa',{modulusLength:2048}),publicKey={...key.publicKey.export({format:'jwk'}),kid:'recorded-bot-key',use:'sig',endorsements:['msteams']}
const team='11111111-1111-4111-8111-111111111111',channel='19:feedback@thread.tacv2',other='19:unselected@thread.tacv2',serviceUrl='https://smba.trafficmanager.net/teams/'
const config={applicationId:'22222222-2222-4222-8222-222222222222',tenantId:'33333333-3333-4333-8333-333333333333',clientSecret:'synthetic-entra-application-secret'}
const ids=['1700000000001','1700000000002','1700000000003','1700000000004','1700000000005','1700000000006']
const reads=[],modes=new Map();let onRead=async()=>{},endorsements=['msteams']
const edge={name:'teams-network-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const response=await fetch(wire.url,{method:wire.method,headers:wire.headers,body:wire.method==='POST'?wire.body:undefined,redirect:'manual'});return {status:response.status,headers:{},body:await response.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
 const url=new URL(request.url)
 if(url.hostname==='login.botframework.com'){
  assert.equal(request.method,'GET')
  if(url.pathname.endsWith('/openidconfiguration'))return Response.json({issuer:'https://api.botframework.com',jwks_uri:'https://login.botframework.com/v1/.well-known/keys'})
  assert.equal(url.pathname,'/v1/.well-known/keys');return Response.json({keys:[{...publicKey,endorsements}]})
 }
 if(url.hostname==='login.microsoftonline.com'){
  assert.equal(request.method,'POST');assert.equal(url.pathname,'/'+config.tenantId+'/oauth2/v2.0/token')
  const form=new URLSearchParams(await request.text());assert.equal(form.get('client_id'),config.applicationId);assert.equal(form.get('client_secret'),config.clientSecret);assert.equal(form.get('scope'),'https://graph.microsoft.com/.default')
  return Response.json({access_token:'recorded-graph-access-token',token_type:'Bearer'})
 }
 assert.equal(url.hostname,'graph.microsoft.com');assert.equal(request.method,'GET');assert.equal(request.headers.get('Authorization'),'Bearer recorded-graph-access-token')
 const path=decodeURIComponent(url.pathname),id=path.split('/').at(-1)
 assert.ok(path.startsWith('/v1.0/teams/'+team+'/channels/'+channel+'/messages/'),'No out-of-scope read')
 if(id===ids[1])assert.ok(path.endsWith('/messages/'+ids[0]+'/replies/'+id))
 reads.push(id);const mode=modes.get(id);await onRead(id)
 if(mode==='deleted')return Response.json({id,deletedDateTime:'2026-10-29T12:30:00Z'})
 if(typeof mode==='number')return Response.json({error:'Recorded provider refusal'},{status:mode})
 return Response.json({id,webUrl:`https://teams.microsoft.com/l/message/${encodeURIComponent(channel)}/${id}?groupId=${team}&tenantId=${config.tenantId}`,createdDateTime:'2026-10-28T12:30:00Z',lastModifiedDateTime:mode==='changed'?'2026-10-29T12:30:00Z':'2026-10-28T12:30:00Z',deletedDateTime:mode==='deleted'?'2026-10-29T12:30:00Z':null,body:{contentType:'html',content:mode==='changed'?'<p>Edited source text</p>':`<p>Please add scheduled exports ${id}. Contact source.person@example.test.</p>`},from:{user:{id:'source-author-'+id,displayName:'Source author '+id}},attachments:[{content:'OMITTED_ATTACHMENT'}],replies:[{body:'OMITTED_SURROUNDING_MESSAGE'}]})
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_TEAMS:JSON.stringify(config)},networkWorker:edge,networkBinding:'PENNY_TEAMS_EGRESS'}),browser=await chromium.launch(browserOptions())
let context
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.18.${Math.floor(ip/250)}.${++ip%250+1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.ok((Array.isArray(status)?status:[status]).includes(response.status),`${method} ${path}: ${await response.clone().text()}`);return response
 }
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 const settings={teamId:team,channelIds:[channel],enabled:true,purgeDays:0}
 await send('/api/operator/integrations/teams',settings,{},'PUT',401)
 await send('/api/operator/integrations/teams',settings,{...operator,Origin:'https://evil.test'},'PUT',403)
 context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies([{name:Cookie.split('=')[0],value:Cookie.slice(Cookie.indexOf('=')+1),url:origin}]);const page=await context.newPage(),errors=[]
 page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)errors.push('External browser request')})
 await page.goto(origin+'/app/settings#teams-capture',{waitUntil:'networkidle'});const panel=page.getByRole('region',{name:'Microsoft Teams',exact:true})
 await panel.getByLabel('Teams group ID',{exact:true}).fill(team);await panel.getByLabel('Selected Teams channel IDs',{exact:true}).fill(channel);await panel.getByLabel('Purge removed source text after days',{exact:true}).fill('0');await panel.getByLabel('Enable Teams capture',{exact:true}).check();await panel.getByRole('button',{name:'Save Teams capture',exact:true}).click();await panel.getByText('Teams settings saved.',{exact:true}).waitFor()
 const action=(id,chosen=channel,parent=null)=>({type:'invoke',name:'composeExtension/submitAction',channelId:'msteams',serviceUrl,from:{id:'29:capturing-member',name:'Trigger member'},channelData:{tenant:{id:config.tenantId},team:{id:'19:team@thread.tacv2'},channel:{id:chosen}},value:{commandId:'sendToPenny',messagePayload:{id,replyToId:parent,body:{content:'UNTRUSTED_ACTION_WORDING'}}}})
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
 function token(overrides={},header={}){
  const text=encode({alg:'RS256',kid:publicKey.kid,...header})+'.'+encode({iss:'https://api.botframework.com',aud:config.applicationId,nbf:Math.floor(Date.now()/1000)-60,exp:Math.floor(Date.now()/1000)+3600,serviceurl:serviceUrl,...overrides})
  return text+'.'+sign('RSA-SHA256',Buffer.from(text),key.privateKey).toString('base64url')
 }
 async function signed(body,{authorization='Bearer '+token(),raw}={}){return fetch(origin+'/api/integrations/teams/messages',{method:'POST',headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:raw??JSON.stringify(body)})}
 assert.equal((await signed(null,{authorization:null,raw:'{malformed'})).status,401,'Unsigned request refused before parsing')
 assert.equal((await signed(null,{raw:'{malformed'})).status,400)
 for(const authorization of ['Bearer '+token({exp:1}), 'Bearer '+token({nbf:Math.floor(Date.now()/1000)+600}),'Bearer '+token({aud:team}),'Bearer '+token({iss:'https://forged.test'}),'Bearer '+token({}, {alg:'none'}),'Bearer '+token().slice(0,-10)+'invalidxxx'])assert.equal((await signed(action(ids[0]),{authorization})).status,401)
 endorsements=['other-channel'];assert.equal((await signed(action(ids[0]))).status,401);endorsements=['msteams']
 assert.equal((await signed({...action(ids[0]),serviceUrl:'https://evil.test/'})).status,403)
 const wrongTenant=action(ids[0]);wrongTenant.channelData.tenant.id=team;assert.equal((await signed(wrongTenant)).status,403)
 assert.equal((await signed({type:'conversationUpdate',channelId:'msteams',serviceUrl,channelData:{tenant:{id:config.tenantId}}})).status,200)
 for(let n=0;n<2;n++){assert.equal((await signed(action(ids[0]))).status,200);assert.equal((await signed(action(ids[1],channel,ids[0]))).status,200)}
 assert.equal((await signed(action(ids[2],other))).status,200)
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 let status=await json('/api/operator/integrations/teams',undefined,operator)
 assert.equal(status.jobs.filter(job=>job.state==='done').length,2,JSON.stringify(status))
 assert.deepEqual(reads.sort(),ids.slice(0,2),'Only the two selected messages were read, once')
 const cards=()=>json('/api/operator/evidence',undefined,operator)
 let items=(await cards()).items.filter(item=>item.sourceType==='teams')
 assert.equal(items.length,2)
 for(const item of items){assert.equal(item.reviewState,'unreviewed');assert.ok(item.namedSpeaker.startsWith('Source author '));assert.equal(item.teams.capturer,'Trigger member');assert.equal(item.requester,null);assert.match(item.wording,/\[REDACTED:email\]/);assert.doesNotMatch(JSON.stringify(item),/source.person@example|OMITTED_|UNTRUSTED_|<p>/);assert.ok(item.teams.jumpUrl.startsWith('https://teams.microsoft.com/l/message/'))}
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions').first('n'),0);assert.equal(runtime.outbox.length,0)
 // Explicit retry after a rejected provider read; stop and pause fence work.
 modes.set(ids[2],429);await signed(action(ids[2]));await runtime.schedule();await runtime.restart();await runtime.schedule()
 status=await json('/api/operator/integrations/teams',undefined,operator);assert.equal(status.jobs.find(job=>job.message_id===ids[2]).failure,'teams_rate_limited');assert.equal(reads.filter(id=>id===ids[2]).length,1)
 modes.delete(ids[2]);const jobId=id=>`${team}/${channel}/${id}`
 await json('/api/operator/integrations/teams/jobs',{id:jobId(ids[2]),action:'retry'},operator);await runtime.schedule()
 await signed(action(ids[4]));onRead=async id=>{if(id===ids[4]){onRead=async()=>{};await json('/api/operator/integrations/teams',{...settings,enabled:false},operator,'PUT')}}
 await runtime.schedule().catch(error=>assert.match(error.message,/scheduled/));assert.equal((await cards()).items.filter(item=>item.sourceLabel==='Teams message '+ids[4]).length,0)
 await json('/api/operator/integrations/teams',settings,operator,'PUT');await json('/api/operator/integrations/teams/jobs',{id:jobId(ids[4]),action:'stop'},operator)
 function holdRead(id){
  let enter,release;const entered=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Source read did not start')),20000);enter=()=>{clearTimeout(timer);resolve()}}),held=new Promise(resolve=>{const timer=setTimeout(resolve,25000);release=()=>{clearTimeout(timer);resolve()}})
  onRead=async chosen=>{if(chosen===id){onRead=async()=>{};enter();await held}}
  return {entered,release}
 }
 const settle=promise=>promise.catch(error=>assert.match(error.message,/scheduled|disposed|aborted|disconnect|fetch failed/i))
 // Kill a real emitted Worker while its capture is at the network edge.
 await signed({...action(ids[3]),from:{id:'29:capturing-member',name:'trigger.secret@example.test'}})
 let clock=Date.now(),held=holdRead(ids[3]),pending=runtime.schedule(clock);pending.catch(()=>{});await held.entered
 try{await runtime.restart()}finally{held.release()}await settle(pending);await runtime.schedule(clock+300001)
 status=await json('/api/operator/integrations/teams',undefined,operator);assert.equal(status.jobs.find(job=>job.message_id===ids[3]).failure,'interrupted_read_retry_required')
 await json('/api/operator/integrations/teams/jobs',{id:jobId(ids[3]),action:'retry'},operator);await runtime.schedule()
 assert.equal((await cards()).items.find(item=>item.sourceLabel==='Teams message '+ids[3]).teams.capturer,'[REDACTED:email]')
 // A concurrent or superseded source check must not resurrect removed text.
 clock=Date.now()+3600001;modes.set(ids[0],'changed');held=holdRead(ids[0]);pending=runtime.schedule(clock);pending.catch(()=>{});await held.entered
 const count=reads.filter(id=>id===ids[0]).length;await runtime.schedule(clock+1000);assert.equal(reads.filter(id=>id===ids[0]).length,count)
 await runtime.schedule(clock+300001)
 assert.equal((await cards()).items.find(item=>item.sourceLabel==='Teams message '+ids[0]).teams.checkFailure,'interrupted_source_check_retry_required')
 await json('/api/operator/integrations/teams',settings,operator,'PUT');modes.set(ids[0],404);await runtime.schedule(clock+301000);await runtime.schedule(clock+302000);held.release();await settle(pending)
 assert.equal((await cards()).items.find(item=>item.sourceLabel==='Teams message '+ids[0]).teams.sourceState,'purged')
 modes.set(ids[1],'changed');modes.set(ids[2],'deleted');await runtime.schedule(clock+7200000);await runtime.schedule(clock+7201000)
 items=(await cards()).items.filter(item=>item.sourceType==='teams')
 assert.equal(items.find(item=>item.sourceLabel==='Teams message '+ids[1]).teams.sourceState,'changed');assert.match(items.find(item=>item.sourceLabel==='Teams message '+ids[1]).wording,/Please add scheduled exports/)
 assert.equal(items.find(item=>item.sourceLabel==='Teams message '+ids[2]).wording,'[Source removed]')
 await signed(action(ids[5]));const portable=await json('/api/operator/data/export',undefined,operator),archive=portable.archive
 assert.equal(archive.tables.penny_teams_settings[0].enabled,0);assert.equal(archive.tables.penny_teams_jobs.find(job=>job.message_id===ids[5]).state,'held')
 assert.ok(!JSON.stringify(archive).includes(config.clientSecret));assert.ok(!JSON.stringify(archive).includes('trigger.secret@example.test'));assert.equal(archive.tables.penny_teams_sources.length,4)
 const restored=await startBrowserRuntime()
 try{
  const boot=await fetch(restored.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'})});assert.equal(boot.status,303)
  const cookie=boot.headers.get('set-cookie').split(';')[0]
  async function post(path,body){const r=await fetch(restored.origin+path,{method:'POST',headers:{Origin:restored.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(r.status),await r.clone().text());return r.json()}
  let operation=await post('/api/operator/data/import',portable)
  for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await post(`/api/operator/data/operations/${operation.operationId}/resume`,{})
  assert.equal(operation.status,'complete');await restored.schedule();assert.equal(await restored.db.prepare('SELECT enabled FROM penny_teams_settings').first('enabled'),0);assert.equal(await restored.db.prepare('SELECT count(*) n FROM penny_teams_sources').first('n'),4)
 }finally{await restored.close()}
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 // Assertions above use one width; changed screens are shown once at both widths.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:900})
  for(const screen of ['settings','inbox','guide']){
   await page.goto(origin+(screen==='settings'?'/app/settings#teams-capture':screen==='guide'?'/docs/teams':'/app/feedback'),{waitUntil:'networkidle'})
   if(screen==='settings'){await page.reload({waitUntil:'networkidle'});await panel.getByText('done: 4',{exact:true}).waitFor()}
   if(screen==='guide')await page.getByRole('heading',{name:'Microsoft Teams capture',exact:true}).waitFor()
   const region=screen==='settings'?panel:screen==='guide'?page.locator('#docs-content'):page.locator('#evidence-'+items.find(item=>item.sourceLabel==='Teams message '+ids[1]).id)
   if(screen==='inbox'){await region.getByRole('link',{name:'Open Teams message'}).waitFor();await region.getByText('Source: changed',{exact:true}).waitFor()}
   await region.scrollIntoViewIfNeeded();await page.evaluate(async()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(axe)
   assert.deepEqual(await region.evaluate(async element=>(await window.axe.run(element)).violations.filter(v=>['serious','critical'].includes(v.impact))),[])
   await page.evaluate(()=>scrollTo(0,0));const clip=await region.boundingBox();assert.ok(clip);await page.screenshot({fullPage:true,clip,path:join(output,`teams-${screen}-${width}.png`)})
  }
 }
 await json('/api/operator/integrations/teams/jobs',{id:jobId(ids[4]),action:'forget'},operator);await signed(action(ids[4]))
 assert.ok(!(await json('/api/operator/integrations/teams',undefined,operator)).jobs.some(job=>job.message_id===ids[4]))
 const eraseId=items.find(item=>item.sourceLabel==='Teams message '+ids[1]).id
 let preview=await json('/api/operator/data/erasure/preview',{table:'evidence_items',id:eraseId},operator,'POST',[200,202])
 for(let step=0;preview.status==='pending'&&step<100;step++)preview=await json('/api/operator/data/erasure/preview',{table:'evidence_items',id:eraseId,continuation:preview.continuation},operator,'POST',[200,202])
 assert.deepEqual(preview.blockedCopies,[]);assert.equal(preview.counts.penny_teams_sources,1)
 let erased=await json('/api/operator/data/erasure',{table:'evidence_items',id:eraseId,planHash:preview.planHash},operator,'POST',[200,202])
 for(let step=0;erased.status!=='complete'&&step<100;step++)erased=await json(`/api/operator/data/operations/${erased.operationId}/resume`,{},operator,'POST',[200,202])
 assert.equal(erased.status,'complete');await signed(action(ids[1],channel,ids[0]));await runtime.schedule()
 assert.ok(!(await cards()).items.some(item=>item.id===eraseId))
 const visitor=await browser.newPage();await visitor.goto(origin+'/portal/feedback',{waitUntil:'networkidle'});assert.doesNotMatch(await visitor.content(),/Trigger member|Source author|teams.microsoft.com\/l\/message|Please add scheduled exports/);await visitor.close()
 await send('/api/operator/integrations/teams',undefined,{},'GET',401);assert.deepEqual(errors,[])
 console.log('Teams capture journey passed: validated Bot Framework JWTs, root/reply capture, scope, redaction, replay/restart, failure/retry/stop, source authority, restore/erasure and 1440/390 proof')
}finally{await context?.close();await browser.close();await runtime.close()}
