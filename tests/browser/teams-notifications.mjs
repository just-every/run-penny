import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {startBrowserRuntime} from './base-runtime.mjs'
const key=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...key.publicKey.export({format:'jwk'}),kid:'recorded-notify-key',use:'sig',endorsements:['msteams']}
const team='11111111-1111-4111-8111-111111111111',channel='19:feedback@thread.tacv2',serviceUrl='https://smba.trafficmanager.net/teams/'
const config={applicationId:'22222222-2222-4222-8222-222222222222',tenantId:'33333333-3333-4333-8333-333333333333',clientSecret:'synthetic-entra-notification-secret',notificationUrl:'https://recorded.logic.azure.com/workflows/fixture/triggers/manual/paths/invoke?sig=recorded-workflow-signature'}
const posts=[];let postMode=202,onPost=async()=>{}
const edge={name:'teams-notification-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const response=await fetch(wire.url,{method:wire.method,headers:wire.headers,body:wire.method==='POST'?wire.body:undefined,redirect:'manual'});return {status:response.status,headers:{},body:await response.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
 const url=new URL(request.url)
 if(url.hostname==='recorded.logic.azure.com'){assert.equal(request.method,'POST');assert.equal(request.url,config.notificationUrl);posts.push(await request.json());await onPost();return new Response(null,{status:postMode})}
 if(url.hostname==='login.botframework.com')return Response.json(url.pathname.endsWith('/openidconfiguration')?{issuer:'https://api.botframework.com',jwks_uri:'https://login.botframework.com/v1/.well-known/keys'}:{keys:[jwk]})
 if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'recorded-notify-access-token',token_type:'Bearer'})
 assert.equal(url.hostname,'graph.microsoft.com');return Response.json({error:'Recorded rate limit'},{status:429})
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_TEAMS:JSON.stringify(config)},networkWorker:edge,networkBinding:'PENNY_TEAMS_EGRESS'})
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,cookie,method=body===undefined?'GET':'POST',expected=200,extra={}){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.19.${Math.floor(ip/250)}.${++ip%250+1}`,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.equal(response.status,expected,`${method} ${path}: ${await response.clone().text()}`);return response
 }
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel'},null,'POST',303),cookie=boot.headers.get('set-cookie').split(';')[0]
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 const path='/api/operator/integrations/teams/notifications',initial=await json(path,undefined,cookie)
 assert.equal(initial.settings.enabled,false)
 assert.deepEqual(Object.entries(initial.settings.events).filter(([,value])=>value!=='off').map(([key])=>key).sort(),['assignment','mention','review'])
 await send(path,{...initial.settings,enabled:true},null,'PUT',401);await send(path,{...initial.settings,enabled:true},cookie,'PUT',403,{Origin:'https://evil.test'})
 const prefs={enabled:true,demandThreshold:1,events:{inbox:'daily',mention:'immediate',assignment:'immediate',aging:'daily',review:'immediate',failure:'immediate',release:'daily',demand:'weekly'}}
 await json(path,prefs,cookie,'PUT')
 // A second native operator opts out. No audience or mail permission is inferred.
 await json('/api/operator/settings/operators',{email:'quiet-peer@example.test'},cookie,'POST',202)
 const link=runtime.outbox.findLast(message=>message.email==='quiet-peer@example.test').url,confirmation=await send('/auth/confirm',{token:new URL(link).searchParams.get('token')},null,'POST',303),peerCookie=confirmation.headers.get('set-cookie').split(';')[0]
 await json(path,{...prefs,events:Object.fromEntries(Object.keys(prefs.events).map(key=>[key,'off']))},peerCookie,'PUT')
 const actor=(await json('/api/operator/discussion/operators',undefined,cookie)).operators.find(operator=>operator.displayName==='Maya Patel').id
 await json('/api/operator/boards',{slug:'teams-proof',name:'Teams proof board',visibility:'public'},cookie,'POST',201)
 await json('/api/operator/ownership/boards/teams-proof',{operatorId:actor},cookie,'PATCH')
 const request=await json('/api/operator/requests',{title:'Schedule financial exports',description:'Private operator context stays in Penny.',boardSlug:'teams-proof'},cookie,'POST',201)
 await json('/api/operator/ownership/requests/'+request.slug,{operatorId:actor},cookie,'PATCH')
 const note={body:'PRIVATE_NOTE_DO_NOT_SEND',mentionOperatorIds:[actor],idempotencyKey:crypto.randomUUID()}
 await json('/api/operator/discussion/requests/'+request.slug+'/notes',note,cookie,'POST',201);await json('/api/operator/discussion/requests/'+request.slug+'/notes',note,cookie,'POST',201)
 const evidence=await json('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Private interview',wording:'PRIVATE_EVIDENCE_DO_NOT_SEND',observedAt:'2026-10-01T00:00:00Z',boardSlug:'teams-proof'},cookie,'POST',201)
 const decision=await json('/api/operator/decisions',{question:'Which export approach?',ownerOperatorId:actor},cookie,'POST',201)
 const bet=await json('/api/operator/decisions/'+decision.id+'/bets',{title:'Scheduled exports',summary:'PRIVATE_ACCOUNT_DO_NOT_SEND'},cookie,'POST',201)
 await json('/api/operator/evidence/'+evidence.id+'/links',{target:'bet',targetId:bet.id},cookie,'PUT')
 const commit=await json('/api/operator/decisions/'+decision.id+'/commit',{selectedCandidateBetId:bet.id,rationale:'Directly addresses the evidence.',ownerOperatorId:actor,confidence:'high',reviewAt:'2026-10-01',noViableAlternativeReason:'The alternative does not address the need.'},cookie)
 await json('/api/operator/moderation/'+request.slug,{verdict:'approved',title:'Schedule financial exports',description:'Schedule financial exports.',boardSlug:'teams-proof',displayName:'Maya'},cookie)
 await json('/api/operator/requests/'+request.slug+'/proxy-votes',{contact:{displayName:'Recorded customer'},source:'Customer request in interview'},cookie,'POST',200)
 await json('/api/operator/roadmap/'+commit.itemId+'/approve',{publicTitle:'Scheduled exports',publicSummary:'Schedule your financial exports.',boardSlug:'teams-proof',requestIds:[request.id]},cookie)
 await json('/api/operator/roadmap/'+commit.itemId+'/move',{status:'shipped',reason:'Exports are available.',idempotencyKey:crypto.randomUUID()},cookie)
 const tag=await json('/api/operator/catalog/tags',{name:'Exports'},cookie,'POST',201)
 const draft=await json('/api/operator/releases',{title:'Financial exports',body:'Export improvements are available.',releaseType:'improved',tagIds:[tag.id],publicationDate:new Date().toISOString().slice(0,10),targetIds:[commit.itemId],authorOperatorId:actor},cookie,'POST',201)
 await json('/api/operator/releases/'+draft.slug+'/publish',{},cookie)
 await json('/api/operator/integrations/teams',{teamId:team,channelIds:[channel],enabled:true,purgeDays:0},cookie,'PUT')
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),text=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:'https://api.botframework.com',aud:config.applicationId,nbf:Math.floor(Date.now()/1000)-60,exp:Math.floor(Date.now()/1000)+3600,serviceurl:serviceUrl}),token=text+'.'+sign('RSA-SHA256',Buffer.from(text),key.privateKey).toString('base64url')
 const action={type:'invoke',name:'composeExtension/submitAction',channelId:'msteams',serviceUrl,from:{id:'29:capturer',name:'PRIVATE_CAPTURER_DO_NOT_SEND'},channelData:{tenant:{id:config.tenantId},team:{id:'19:team',aadGroupId:team},channel:{id:channel}},value:{commandId:'sendToPenny',messagePayload:{id:'1700000000010'}}}
 await json('/api/integrations/teams/messages',action,null,'POST',200,{Authorization:'Bearer '+token})
 // Advance only source age. All notification events are made by native routes/Cron.
 await runtime.db.prepare('UPDATE evidence_items SET created_at=? WHERE id=?').bind(new Date(Date.now()-40*86400000).toISOString(),evidence.id).run()
 const clock=Date.now();await runtime.schedule(clock);const immediate=posts.length;assert.ok(immediate>=4)
 const immediateText=JSON.stringify(posts);for(const kind of ['mention','assignment','review','failure'])assert.match(immediateText,new RegExp(kind+': '))
 assert.doesNotMatch(immediateText,/inbox:|aging:|release:|demand:/)
 const notices=await json('/api/operator/discussion/mentions',undefined,cookie);assert.equal(notices.mentions.filter(item=>item.body===note.body).length,1,'Teams preferences preserve native in-app mentions')
 await runtime.restart();await runtime.schedule(clock+1000);assert.equal(posts.length,immediate,'Restart never repeats accepted posts')
 await runtime.schedule(clock+86400000);assert.equal(posts.length,immediate+1,'One daily digest coalesces inbox, aging and release events')
 const daily=JSON.stringify(posts.at(-1));for(const kind of ['inbox','aging','release'])assert.match(daily,new RegExp(kind+': '))
 await runtime.schedule(clock+8*86400000);assert.equal(posts.length,immediate+2);assert.match(JSON.stringify(posts.at(-1)),/demand: 1/)
 for(const post of posts){assert.doesNotMatch(JSON.stringify(post),/PRIVATE_|Maya|quiet-peer|recorded-workflow|synthetic-|Scheduled exports|Schedule financial|Which export/);assert.match(JSON.stringify(post),/Penny operator update/)}
 assert.deepEqual((await json(path,undefined,peerCookie)).deliveries,[])
 // Definite rejection can be retried deliberately; uncertainty cannot.
 postMode=429;await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201)
 await runtime.schedule(clock+8*86400000+100)
 const rejected=(await json(path,undefined,cookie)).deliveries.find(item=>item.state==='failed')
 assert.ok(rejected);postMode=202
 await json(path+'/resolve',{id:rejected.id,action:'retry'},cookie)
 await runtime.schedule(clock+8*86400000+200)
 assert.equal((await json(path,undefined,cookie)).deliveries.find(item=>item.id===rejected.id).state,'accepted')
 // Ambiguous sends stay visible across restart and require explicit resolution.
 postMode=500;await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201)
 await runtime.schedule(clock+8*86400000+1000)
 let status=await json(path,undefined,cookie),unknown=status.deliveries.find(item=>item.state==='unknown');assert.ok(unknown)
 await send(path+'/resolve',{id:unknown.id,action:'retry'},cookie,'POST',409)
 const ambiguousCount=posts.length;await runtime.restart();await runtime.schedule(clock+8*86400000+2000);assert.equal(posts.length,ambiguousCount)
 await json(path+'/resolve',{id:unknown.id},cookie)
 assert.equal((await json(path,undefined,cookie)).deliveries.find(item=>item.id===unknown.id).state,'stopped')
 // A genuine kill while POST is in flight cannot replay the uncertain send.
 postMode=202;let enter,release;const entered=new Promise(resolve=>{enter=resolve}),held=new Promise(resolve=>{release=resolve})
 onPost=async()=>{onPost=async()=>{};enter();await held}
 await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201)
 const pending=runtime.schedule(clock+8*86400000+3000);pending.catch(()=>{});await entered
 try{await runtime.restart()}finally{release()}await pending.catch(error=>assert.match(error.message,/scheduled|disposed|aborted|disconnect|fetch failed/i))
 const interruptedPosts=posts.length;await runtime.schedule(clock+8*86400000+304000)
 status=await json(path,undefined,cookie);assert.ok(status.deliveries.some(item=>item.failure==='interrupted_send_review_required'));assert.equal(posts.length,interruptedPosts)
 await json(path,{...prefs,enabled:false},cookie,'PUT')
 await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201);await runtime.schedule(clock+9*86400000);assert.equal(posts.length,interruptedPosts)
 const archive=(await json('/api/operator/data/export',undefined,cookie)).archive
 assert.equal(archive.tables.penny_teams_preferences,undefined);assert.equal(archive.tables.penny_teams_deliveries,undefined);assert.ok(!JSON.stringify(archive).includes(config.notificationUrl))
 console.log('Teams notifications journey passed: all eight native event kinds, opt-out, immediate/daily/weekly delivery, in-app mentions, privacy, restart, ambiguous/interrupted POST custody and stop')
}finally{await runtime.close()}
