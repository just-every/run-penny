import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {startBrowserRuntime} from './base-runtime.mjs'
const key=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...key.publicKey.export({format:'jwk'}),kid:'recorded-notify-key',use:'sig',endorsements:['msteams']}
const team='11111111-1111-4111-8111-111111111111',channel='19:feedback@thread.tacv2',serviceUrl='https://smba.trafficmanager.net/teams/'
const config={applicationId:'22222222-2222-4222-8222-222222222222',tenantId:'33333333-3333-4333-8333-333333333333',clientSecret:'synthetic-entra-notification-secret',notificationUrl:'https://recorded.logic.azure.com/workflows/fixture/triggers/manual/paths/invoke?sig=recorded-workflow-signature'}
const discordKey=generateKeyPairSync('ed25519'),discord={applicationId:'120000000000000004',publicKey:discordKey.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex'),botToken:'synthetic-notify-discord-token',gatewaySecret:'synthetic-notify-discord-gateway-secret'}
const guild='120000000000000001',discordChannel='120000000000000002'
const posts=[];let postMode=202,graphMode=429,onPost=async()=>{}
const edge={name:'teams-notification-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const response=await fetch(wire.url,{method:wire.method,headers:wire.headers,body:wire.method==='POST'?wire.body:undefined,redirect:'manual'});return {status:response.status,headers:{},body:await response.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
 const url=new URL(request.url)
 if(url.hostname==='recorded.logic.azure.com'){assert.equal(request.method,'POST');assert.equal(request.url,config.notificationUrl);posts.push(await request.json());await onPost();return new Response(null,{status:postMode})}
 if(url.hostname==='login.botframework.com')return Response.json(url.pathname.endsWith('/openidconfiguration')?{issuer:'https://api.botframework.com',jwks_uri:'https://login.botframework.com/v1/.well-known/keys'}:{keys:[jwk]})
 if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'recorded-notify-access-token',token_type:'Bearer'})
 if(url.hostname==='discord.com')return Response.json({message:'Recorded rate limit'},{status:429})
 assert.equal(url.hostname,'graph.microsoft.com')
 if(graphMode!==200)return Response.json({error:'Recorded rate limit'},{status:graphMode})
 const id=url.pathname.split('/').at(-1)
 return Response.json({id,webUrl:'https://teams.microsoft.com/l/message/'+encodeURIComponent(channel)+'/'+id,createdDateTime:'2026-10-28T12:30:00Z',body:{contentType:'text',content:'PRIVATE_SOURCE_DO_NOT_SEND'},from:{user:{id:'recorded-author',displayName:'PRIVATE_AUTHOR_DO_NOT_SEND'}}})
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_TEAMS:JSON.stringify(config),PENNY_DISCORD:JSON.stringify(discord)},networkWorker:edge,networkBinding:['PENNY_TEAMS_EGRESS','PENNY_DISCORD_EGRESS']})
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
 // More failing captures and retries are still one unresolved connector
 // outage, including after restart. Successful work cannot conceal another
 // unresolved failed capture.
 const failures=()=>posts.filter(post=>/failure:/.test(JSON.stringify(post))).length
 const capture=async id=>json('/api/integrations/teams/messages',{...action,value:{...action.value,messagePayload:{id}}},null,'POST',200,{Authorization:'Bearer '+token})
 const jobId=id=>team+'/'+channel+'/'+id,job=async(id,chosen)=>json('/api/operator/integrations/teams/jobs',{id:jobId(id),action:chosen},cookie)
 const originalFailures=failures();assert.equal(originalFailures,1)
 await capture('1700000000011');await runtime.schedule(clock+2000)
 assert.equal(failures(),originalFailures,'Two failed jobs belong to one outage')
 graphMode=200;await job('1700000000010','retry');await runtime.schedule(clock+3000)
 graphMode=429;await capture('1700000000012');await runtime.schedule(clock+4000)
 assert.equal(failures(),originalFailures,'Other unresolved work keeps the episode open')
 await job('1700000000011','stop');await job('1700000000012','stop')
 await runtime.schedule(clock+3605001)
 assert.equal(failures(),originalFailures+1,'A source-check outage starts the next episode')
 await runtime.restart();await runtime.schedule(clock+3606001)
 assert.equal(failures(),originalFailures+1,'Source failure alerts survive restart without replay')
 graphMode=200
 await json('/api/operator/integrations/teams',{teamId:team,channelIds:[channel],enabled:true,purgeDays:0},cookie,'PUT')
 await runtime.schedule(clock+3607001)
 graphMode=429;await runtime.schedule(clock+7208002)
 assert.equal(failures(),originalFailures+2,'Recovery permits one new outage alert')
 // The same episode mechanism serves the existing Discord connector.
 await json('/api/operator/integrations/discord',{guildId:guild,channelIds:[discordChannel],emoji:'📌',enabled:true,purgeDays:0},cookie,'PUT')
 async function discordCapture(id){
  const activity={type:2,application_id:discord.applicationId,guild_id:guild,channel_id:discordChannel,member:{user:{id:'120000000000000005',username:'PRIVATE_DISCORD_CAPTURER'}},data:{type:3,name:'Send to Penny',target_id:id}}
  const body=JSON.stringify(activity),timestamp=String(Math.floor(Date.now()/1000)),signature=sign(null,Buffer.from(timestamp+body),discordKey.privateKey).toString('hex')
  const response=await fetch(origin+'/api/integrations/discord/interactions',{method:'POST',headers:{'Content-Type':'application/json','X-Signature-Timestamp':timestamp,'X-Signature-Ed25519':signature},body});assert.equal(response.status,200)
 }
 await discordCapture('130000000000000001');await runtime.schedule(clock+7209002)
 assert.equal(failures(),originalFailures+3,'An independent connector has its own episode')
 await discordCapture('130000000000000002');await runtime.schedule(clock+7210002)
 assert.equal(failures(),originalFailures+3,'Discord jobs also coalesce into one outage')
 const beforeDigests=posts.length
 await runtime.schedule(clock+86400000);assert.equal(posts.length,beforeDigests+1,'One daily digest coalesces inbox, aging and release events')
 const daily=JSON.stringify(posts.at(-1));for(const kind of ['inbox','aging','release'])assert.match(daily,new RegExp(kind+': '))
 await runtime.schedule(clock+8*86400000);assert.equal(posts.length,beforeDigests+2);assert.match(JSON.stringify(posts.at(-1)),/demand: 1/)
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
 // One portal submission is one inbox item, despite its native request
 // and evidence rows. Replay, unowned boards and later assignment add no
 // extra inbox event. These events all enter through public HTTP routes.
 const selected={...prefs,events:Object.fromEntries(Object.keys(prefs.events).map(kind=>[kind,kind==='inbox'?'immediate':'off']))}
 await json(path,selected,cookie,'PUT')
 await json('/api/public/identity/email',{email:'customer@example.test',displayName:'PRIVATE_CUSTOMER_DO_NOT_SEND'},null,'POST',202)
 const requesterLink=runtime.outbox.findLast(message=>message.email==='customer@example.test').url
 const requester=await json('/api/public/identity/email/verify',{token:new URLSearchParams(new URL(requesterLink).hash.slice(1)).get('token')},null)
 const boardVersion=async slug=>(await json('/api/public/boards',undefined,null)).find(board=>board.slug===slug).subscriptionDisclosure.version
 const portal={subscriptionVersion:await boardVersion('teams-proof'),title:'PRIVATE_PORTAL_DO_NOT_SEND',description:'PRIVATE_CUSTOMER_DESCRIPTION',boardSlug:'teams-proof',idempotencyKey:crypto.randomUUID()}
 let count=posts.length
 await json('/api/public/requests',portal,null,'POST',201,{Authorization:'Bearer '+requester.token})
 await json('/api/public/requests',portal,null,'POST',201,{Authorization:'Bearer '+requester.token})
 await runtime.schedule(Date.now());assert.equal(posts.length,count+1,'One inbox delivery for a replayed portal submission')
 assert.match(JSON.stringify(posts.at(-1)),/inbox: 1/)
 await json('/api/operator/boards',{slug:'unowned-proof',name:'Unowned board',visibility:'public'},cookie,'POST',201)
 await json('/api/public/requests',{...portal,boardSlug:'unowned-proof',subscriptionVersion:await boardVersion('unowned-proof'),idempotencyKey:crypto.randomUUID()},null,'POST',201,{Authorization:'Bearer '+requester.token})
 await runtime.schedule(Date.now());assert.equal(posts.length,count+1,'Unowned board sends no inbox alert')
 const independent=await json('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Private standalone capture',wording:'PRIVATE_STANDALONE',observedAt:new Date().toISOString(),boardSlug:'teams-proof'},cookie,'POST',201)
 await runtime.schedule(Date.now());assert.equal(posts.length,count+2,'A separate evidence capture sends one inbox event')
 await json('/api/operator/ownership/evidence/'+independent.id,{operatorId:null},cookie,'PATCH')
 await json('/api/operator/ownership/evidence/'+independent.id,{operatorId:actor},cookie,'PATCH')
 await runtime.schedule(Date.now());assert.equal(posts.length,count+2,'Assigning existing evidence creates no new inbox item')
 // More than one discovery page of open weekly events cannot starve an
 // immediate assignment. No event rows are inserted directly by this journey.
 await json(path,{...prefs,events:{...selected.events,inbox:'off',mention:'weekly',assignment:'immediate'}},cookie,'PUT')
 for(let index=0;index<205;index++)await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201)
 const assignment=await json('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Private assignment',wording:'PRIVATE_ASSIGNMENT',observedAt:new Date().toISOString()},cookie,'POST',201)
 await json('/api/operator/ownership/evidence/'+assignment.id,{operatorId:actor},cookie,'PATCH')
 count=posts.length;const backlogClock=Date.now()
 await runtime.schedule(backlogClock);assert.equal(posts.length,count+1,'Open weekly backlog does not block immediate work')
 assert.match(JSON.stringify(posts.at(-1)),/assignment: 1/);assert.doesNotMatch(JSON.stringify(posts.at(-1)),/mention:/)
 await runtime.restart();await runtime.schedule(backlogClock+1000);assert.equal(posts.length,count+1)
 await runtime.schedule(backlogClock+8*86400000);assert.equal(posts.length,count+2,'All open weekly events later form one closed-period digest')
 assert.match(JSON.stringify(posts.at(-1)),/mention: 205/)
 await runtime.restart();await runtime.schedule(backlogClock+8*86400000+1000);assert.equal(posts.length,count+2)
 for(const post of posts)assert.doesNotMatch(JSON.stringify(post),/PRIVATE_|customer@example|synthetic-|recorded-workflow/)
 const beforeDisabled=posts.length
 await json(path,{...prefs,enabled:false},cookie,'PUT')
 await json('/api/operator/discussion/requests/'+request.slug+'/notes',{...note,idempotencyKey:crypto.randomUUID()},cookie,'POST',201);await runtime.schedule(clock+9*86400000);assert.equal(posts.length,beforeDisabled)
 const archive=(await json('/api/operator/data/export',undefined,cookie)).archive
 assert.equal(archive.tables.penny_connector_faults,undefined);assert.equal(archive.tables.penny_connector_episodes,undefined);assert.equal(archive.tables.penny_teams_preferences,undefined);assert.equal(archive.tables.penny_teams_deliveries,undefined);assert.ok(!JSON.stringify(archive).includes(config.notificationUrl))
 console.log('Teams notifications journey passed: all eight native event kinds, opt-out, immediate/daily/weekly delivery, in-app mentions, privacy, restart, ambiguous/interrupted POST custody and stop')
}finally{await runtime.close()}
