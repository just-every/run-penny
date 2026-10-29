import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {startBrowserRuntime} from './base-runtime.mjs'
import {browserOptions} from './browser-options.mjs'
const output=resolve(process.env.PENNY_EVIDENCE??'../evidence/survey-capture')
assert.ok(!output.startsWith(resolve('.')+'/'));await mkdir(output,{recursive:true})
const providers=['typeform','surveymonkey','google','pencil'],formId='selected-form'
const secrets=Object.fromEntries(providers.map(id=>[id,{token:'synthetic-'+id+'-read-token',webhookSecret:'synthetic-'+id+'-webhook-secret-123456',...(id==='surveymonkey'?{clientId:'synthetic-sm-client'}:{}),...(id==='pencil'?{origin:'https://pencil.example.test',cookie:'pencil_session=synthetic-session-cookie'}:{})}]))
const time='2026-10-28T12:30:00.000Z',reads=[],modes=new Map()
let onRead=async()=>{},googlePageCount=0
function fixture(provider,id='response-'+provider,changed=false){
 const wording=changed?'Edited source answer':'Please add scheduled exports for '+id+'. SSN 123-45-6789.'
 if(provider==='typeform')return {token:id,form_id:formId,submitted_at:time,answers:[{field:{id:'feedback'},type:'text',text:wording},{field:{id:'plan'},type:'choice',choice:{label:'Enterprise'}},{field:{id:'unmapped'},type:'text',text:'UNMAPPED_SECRET_TYPEFORM'}],hidden:{email:'survey.person@example.test',account:'survey-account',unused:'UNMAPPED_HIDDEN_TYPEFORM'}}
 if(provider==='surveymonkey')return {id,survey_id:formId,date_created:time,pages:[{questions:[{id:'feedback',answers:[{text:wording}]},{id:'plan',answers:[{text:'Enterprise'}]},{id:'unmapped',answers:[{text:'UNMAPPED_SECRET_SURVEYMONKEY'}]}]}],custom_variables:{email:'survey.person@example.test',account:'survey-account',unused:'UNMAPPED_HIDDEN_SM'}}
 if(provider==='google')return {responseId:id,createTime:time,lastSubmittedTime:time,respondentEmail:'survey.person@example.test',answers:{feedback:{questionId:'feedback',textAnswers:{answers:[{value:wording}]}},plan:{questionId:'plan',textAnswers:{answers:[{value:'Enterprise'}]}},unmapped:{questionId:'unmapped',textAnswers:{answers:[{value:'UNMAPPED_SECRET_GOOGLE'}]}}}}
 return {id,completedAt:time,state:'released',answers:[{stepId:'feedback',questionType:'long_text',displayValue:wording},{stepId:'plan',questionType:'multiple_choice',displayValue:'Enterprise'},{stepId:'unmapped',questionType:'long_text',displayValue:'UNMAPPED_SECRET_PENCIL'}],hiddenFields:[{name:'unused',value:'UNMAPPED_HIDDEN_PENCIL'}]}
}
const edge={name:'survey-network-edge',modules:true,compatibilityDate:'2026-08-31',script:`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Edge extends WorkerEntrypoint{async send(wire){const r=await fetch(wire.url,{headers:wire.headers,redirect:'manual'});return {status:r.status,headers:{},body:await r.text()}}}`,outboundService:async request=>{
 const u=new URL(request.url),provider=u.hostname==='api.typeform.com'?'typeform':u.hostname==='api.surveymonkey.com'?'surveymonkey':u.hostname==='forms.googleapis.com'?'google':u.hostname==='pencil.example.test'?'pencil':null
 assert.ok(provider,'Only declared survey providers are read');assert.equal(request.method,'GET');assert.ok(u.pathname.includes('/'+formId+'/'),'No request for an unselected form')
 assert.equal(request.headers.get(provider==='pencil'?'Cookie':'Authorization'),provider==='pencil'?secrets.pencil.cookie:'Bearer '+secrets[provider].token)
 const id=provider==='typeform'?u.searchParams.get('included_response_ids'):provider==='surveymonkey'?u.pathname.split('/').at(-2):provider==='google'&&u.pathname.split('/').at(-1)!=='responses'?u.pathname.split('/').at(-1):'response-'+provider
 reads.push({provider,id,path:u.pathname});await onRead(provider,id)
 const mode=provider==='google'&&u.pathname.endsWith('/responses')?null:modes.get(provider+':'+id);if(typeof mode==='number')return Response.json({error:'synthetic refusal'},{status:mode})
 if(provider==='google'&&u.pathname.endsWith('/responses')){
  googlePageCount++
  return Response.json(u.searchParams.has('pageToken')?{responses:[]}:{responses:[fixture(provider)],nextPageToken:'page-2'})
 }
 if(provider==='typeform'){const value=fixture(provider,id,mode==='changed');delete value.form_id;return Response.json({items:[value]})}
 if(provider==='pencil')return Response.json({flow:{id:formId},total:2,responses:u.searchParams.has('offset')?[fixture(provider,id,mode==='changed')]:[{id:'older-response'}]})
 return Response.json(fixture(provider,id,mode==='changed'))
}}
const runtime=await startBrowserRuntime({bindings:{PENNY_SURVEYS:JSON.stringify(secrets)},networkWorker:edge,networkBinding:'PENNY_SURVEY_EGRESS'}),browser=await chromium.launch(browserOptions())
let context
try{
 const {origin}=runtime;let ip=0
 async function send(path,body,headers={},method=body===undefined?'GET':'POST',status=200){
  const r=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,'CF-Connecting-IP':`198.19.${Math.floor(ip/250)}.${++ip%250+1}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.ok((Array.isArray(status)?status:[status]).includes(r.status),`${method} ${path}: ${await r.clone().text()}`);return r
 }
 const json=async(...args)=>(await send(...args)).json()
 const boot=await send('/auth/bootstrap',{token:'synthetic-base-browser-setup-token-12345',displayName:'Survey owner'},{},'POST',303),Cookie=boot.headers.get('set-cookie').split(';')[0],operator={Cookie}
 const finish=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({confirm:'yes',companyName:'Harbor Analytics',postalAddress:'14 Market Street, Boston MA 02110',timezone:'UTC',quietEnabled:'yes',quietStart:'20',quietEnd:'8'})});assert.equal(finish.status,303)
 // A populated native account is pre-existing source context, never minted by capture.
 await runtime.db.prepare("INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES('survey-account','survey-account','Survey account',?,?)").bind(time,time).run()
 await json('/api/operator/settings/redaction',{enabled:true,kinds:['ssn'],patterns:[]},operator,'PUT')
 const settings=p=>({id:p,provider:p,formId,mapping:{evidence:['feedback'],attributes:[{question:'plan',key:'plan'}],email:'hidden.email',account:p==='google'?null:'hidden.account'},responseUrl:`https://${p}.example.test/responses/{responseId}`,enabled:true,purgeDays:0})
 await send('/api/operator/integrations/surveys',undefined,{},'GET',401)
 await send('/api/integrations/surveys/missing',{}, {},'POST',404)
 await send('/api/operator/integrations/surveys',settings('typeform'),{},'PUT',401)
 await send('/api/operator/integrations/surveys',settings('typeform'),{...operator,Origin:'https://evil.test'},'PUT',403)
 context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:Cookie.split('=')[0],value:Cookie.slice(Cookie.indexOf('=')+1),url:origin}])
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)errors.push('External browser request')})
 await page.goto(origin+'/app/settings#survey-capture',{waitUntil:'networkidle'})
 const panel=page.getByRole('region',{name:'Survey capture',exact:true})
 await panel.getByLabel('Connection name',{exact:true}).fill('typeform');await panel.getByLabel('Selected form ID',{exact:true}).fill(formId);await panel.getByLabel('Open-text question IDs',{exact:true}).fill('feedback');await panel.getByLabel('Private attribute mappings',{exact:true}).fill('plan=plan');await panel.getByLabel('Respondent email question or hidden field',{exact:true}).fill('hidden.email');await panel.getByLabel('Account question or hidden field',{exact:true}).fill('hidden.account');await panel.getByLabel('Response link template',{exact:true}).fill(settings('typeform').responseUrl);await panel.getByLabel('Enable selected form',{exact:true}).check();await panel.getByRole('button',{name:'Save survey capture',exact:true}).click();await panel.getByText('Survey settings saved.',{exact:true}).waitFor()
 for(const provider of providers.slice(1))await json('/api/operator/integrations/surveys',settings(provider),operator,'PUT')
 async function webhook(provider,id='response-'+provider,{bad=false,foreign=false,removed=false}={}){
  const body=provider==='typeform'?{event_type:'form_response',form_response:{...fixture(provider,id),...(foreign?{form_id:'unselected-form'}:{})}}:provider==='surveymonkey'?{event_type:removed?'response_deleted':'response_completed',object_id:id,resources:{survey_id:foreign?'unselected-form':formId}}:{id:'event-'+id,type:removed?'response.deleted':'response.created',formId:foreign?'unselected-form':formId,responseId:id}
  const text=JSON.stringify(body),secret=secrets[provider],mac=createHmac(provider==='surveymonkey'?'sha1':'sha256',provider==='surveymonkey'?secret.clientId+'&'+secret.webhookSecret:secret.webhookSecret).update(text).digest(provider==='pencil'?'hex':'base64')
  const signature=(provider==='surveymonkey'?'':'sha256=')+(bad?'invalid':mac)
  return fetch(origin+'/api/integrations/surveys/'+provider,{method:'POST',headers:{'Content-Type':'application/json',...(provider==='surveymonkey'?{'Sm-Apikey':secret.clientId,'Sm-Signature':signature}:provider==='typeform'?{'Typeform-Signature':signature}:{'Pencil-Signature':signature})},body:text})
 }
 for(const provider of ['typeform','surveymonkey','pencil']){
  assert.equal((await webhook(provider,undefined,{bad:true})).status,401)
  const foreign=await webhook(provider,undefined,{foreign:true});assert.ok([400,403].includes(foreign.status))
  if(provider==='surveymonkey')assert.equal((await fetch(origin+'/api/integrations/surveys/'+provider,{method:'HEAD'})).status,200)
  const first=await webhook(provider);assert.equal(first.status,202,await first.clone().text())
  assert.equal((await (await webhook(provider)).json()).duplicate,true)
 }
 await runtime.schedule();await runtime.schedule(Date.now()+1000)
 assert.equal(googlePageCount,2,'Google page cursor resumes without re-reading the first page')
 console.log('Survey: all providers captured; checking privacy and lifecycle')
 let cards=(await json('/api/operator/evidence',undefined,operator)).items.filter(item=>item.survey)
 assert.equal(cards.length,4)
 const before=(await runtime.db.prepare('SELECT e.*,v.wording,s.*,j.form_id FROM evidence_items e JOIN evidence_versions v ON v.evidence_id=e.id JOIN penny_survey_sources s ON s.evidence_id=e.id JOIN penny_survey_jobs j ON j.id=s.job_id ORDER BY j.form_id').all()).results
 for(const row of before){
  assert.equal(row.review_state,'unreviewed');assert.equal(JSON.parse(row.attributes_json).plan,'Enterprise');assert.match(row.wording,/\[REDACTED:ssn\]/);assert.doesNotMatch(JSON.stringify(row),/123-45-6789|UNMAPPED_/)
  assert.equal(row.response_url,`https://${row.form_id}.example.test/responses/response-${row.form_id}`)
  if(!['google','pencil'].includes(row.form_id))assert.equal(row.account_id,'survey-account')
  if(row.form_id==='pencil'){assert.equal(row.requester_id,null);assert.equal(row.account_id,null)}else
  assert.ok(row.requester_id,'The selected respondent email maps to a non-authorizing contact')
 }
 const identity=await runtime.db.prepare("SELECT * FROM requester_addresses WHERE email='survey.person@example.test'").first();assert.ok(identity);assert.equal(identity.verified_at,null)
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM requester_update_permissions WHERE requester_id=?').bind(identity.requester_id).first('n'),0)
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM native_requester_sessions WHERE requester_id=?').bind(identity.requester_id).first('n'),0)
 for(const provider of ['typeform','surveymonkey','pencil'])assert.equal((await (await webhook(provider)).json()).duplicate,true)
 await runtime.restart();await runtime.schedule();assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_survey_sources').first('n'),4)
 // Visible failure persists across restart and is retried through the owner door.
 modes.set('surveymonkey:response-retry',503);assert.equal((await webhook('surveymonkey','response-retry')).status,202);await runtime.schedule()
 let progress=await json('/api/operator/integrations/surveys',undefined,operator);assert.equal(progress.forms.find(f=>f.id==='surveymonkey').state,'failed')
 await runtime.restart();await runtime.schedule();assert.equal((await json('/api/operator/integrations/surveys',undefined,operator)).forms.find(f=>f.id==='surveymonkey').state,'failed')
 modes.delete('surveymonkey:response-retry');await json('/api/operator/integrations/surveys/work',{id:'surveymonkey',action:'retry'},operator);await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_survey_sources').first('n'),5)
 // Kill a real Worker while its provider read is in flight; no answer is stored.
 assert.equal((await webhook('surveymonkey','response-killed')).status,202)
 let enter,release;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r)
 onRead=async(p,id)=>{if(p==='surveymonkey'&&id==='response-killed'){enter();await hold}}
 const running=runtime.schedule().catch(()=>{});await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(Error('Provider read was not reached')),15000))])
 const killedClock=Date.now();try{await runtime.restart()}finally{release();onRead=async()=>{}}
 await running;await runtime.schedule(killedClock+301000)
 progress=await json('/api/operator/integrations/surveys',undefined,operator)
 assert.equal(progress.forms.find(f=>f.id==='surveymonkey').failure,'survey_interrupted_retry_required')
 assert.equal(progress.jobs.find(j=>j.response_id==='response-killed').state,'failed')
 await json('/api/operator/integrations/surveys/work',{id:'surveymonkey',action:'retry'},operator);await runtime.schedule()
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_survey_sources').first('n'),6)
 // A scope revision during a read fences its completion.
 await webhook('surveymonkey','response-paused')
 onRead=async(p,id)=>{if(id==='response-paused'){onRead=async()=>{};await json('/api/operator/integrations/surveys',{...settings('surveymonkey'),enabled:false},operator,'PUT')}}
 await runtime.schedule();assert.equal(await runtime.db.prepare("SELECT count(*) n FROM penny_survey_jobs WHERE response_id='response-paused' AND evidence_id IS NOT NULL").first('n'),0)
 const readCount=reads.length;await runtime.schedule();assert.equal(reads.length,readCount,'Paused connector reads nothing')
 // Source changes preserve the captured version; source removal purges it.
 modes.set('typeform:response-typeform','changed');modes.set('google:response-google',404)
 await json('/api/operator/integrations/surveys/work',{id:'typeform',action:'retry'},operator)
 await json('/api/operator/integrations/surveys/work',{id:'google',action:'retry'},operator)
 await runtime.schedule()
 // A real SQLite abort exercises a failed purge transaction through Cron.
 await runtime.db.prepare("CREATE TRIGGER survey_purge_fault BEFORE UPDATE OF wording ON evidence_versions WHEN OLD.evidence_id IN(SELECT s.evidence_id FROM penny_survey_sources s JOIN penny_survey_jobs j ON j.id=s.job_id WHERE j.form_id='google') BEGIN SELECT RAISE(ABORT,'synthetic storage interruption'); END").run()
 await runtime.schedule()
 assert.equal((await json('/api/operator/integrations/surveys',undefined,operator)).forms.find(f=>f.id==='google').failure,'survey_purge_failed')
 await runtime.db.prepare('DROP TRIGGER survey_purge_fault').run()
 await runtime.schedule()
 assert.equal((await json('/api/operator/integrations/surveys',undefined,operator)).forms.find(f=>f.id==='google').failure,'survey_purge_failed','Purge failure stays visible until owner acknowledgement')
 await json('/api/operator/integrations/surveys/work',{id:'google',action:'retry'},operator)
 cards=(await json('/api/operator/evidence',undefined,operator)).items.filter(item=>item.survey)
 assert.equal(cards.find(c=>c.sourceLabel==='typeform survey '+formId).survey.sourceState,'changed')
 assert.match(cards.find(c=>c.sourceLabel==='typeform survey '+formId).wording,/scheduled exports/)
 assert.equal(cards.find(c=>c.sourceLabel==='google survey '+formId).survey.sourceState,'purged')
 assert.equal(cards.find(c=>c.sourceLabel==='google survey '+formId).wording,'[Source removed]')
 // Export sees only selected values, excludes credentials and holds restored work.
 const tableNames=(await runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'").all()).results.map(r=>r.name)
 for(const table of tableNames){
  assert.match(table,/^[A-Za-z0-9_]+$/)
  assert.doesNotMatch(JSON.stringify((await runtime.db.prepare('SELECT * FROM "'+table+'"').all()).results),/UNMAPPED_/,'No unmapped value enters any D1 table: '+table)
 }
 const portable=await json('/api/operator/data/export',undefined,operator),archive=portable.archive
 assert.doesNotMatch(JSON.stringify(archive),/UNMAPPED_|123-45-6789|synthetic-.*(?:token|secret|cookie)/)
 assert.ok(archive.tables.penny_survey_forms.every(f=>f.enabled===0&&f.state==='held'))
 assert.ok(archive.tables.penny_survey_jobs.filter(j=>j.state!=='done').every(j=>['held','stopped'].includes(j.state)))
 const restored=await startBrowserRuntime()
 try{
  const boot=await fetch(restored.origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:restored.origin,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-base-browser-setup-token-12345',displayName:'Restore owner'})});assert.equal(boot.status,303)
  const cookie=boot.headers.get('set-cookie').split(';')[0]
  async function post(path,body){const r=await fetch(restored.origin+path,{method:'POST',headers:{Origin:restored.origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok([200,202].includes(r.status),await r.clone().text());return r.json()}
  let op=await post('/api/operator/data/import',portable)
  for(let i=0;op.status!=='complete'&&i<100;i++)op=await post('/api/operator/data/operations/'+op.operationId+'/resume',{})
  assert.equal(op.status,'complete');await restored.schedule();assert.equal(await restored.db.prepare('SELECT count(*) n FROM penny_survey_sources').first('n'),6)
 }finally{await restored.close()}
 const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8')
 // Behavioral assertions run at 1440; once-per-screen proof covers both widths.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:900})
  for(const screen of ['settings','inbox']){
   await page.goto(origin+(screen==='settings'?'/app/settings#survey-capture':'/app/feedback'),{waitUntil:'networkidle'})
   const region=screen==='settings'?panel:page.locator('#evidence-'+before.find(r=>r.form_id==='typeform').evidence_id)
   await region.scrollIntoViewIfNeeded();await page.evaluate(async()=>document.fonts.ready)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await page.evaluate(axe);assert.deepEqual(await region.evaluate(async e=>(await window.axe.run(e)).violations.filter(v=>['serious','critical'].includes(v.impact))),[])
   await page.evaluate(()=>scrollTo(0,0));const clip=await region.boundingBox();assert.ok(clip);await page.screenshot({fullPage:true,clip,path:join(output,`survey-${screen}-${width}.png`)})
  }
 }
 // Native erasure closes survey copies; replay keeps only a wording-free hash.
 const root={table:'evidence_items',id:before.find(r=>r.form_id==='typeform').evidence_id}
 let preview=await json('/api/operator/data/erasure/preview',root,operator)
 for(let i=0;preview.status==='pending'&&i<100;i++)preview=await json('/api/operator/data/erasure/preview',{...root,continuation:preview.continuation},operator)
 assert.deepEqual(preview.blockedCopies,[]);assert.equal(preview.counts.penny_survey_sources,1);assert.equal(preview.counts.penny_survey_jobs,1)
 let operation=await json('/api/operator/data/erasure',{...root,planHash:preview.planHash},operator,'POST',[200,202])
 for(let i=0;operation.status!=='complete'&&i<100;i++)operation=await json('/api/operator/data/operations/'+operation.operationId+'/resume',{},operator,'POST',[200,202])
 assert.equal(operation.status,'complete');assert.equal((await (await webhook('typeform')).json()).duplicate,true,'Erasure retains the independent replay receipt')
 assert.equal(await runtime.db.prepare('SELECT count(*) n FROM penny_survey_sources').first('n'),5)
 const visitor=await browser.newPage();await visitor.goto(origin+'/portal/feedback',{waitUntil:'networkidle'});assert.doesNotMatch(await visitor.content(),/Enterprise|survey.person|scheduled exports|survey\.example/);await visitor.close();assert.deepEqual(errors,[])
 console.log('Survey capture journey passed: four providers, selected mappings, signed replay, scoped reads, non-authorizing identity, interruption/retry/pause, source authority, portable privacy, erasure and 1440/390 UI.')
}finally{await context?.close();await browser.close();await runtime.close()}
