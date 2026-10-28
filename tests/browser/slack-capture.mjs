import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {readD1Migrations} from '@cloudflare/vitest-plugin'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
import {slackEdge} from './slack-edge.mjs'

const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/slack-capture')
assert.ok(!output.startsWith(resolve('.')+'/'))
await mkdir(output,{recursive:true})
const browser=await chromium.launch(browserOptions()),axe=await readFile('node_modules/axe-core/axe.min.js','utf8')
const manifest=JSON.parse(await readFile('integrations/slack/manifest.json','utf8'))
const runtime=await startBrowserRuntime({networkWorker:slackEdge(manifest),networkBinding:'PENNY_EGRESS',migrationThrough:'0095_paged_redaction.sql'})
let context
try{
 const {origin}=runtime
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Connection:'close',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`)
  return response
 }
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel',returnTo:'/app'},{},'POST',303)
 const Cookie=boot.headers.get('set-cookie').split(';')[0],owner={Cookie}
 assert.equal((await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Connection:'close',Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor',postalAddress:'14 Market Street, Boston MA',timezone:'America/New_York',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})})).status,303)
 // Populated previous-head upgrade: retain the old
 // evidence and authority across additive installation.
 const old=await json('/api/operator/evidence',{sourceType:'interview',wording:'Existing customer evidence',observedAt:'2026-10-27T12:00:00Z'},owner,'POST',201)
 const oldRows=await runtime.db.prepare('SELECT * FROM evidence_items WHERE id=?').bind(old.id).first()
 const migrations=await readD1Migrations(resolve('migrations/core'))
 const upgrade=migrations.find(m=>m.name==='0096_slack_capture.sql')
 assert.ok(upgrade)
 await runtime.db.batch(upgrade.queries.map(sql=>runtime.db.prepare(sql)))
 // The existing row is byte-identical after upgrade and process restart.
 await runtime.restart()
 assert.deepEqual(await runtime.db.prepare('SELECT * FROM evidence_items WHERE id=?').bind(old.id).first(),oldRows)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},owner,'PUT')
 const account=await json('/api/operator/accounts',{name:'Customer workspace',internalOwnerId:await runtime.db.prepare('SELECT id FROM operators LIMIT 1').first('id')},owner,'POST',201)
 const config={teamId:'THOME',appId:'APENNY',channels:['CSHARED','CINTERNAL'],workspaceAccounts:[{teamId:'TEXTERNAL',accountId:account.id}],reaction:'penny',purgeDays:1,botToken:'synthetic-slack-bot-token',signingSecret:'synthetic-slack-signing-secret'}
 await send('/api/operator/integrations/chat',undefined,{},'GET',401)
 await send('/api/operator/integrations/chat',config,{...owner,Origin:'https://other.test'},'POST',403)
 const connection=await json('/api/operator/integrations/chat',config,owner,'POST',201),id=connection.id
 async function signed(payload,interactive=false,{bad=false,age=0,target=connection}={}){
  const body=interactive?new URLSearchParams({payload:JSON.stringify(payload)}).toString():JSON.stringify(payload)
  for(let attempt=0;attempt<2;attempt++){
   const timestamp=String(Math.floor(Date.now()/1000)-age),signature='v0='+createHmac('sha256',config.signingSecret).update('v0:'+timestamp+':'+body).digest('hex')
   const response=await fetch(origin+(interactive?target.interactivityPath:target.eventsPath),{method:'POST',headers:{Connection:'close','Content-Type':interactive?'application/x-www-form-urlencoded':'application/json','x-slack-request-timestamp':timestamp,'x-slack-signature':bad?'v0='+'0'.repeat(64):signature},body})
   if(response.status!==429||attempt)return response
   // A provider delivery honors the real ingress limiter rather than
   // bypassing it or silently mistaking a refusal for an accepted event.
   const seconds=Number(response.headers.get('retry-after'))
   assert.ok(Number.isFinite(seconds)&&seconds>0)
   await response.text();await new Promise(resolve=>setTimeout(resolve,seconds*1000))
  }
 }
 const shortcut=(stamp='1793188800.000001',channel='CSHARED')=>({type:'message_action',callback_id:'send_to_penny',team:{id:'THOME'},api_app_id:'APENNY',channel:{id:channel},user:{id:'UCAPTURER'},trigger_id:'shortcut-'+stamp,message:{ts:stamp,text:'Untrusted shortcut text must not replace the source'}})
 const event=(event,event_id=crypto.randomUUID())=>({type:'event_callback',team_id:'THOME',api_app_id:'APENNY',event_id,event})
 const reaction=(stamp='1793188800.000002',channel='CSHARED')=>event({type:'reaction_added',user:'UREACTOR',reaction:'penny',item:{type:'message',channel,ts:stamp}},'reaction-'+stamp)
 const count=()=>runtime.db.prepare('SELECT COUNT(*) n FROM penny_chat_sources').first('n')
 assert.equal((await signed({type:'url_verification',challenge:'synthetic-challenge'})).status,200)
 assert.equal((await signed(shortcut(),true,{bad:true})).status,401)
 assert.equal((await signed(shortcut(),true,{age:600})).status,401)
 assert.equal((await signed({...shortcut(),team:{id:'TOTHER'}},true)).status,403)
 assert.equal((await runtime.edge('/shortcut')).status,204,'The installed app exposes its message shortcut')
 assert.equal((await signed(shortcut(undefined,'COUTSIDE'),true)).status,200)
 assert.equal((await signed(reaction(undefined,'COUTSIDE'))).status,200)
 assert.deepEqual((await (await runtime.edge('/calls')).json()).filter(call=>call.method!=='auth.test'),[],'Out-of-scope events never read a source')
 assert.equal((await signed(shortcut(),true)).status,200)
 assert.equal((await signed(shortcut(),true)).status,200)
 assert.equal((await signed(reaction())).status,200)
 assert.equal((await signed(reaction())).status,200)
 // A process dies after acknowledgment but before Cron; the durable receipts
 // survive. Replayed events and even the other trigger cannot duplicate it.
 await runtime.restart()
 await runtime.schedule()
 assert.equal(await count(),2)
 await signed(reaction('1793188800.000001'))
 await runtime.schedule()
 assert.equal(await count(),2)
 const inbox=await json('/api/operator/evidence',undefined,owner)
 const rows=Array.isArray(inbox)?inbox:inbox.items
 assert.ok(rows)
 const captures=rows.filter(row=>row.chatSource)
 assert.equal(captures.length,2)
 assert.deepEqual(new Set(captures.map(row=>row.chatSource.capturer)),new Set(['UCAPTURER','UREACTOR']))
 for(const row of captures){
  assert.equal(row.account.id,account.id)
  assert.equal(row.reviewState,'unreviewed')
  assert.equal(row.namedSpeaker,'Customer speaker')
  assert.ok(row.wording.includes('[REDACTED:email]'))
  assert.equal(row.chatSource.thread,'1793188800.000001')
  assert.equal(row.chatSource.url,'https://harbor.slack.com/archives/CSHARED/p1793188800000001')
 }
 const custody=JSON.stringify((await runtime.db.prepare('SELECT * FROM evidence_versions').all()).results)
 assert.equal(custody.includes('customer@example.test'),false)
 assert.equal(custody.includes('must not persist'),false)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requesters').first('n'),0)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n'),0)
 await signed(shortcut('1793188800.000003','CINTERNAL'),true);await runtime.schedule()
 assert.equal((await runtime.db.prepare("SELECT e.account_id FROM evidence_items e JOIN penny_chat_sources s ON s.evidence_id=e.id WHERE s.channel_id='CINTERNAL'").first()).account_id,null)
 // Transport failure remains visible across restart, then retry through the
 // public owner door resolves it with exactly one new capture.
 await runtime.edge('/control','rate')
 await signed(shortcut('1793188800.000004'),true);await runtime.schedule()
 let status=await json('/api/operator/integrations/chat',undefined,owner)
 let failed=status.jobs.find(job=>job.message_ts==='1793188800.000004')
 assert.equal(failed.failure,'slack_rate_limited');assert.equal(failed.state,'pending')
 assert.ok(failed.due_at>Date.now());assert.equal(await count(),3)
 await runtime.restart()
 status=await json('/api/operator/integrations/chat',undefined,owner)
 assert.equal(status.jobs.find(job=>job.id===failed.id).failure,'slack_rate_limited')
 await send('/api/operator/integrations/chat/jobs/'+failed.id,{action:'stop'},owner)
 await runtime.schedule();assert.equal(await count(),3)
 await runtime.edge('/control','normal')
 await send('/api/operator/integrations/chat/jobs/'+failed.id,{action:'retry'},owner)
 await runtime.schedule();assert.equal(await count(),4)
 assert.equal((await json('/api/operator/integrations/chat',undefined,owner)).jobs.find(job=>job.id===failed.id).state,'succeeded')
 // Kill the native runtime while the source RPC is in flight. Its claimed
 // job, not an in-memory task, is the restart cursor.
 await runtime.edge('/control','hold')
 await signed(shortcut('1793188800.000006'),true)
 const interrupted=runtime.schedule().catch(()=>null)
 let entered=false
 for(let attempt=0;attempt<100;attempt++){
  const calls=await (await runtime.edge('/calls')).json()
  if(calls.some(call=>call.stamp==='1793188800.000006')){entered=true;break}
  await new Promise(resolve=>setTimeout(resolve,50))
 }
 assert.ok(entered,'The source RPC was entered before killing the Worker')
 assert.equal((await runtime.db.prepare("SELECT state FROM penny_chat_jobs WHERE message_ts='1793188800.000006'").first()).state,'running')
 await runtime.restart();await interrupted
 await runtime.schedule(new Date(Date.now()+121000))
 assert.equal(await count(),5,'The expired lease resumes exactly once')
 await signed(shortcut('1793188800.000006'),true);await runtime.schedule()
 assert.equal(await count(),5)
 // Pause and replace credentials/scope. Creating the replacement transfers
 // existing source supervision before any recapture or provider event.
 await send('/api/operator/integrations/chat/'+id+'/state',{state:'paused'},owner)
 const replacement=await json('/api/operator/integrations/chat',config,owner,'POST',201)
 assert.equal((await signed(shortcut('1793188800.000005'),true)).status,404)
 await runtime.schedule()
 const sourceRows=async()=>{const result=await json('/api/operator/evidence',undefined,owner);return (Array.isArray(result)?result:result.items).filter(row=>row.chatSource)}
 const first=captures.find(row=>row.chatSource.capturer==='UCAPTURER')
 // Polling alone must detect changes after replacement, including after a
 // restart; it must keep the captured excerpt and attribution byte-for-byte.
 await runtime.restart();await runtime.edge('/control','edited')
 await runtime.schedule(new Date(Date.now()+3600001))
 let refreshed=(await sourceRows()).find(row=>row.id===first.id)
 assert.equal(refreshed.chatSource.state,'changed')
 assert.equal(refreshed.wording,first.wording)
 assert.equal(refreshed.chatSource.capturer,'UCAPTURER')
 await signed(reaction('1793188800.000001'),false,{target:replacement});await runtime.schedule()
 assert.equal(await count(),5,'Recapturing through replacement preserves deduplication')
 // A second scope replacement transfers selected channels only.
 await send('/api/operator/integrations/chat/'+replacement.id+'/state',{state:'paused'},owner)
 const current=await json('/api/operator/integrations/chat',{...config,channels:['CSHARED']},owner,'POST',201)
 await runtime.edge('/control','edited')
 const lifecycle=await signed(event({type:'message',subtype:'message_changed',channel:'CSHARED',message:{ts:'1793188800.000001',text:'Never retained event envelope'}}),false,{target:current})
 assert.deepEqual(await lifecycle.json(),{accepted:true})
 await runtime.schedule()
 assert.equal((await sourceRows()).find(row=>row.id===first.id).chatSource.state,'changed')
 assert.equal((await runtime.db.prepare('SELECT state FROM penny_chat_sources WHERE evidence_id=?').bind(first.id).first()).state,'changed')
 assert.ok((await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(first.id).first()).wording.includes('Please add scheduled exports'))
 context=await browser.newContext({viewport:{width:1440,height:900}})
 const cookieAt=Cookie.indexOf('=');await context.addCookies([{name:Cookie.slice(0,cookieAt),value:Cookie.slice(cookieAt+1),url:origin}])
 const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 async function proof(label){
  await page.evaluate(()=>document.fonts.ready)
  assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth),false)
  await page.evaluate(axe)
  assert.deepEqual(await page.evaluate(async()=>(await window.axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)),[])
  await page.screenshot({path:join(output,label+'-'+page.viewportSize().width+'.png'),fullPage:true})
 }
 await page.goto(origin+'/app/feedback?item='+first.id,{waitUntil:'networkidle'})
 await page.getByText('Source changed; captured version retained',{exact:true}).waitFor()
 await page.getByText('UCAPTURER',{exact:true}).waitFor()
 await context.route('https://harbor.slack.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Selected Slack thread</h1>'}))
 const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Open Slack thread',exact:true}).click()
 const sourcePage=await popup;await sourcePage.getByRole('heading',{name:'Selected Slack thread'}).waitFor();await sourcePage.close()
 await proof('captured-source')
 // The same changed screen is recorded once at phone width; assertions above
 // run at the desktop width.
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:join(output,'captured-source-390.png'),fullPage:true})
 // Source deletion keeps the captured excerpt during the chosen window, then
 // purges every version at its deadline. The same signature path handles it.
 const deleted=await signed(event({type:'message',subtype:'message_deleted',channel:'CSHARED',deleted_ts:'1793188800.000001'}),false,{target:current})
 assert.deepEqual(await deleted.json(),{accepted:true});await runtime.schedule()
 assert.equal((await runtime.db.prepare('SELECT state FROM penny_chat_sources WHERE evidence_id=?').bind(first.id).first()).state,'removed')
 assert.ok((await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(first.id).first()).wording.includes('scheduled exports'))
 // Other sources get no delete event: the replacement must detect source
 // removal by polling and apply its policy deadline without recapture.
 await runtime.edge('/control','gone')
 await runtime.schedule(new Date(Date.now()+7200001))
 const other=captures.find(row=>row.id!==first.id)
 assert.equal((await sourceRows()).find(row=>row.id===other.id).chatSource.state,'removed')
 assert.equal((await sourceRows()).find(row=>row.chatSource.channel==='CINTERNAL').chatSource.state,'changed','Unselected sources keep their prior supervisor')
 await runtime.schedule(new Date(Date.now()+86400000+1000))
 assert.equal((await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(first.id).first()).wording,'[Source excerpt removed]')
 assert.equal((await runtime.db.prepare('SELECT state FROM penny_chat_sources WHERE evidence_id=?').bind(first.id).first()).state,'purged')
 await runtime.schedule(new Date(Date.now()+2*86400000+1000))
 assert.equal((await sourceRows()).find(row=>row.id===other.id).chatSource.state,'purged')
 // A confirmed author workspace must still be in the channel's shared teams;
 // neither unconfirmed membership nor a missing author creates an account.
 await runtime.edge('/control','unconfirmed')
 await signed(shortcut('1793188800.000008'),true,{target:current});await runtime.schedule()
 assert.equal((await sourceRows()).find(row=>row.chatSource.message==='1793188800.000008').account,null)
 await runtime.edge('/control','anonymous')
 await signed(shortcut('1793188800.000009'),true,{target:current});await runtime.schedule()
 const anonymous=(await sourceRows()).find(row=>row.chatSource.message==='1793188800.000009')
 assert.equal(anonymous.account,null);assert.equal(anonymous.namedSpeaker,null);assert.equal(anonymous.chatSource.author,null)
 // Exhaust retries through Cron, then place over 100 newer successful jobs
 // ahead of the failure. Status must expose it without losing pagination.
 await runtime.edge('/control','one-failure')
 await signed(shortcut('1793188800.000007'),true,{target:current})
 for(let attempt=0;attempt<8;attempt++)await runtime.schedule(new Date(Date.now()+attempt*61000))
 status=await json('/api/operator/integrations/chat?state=unresolved&connectionId='+current.id,undefined,owner)
 failed=status.jobs.find(job=>job.message_ts==='1793188800.000007')
 assert.equal(failed.state,'failed');assert.equal(failed.attempts,8)
 for(let hour=1;hour<=55;hour++)await runtime.schedule(new Date(Date.now()+hour*3600000))
 await runtime.restart()
 status=await json('/api/operator/integrations/chat',undefined,owner)
 assert.ok(status.nextCursor)
 assert.equal(status.jobs.some(job=>job.id===failed.id),false,'The unresolved failure is older than the default page')
 assert.equal(status.connections.find(row=>row.id===current.id).last_failure,'slack_rate_limited')
 assert.equal(status.connections.find(row=>row.id===current.id).unresolved_failure_count,1)
 const seen=new Set(status.jobs.map(job=>job.id))
 while(status.nextCursor){status=await json('/api/operator/integrations/chat?cursor='+encodeURIComponent(status.nextCursor),undefined,owner);for(const job of status.jobs){assert.equal(seen.has(job.id),false);seen.add(job.id)}}
 assert.ok(seen.has(failed.id),'Pagination reaches the old failure without repeats')
 status=await json('/api/operator/integrations/chat?state=unresolved&connectionId='+current.id,undefined,owner)
 assert.deepEqual(status.jobs.map(job=>job.id),[failed.id])
 await send('/api/operator/integrations/chat/jobs/'+failed.id,{action:'retry'},owner)
 assert.equal((await json('/api/operator/integrations/chat?state=unresolved',undefined,owner)).jobs.find(job=>job.id===failed.id).failure,'slack_rate_limited','A retry retains the failure until it resolves')
 await runtime.edge('/control','normal');await runtime.schedule()
 status=await json('/api/operator/integrations/chat?state=unresolved&connectionId='+current.id,undefined,owner)
 assert.deepEqual(status.jobs,[])
 assert.equal(status.connections.find(row=>row.id===current.id).last_failure,null)
 assert.equal(status.connections.find(row=>row.id===current.id).unresolved_failure_count,0)
 await send('/api/operator/integrations/chat?limit=0',undefined,owner,'GET',400)
 await send('/api/operator/integrations/chat?cursor=invalid',undefined,owner,'GET',400)
 assert.equal(await count(),8)
 const publicBytes=JSON.stringify(await json('/api/public/requests'))
 for(const privateValue of ['UCAPTURER','customer@example.test','slack.com/archives','Customer workspace'])assert.equal(publicBytes.includes(privateValue),false)
 const exported=JSON.stringify(await json('/api/operator/data/export',undefined,owner))
 assert.equal(exported.includes(config.botToken),false);assert.equal(exported.includes(config.signingSecret),false)
 assert.ok(exported.includes('penny_chat_sources'));assert.equal(exported.includes('penny_chat_jobs'),false)
 const configBytes=JSON.stringify(await json('/api/operator/integrations/chat',undefined,owner))
 assert.equal(configBytes.includes(config.botToken),false);assert.equal(configBytes.includes(config.signingSecret),false)
 await send('/api/operator/integrations/chat/'+id+'/state',{state:'paused'},owner)
 assert.equal((await signed(shortcut('1793188800.000005'),true)).status,404)
 await send('/api/operator/integrations/chat/'+id+'/state',{state:'active'},owner)
 await send('/api/operator/integrations/chat/'+id+'/state',{state:'revoked'},owner)
 assert.equal((await signed(shortcut('1793188800.000005'),true)).status,404)
 await send('/api/operator/integrations/chat/'+replacement.id+'/state',{state:'revoked'},owner)
 await send('/api/operator/integrations/chat/'+current.id+'/state',{state:'revoked'},owner)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM penny_chat_secrets').first('n'),0)
 assert.equal(await count(),8,'Disconnect retains evidence')
 const reconnect=await json('/api/operator/integrations/chat',config,owner,'POST',201)
 assert.equal((await signed(shortcut(),true,{target:reconnect})).status,200)
 await runtime.schedule();assert.equal(await count(),8,'Reconnection cannot duplicate an existing source')
 assert.equal((await signed(event({type:'app_uninstalled'}),false,{target:reconnect})).status,200)
 assert.equal(await runtime.db.prepare('SELECT COUNT(*) n FROM penny_chat_secrets').first('n'),0)
 assert.equal((await signed(shortcut(),true,{target:reconnect})).status,404)
 assert.deepEqual(errors,[])
 assert.equal(runtime.outbox.length,0,'Capture sends no messages')
 console.log('Slack capture journey passed: signatures, shortcut/reaction replay, Connect mapping, scope, redaction, restart/retry, provenance, source change/removal/purge, privacy and disconnect; browser proof 1440/390.')
}finally{await context?.close();await runtime.close();await browser.close()}
