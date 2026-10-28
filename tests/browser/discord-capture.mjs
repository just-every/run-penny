import assert from 'node:assert/strict'
import {generateKeyPairSync,sign,createHmac} from 'node:crypto'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/discord-capture')
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const key=generateKeyPairSync('ed25519'),publicKey=key.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex')
const guild='120000000000000001',channel='120000000000000002',other='120000000000000003',applicationId='120000000000000004',capturer='120000000000000005',author='120000000000000006'
const config={applicationId,publicKey,botToken:'synthetic-discord-bot-token-not-live',gatewaySecret:'synthetic-discord-relay-key-not-live-123456'}
const ids=['130000000000000001','130000000000000002','130000000000000003','130000000000000004','130000000000000005','130000000000000006']
const reads=[],modes=new Map();let onRead=async()=>{}
const edge={name:'discord-network-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const response=await fetch(wire.url,{method:wire.method,headers:wire.headers,redirect:'manual'});return {status:response.status,headers:{},body:await response.text()}}fetch(){return new Response('not found',{status:404})}}`,outboundService:async request=>{
 const url=new URL(request.url),id=url.pathname.split('/').at(-1);assert.equal(url.hostname,'discord.com');assert.equal(request.method,'GET');assert.equal(request.headers.get('Authorization'),`Bot ${config.botToken}`);assert.ok(url.pathname.startsWith(`/api/v10/channels/${channel}/messages/`),'Only selected channel message GETs reach the edge');reads.push(id);await onRead(id)
 const mode=modes.get(id);if(typeof mode==='number')return Response.json({message:'Synthetic refusal'},{status:mode})
 return Response.json({id,channel_id:channel,content:mode==='changed'?'Edited source wording':`Please add scheduled exports ${id}. Contact source.person@example.test.`,timestamp:'2026-10-28T12:30:00.000+00:00',author:{id:author,username:'Source author '+id},embeds:[{description:'OMITTED_UNSELECTED_EMBED'}],attachments:[{url:'https://unread.example.test/original'}]})
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_DISCORD:JSON.stringify(config)},networkWorker:edge,networkBinding:'PENNY_DISCORD_EGRESS'}),browser=await chromium.launch(browserOptions()),contexts=[]
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.18.${Math.floor(ip/250)}.${++ip%250+1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,status,`${method} ${path}: ${await response.clone().text()}`);return response}
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Maya Patel'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 const settings={guildId:guild,channelIds:[channel],emoji:'📌',enabled:true,purgeDays:0}
 await send('/api/operator/integrations/discord',settings,{},'PUT',401)
 await send('/api/operator/integrations/discord',settings,{...operator,Origin:'https://evil.test'},'PUT',403)
 const context=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(context);await context.addCookies([{name:Cookie.split('=')[0],value:Cookie.slice(Cookie.indexOf('=')+1),url:origin}]);const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==origin)errors.push('External browser request')})
 await page.goto(origin+'/app/settings#discord-capture',{waitUntil:'networkidle'});const panel=page.getByRole('region',{name:'Discord capture',exact:true})
 await panel.getByLabel('Discord server ID',{exact:true}).fill(guild);await panel.getByLabel('Selected channel IDs',{exact:true}).fill(channel);await panel.getByLabel('Enable Discord capture',{exact:true}).check();await panel.getByRole('button',{name:'Save Discord capture',exact:true}).click();await panel.getByText('Discord settings saved.',{exact:true}).waitFor()
 const command=(id,chosen=channel)=>({type:2,application_id:applicationId,guild_id:guild,channel_id:chosen,member:{user:{id:capturer,username:'Trigger member'}},data:{type:3,name:'Send to Penny',target_id:id},resolved:{messages:{[id]:{content:'UNTRUSTED_INTERACTION_TEXT_NOT_STORED'}}}})
 const reaction=(id,chosen=channel)=>({t:'MESSAGE_REACTION_ADD',d:{guild_id:guild,channel_id:chosen,message_id:id,user_id:capturer,member:{user:{id:capturer,username:'Trigger member'}},emoji:{id:null,name:'📌'}}})
 async function signed(body,{relay=false,bad=false,raw,at}={}){
  const text=raw??JSON.stringify(body),timestamp=at??String(Math.floor(Date.now()/1000)),signature=relay?createHmac('sha256',config.gatewaySecret).update(timestamp+text).digest('hex'):sign(null,Buffer.from(timestamp+text),key.privateKey).toString('hex')
  const response=await fetch(origin+'/api/integrations/discord/'+(relay?'gateway':'interactions'),{method:'POST',headers:{'Content-Type':'application/json',...(relay?{'X-Penny-Timestamp':timestamp,'X-Penny-Signature':bad?'0'.repeat(64):signature}:{'X-Signature-Timestamp':timestamp,'X-Signature-Ed25519':bad?'0'.repeat(128):signature})},body:text});return response
 }
 assert.equal((await signed(null,{bad:true,raw:'{malformed'})).status,401,'Signature failure precedes parsing')
 assert.equal((await signed(null,{raw:'{malformed'})).status,400)
 assert.equal((await signed({type:1,application_id:applicationId})).status,200)
 assert.equal((await signed(command(ids[0]),{at:String(Math.floor(Date.now()/1000)-600)})).status,401)
 for(let n=0;n<2;n++){assert.equal((await signed(command(ids[0]))).status,200);assert.equal((await signed(reaction(ids[1]),{relay:true})).status,202)}
 assert.equal((await signed(reaction(ids[0]),{relay:true})).status,202)
 assert.equal((await signed(reaction(ids[2]),{relay:true,bad:true})).status,401)
 assert.equal((await signed(command(ids[2],other))).status,200);assert.equal((await signed(reaction(ids[2],other),{relay:true})).status,202)
 assert.equal((await signed({...reaction(ids[2]),d:{...reaction(ids[2]).d,emoji:{id:null,name:'👎'}}},{relay:true})).status,202)
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_jobs').first('n'),2)
 await runtime.schedule();await runtime.restart();await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_sources').first('n'),2,JSON.stringify(await json('/api/operator/integrations/discord',undefined,operator)))
 assert.deepEqual(reads.sort(),ids.slice(0,2));const rows=(await runtime.db.prepare('SELECT e.*,v.wording,d.* FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id JOIN penny_discord_sources d ON d.evidence_id=e.id ORDER BY d.message_id').all()).results
 for(const row of rows){assert.equal(row.review_state,'unreviewed');assert.equal(row.named_speaker,'Source author '+row.message_id);assert.equal(row.capturer_name,'Trigger member');assert.equal(row.author_id,author);assert.equal(row.requester_id,null);assert.equal(row.jump_url,`https://discord.com/channels/${guild}/${channel}/${row.message_id}`);assert.match(row.wording,/\[REDACTED:email\]/);assert.doesNotMatch(JSON.stringify(row),/source.person@example|OMITTED_|UNTRUSTED_/)}
 const capturedJobs=(await json('/api/operator/integrations/discord',undefined,operator)).jobs;assert.ok(capturedJobs.every(job=>job.ownerName==='Maya Patel'));assert.equal(capturedJobs.find(job=>job.id.endsWith(ids[0])).trigger_kind,'command');assert.equal(capturedJobs.find(job=>job.id.endsWith(ids[1])).trigger_kind,'reaction');
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions').first('n'),0);assert.equal(runtime.outbox.length,0)
 // One failed read stays visible across restart until the owner chooses retry.
 modes.set(ids[2],429);await signed(reaction(ids[2]),{relay:true});await runtime.schedule();await runtime.restart();await runtime.schedule()
 let status=await json('/api/operator/integrations/discord',undefined,operator);assert.equal(status.jobs.find(job=>job.id.endsWith(ids[2])).state,'failed');assert.equal(reads.filter(id=>id===ids[2]).length,1)
 modes.delete(ids[2]);await json('/api/operator/integrations/discord/jobs',{id:`${guild}/${channel}/${ids[2]}`,action:'retry'},operator);await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_sources').first('n'),3)
 // Simulate an actual killed claim at its durable checkpoint, then restart the Worker.
 await json('/api/operator/settings/redaction',{enabled:false,kinds:['email'],patterns:[]},operator,'PUT')
 await signed({...command(ids[3]),member:{user:{id:capturer,username:'trigger.secret@example.test'}}})
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},operator,'PUT')
 await runtime.db.prepare("UPDATE penny_discord_jobs SET state='running',claim='killed-at-checkpoint',started_at='2000-01-01T00:00:00Z' WHERE message_id=?").bind(ids[3]).run();await runtime.restart();await runtime.schedule()
 status=await json('/api/operator/integrations/discord',undefined,operator);assert.equal(status.jobs.find(job=>job.id.endsWith(ids[3])).failure,'interrupted_read_retry_required');assert.ok(!reads.includes(ids[3]));await json('/api/operator/integrations/discord/jobs',{id:`${guild}/${channel}/${ids[3]}`,action:'retry'},operator);await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT capturer_name FROM penny_discord_sources WHERE message_id=?').bind(ids[3]).first('capturer_name'),'[REDACTED:email]')
 assert.equal(await runtime.db.prepare('SELECT capturer_name FROM penny_discord_jobs WHERE message_id=?').bind(ids[3]).first('capturer_name'),'[REDACTED:email]')
 // A pause during the network read must invalidate the completion transaction.
 await signed(command(ids[4]));onRead=async id=>{if(id===ids[4]){onRead=async()=>{};await json('/api/operator/integrations/discord',{...settings,enabled:false},operator,'PUT')}}
 await runtime.schedule().catch(error=>{assert.match(error.message,/scheduled/)});assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_sources WHERE message_id=?').bind(ids[4]).first('n'),0)
 await json('/api/operator/integrations/discord',settings,operator,'PUT');await json('/api/operator/integrations/discord/jobs',{id:`${guild}/${channel}/${ids[4]}`,action:'stop'},operator)
 // Source edits never replace the captured version; removal purges all versions.
 modes.set(ids[0],'changed');modes.set(ids[1],404);await runtime.db.prepare("UPDATE penny_discord_sources SET next_check='2000-01-01T00:00:00Z'").run();await runtime.schedule();await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT source_state FROM penny_discord_sources WHERE message_id=?').bind(ids[0]).first('source_state'),'changed');assert.equal(await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(rows[0].evidence_id).first('wording'),rows[0].wording)
 assert.equal(await runtime.db.prepare('SELECT source_state FROM penny_discord_sources WHERE message_id=?').bind(ids[1]).first('source_state'),'purged');assert.equal(await runtime.db.prepare('SELECT wording FROM evidence_versions WHERE evidence_id=?').bind(rows[1].evidence_id).first('wording'),'[Source removed]')
 assert.equal(await runtime.db.prepare("SELECT count(*) n FROM audit_entries WHERE action='discord.source_purged' AND entity_id=?").bind(rows[1].evidence_id).first('n'),1,'A repeated schedule records the purge audit once')
 await signed(command(ids[5]));const portable=await json('/api/operator/data/export',undefined,operator),archive=portable.archive
 assert.equal(archive.tables.penny_discord_settings[0].enabled,0);assert.equal(archive.tables.penny_discord_jobs.find(job=>job.message_id===ids[5]).state,'held');assert.doesNotMatch(JSON.stringify(archive),new RegExp(config.botToken+'|'+config.gatewaySecret));assert.equal(archive.tables.penny_discord_sources.length,4);assert.ok(!JSON.stringify(archive).includes('trigger.secret@example.test'))

 // Restore through the public data door: archived operator IDs never restart a connector.
 const restored=await startBrowserRuntime()
 try{
  const boot=await fetch(restored.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'})});assert.equal(boot.status,303)
  const restoredCookie=boot.headers.get('set-cookie').split(';')[0]
  async function post(path,body){const response=await fetch(restored.origin+path,{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
  let operation=await post('/api/operator/data/import',portable)
  for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await post(`/api/operator/data/operations/${operation.operationId}/resume`,{})
  assert.equal(operation.status,'complete');assert.equal(await restored.db.prepare('SELECT enabled FROM penny_discord_settings').first('enabled'),0);assert.equal(await restored.db.prepare('SELECT state FROM penny_discord_jobs WHERE message_id=?').bind(ids[5]).first('state'),'held')
  await restored.schedule();assert.equal(await restored.db.prepare('SELECT count(*) n FROM penny_discord_sources').first('n'),4)
 }finally{await restored.close()}
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 // Behavior above runs at 1440; visual and accessibility proof covers both widths once.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:900})
  for(const screen of ['settings','inbox']){
   await page.goto(origin+(screen==='settings'?'/app/settings#discord-capture':'/app/feedback'),{waitUntil:'networkidle'});if(screen==='settings')await page.reload({waitUntil:'networkidle'});const region=screen==='settings'?panel:page.locator(`#evidence-${rows[0].evidence_id}`)
   if(screen==='inbox'){await region.getByRole('link',{name:'Open Discord message'}).waitFor();assert.equal(await region.getByRole('link',{name:'Open Discord message'}).getAttribute('href'),rows[0].jump_url);await region.getByText('Source: changed',{exact:true}).waitFor()}
   await region.scrollIntoViewIfNeeded();await page.evaluate(async()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(axe);assert.deepEqual(await region.evaluate(async element=>(await window.axe.run(element)).violations.filter(v=>['serious','critical'].includes(v.impact))),[]);await page.evaluate(()=>scrollTo(0,0));const clip=await region.boundingBox();assert.ok(clip);await page.screenshot({fullPage:true,clip,path:join(output,`discord-${screen}-${width}.png`)})
  }
 }

 // Explicit forgetting and evidence erasure retain only hash replay custody.
 await json('/api/operator/integrations/discord/jobs',{id:`${guild}/${channel}/${ids[4]}`,action:'forget'},operator)
 await signed(command(ids[4]));assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_jobs WHERE message_id=?').bind(ids[4]).first('n'),0)
 async function dataPost(path,body){const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin,...operator,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(response.status),await response.clone().text());return response.json()}
 let preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:rows[0].evidence_id})
 for(let step=0;preview.status==='pending'&&step<100;step++)preview=await dataPost('/api/operator/data/erasure/preview',{table:'evidence_items',id:rows[0].evidence_id,continuation:preview.continuation})
 assert.deepEqual(preview.blockedCopies,[]);assert.equal(preview.counts.penny_discord_sources,1);assert.equal(preview.counts.penny_discord_jobs,1)
 let erased=await dataPost('/api/operator/data/erasure',{table:'evidence_items',id:rows[0].evidence_id,planHash:preview.planHash})
 for(let step=0;erased.status!=='complete'&&step<100;step++)erased=await dataPost(`/api/operator/data/operations/${erased.operationId}/resume`,{})
 assert.equal(erased.status,'complete');await signed(command(ids[0]));await signed(reaction(ids[0]),{relay:true});await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM evidence_items WHERE id=?').bind(rows[0].evidence_id).first('n'),0);assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_discord_jobs WHERE message_id=?').bind(ids[0]).first('n'),0)
 const visitor=await browser.newPage();await visitor.goto(origin+'/portal/feedback',{waitUntil:'networkidle'});assert.doesNotMatch(await visitor.content(),/Trigger member|Source author|discord.com\/channels|Please add scheduled exports/);await visitor.close();await send('/api/operator/integrations/discord',undefined,{},'GET',401);assert.deepEqual(errors,[])
 console.log('Discord capture journey passed: signed command/reaction, scope, redaction, replay/restart, retry/stop, source authority, archive holds and 1440/390 UI')
}finally{for(const context of contexts)await context.close();await browser.close();await runtime.close()}
