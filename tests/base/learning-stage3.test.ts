import {expect,it,vi} from 'vitest'
import {mockMail,messages,call as publicCall} from './support'
import {env} from 'cloudflare:workers'
import {createPennyRuntime} from '@/core/app/runtime'
import {drainLearning} from '@/core/features/learning/scheduled'
import { exportArchive,planErasure,normalize } from '@/core/features/data/archive'
import { eraseEntity } from '@/core/features/data/operations'
import {canonical} from '@/core/features/data/archive'
import {call,json,fixture,path,bindings,sent,network,resetLearningRuntime} from './learning-test-runtime'
import {explicitConsentBoard} from './explicit-consent-board'

async function scheduledAccounting(){
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}`,runtime=createPennyRuntime(bindings())
 await seedLearningDraft()
 const effects=await learningEffects()
 await env.DB.prepare('UPDATE learning_investigations SET budget_micros=101100 WHERE id=?').bind(f.investigation.id).run()
 await drainLearning(runtime,Date.now()+1000)
 const first=await json<LearningRunDetail>(call(url,undefined,f.cookie))
 expect(first.runs).toMatchObject([{state:'complete',reserved_micros:100000,actual_micros:1100,reason:'material_learning'}])
 expect(first.runs[0].event_key).toMatch(/^scheduled:/);expect(first.runs[0].claim).toBeTruthy()
 const cursor=JSON.parse(first.runs[0].cursor_json)
 expect(cursor).toHaveLength(2)
 expect(cursor).toEqual(expect.arrayContaining(first.observations.map(o=>({eventKey:o.event_key,contentHash:o.content_hash}))))
 expect(first.artifacts).toHaveLength(1)
 expect(await env.DB.prepare('SELECT spent_micros FROM learning_investigations WHERE id=?').bind(f.investigation.id).first('spent_micros')).toBe(1100)
 await dueLearning(f.investigation.id)
 await drainLearning(runtime,Date.now()+1000)
 const unchanged=await json<LearningRunDetail>(call(url,undefined,f.cookie))
 expect(unchanged.runs).toHaveLength(2)
 expect(JSON.parse(unchanged.runs.find(r=>r.reason==='unchanged')!.cursor_json)).toEqual(cursor)
 expect(unchanged.artifacts).toEqual(first.artifacts);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
 const afterUnchanged=sent.length
 // Redelivering the same scheduled event does not acquire or reserve twice.
 await dueLearning(f.investigation.id);await drainLearning(runtime,Date.now()+1000)
 expect(sent).toHaveLength(afterUnchanged)
 expect((await json<LearningRunDetail>(call(url,undefined,f.cookie))).runs).toHaveLength(2)
 await dueLearning(f.investigation.id,'2000-01-02T00:00:00.000Z')
 network.sourceText=canonical({id:'cancellation',subject:'A revised handoff needs another comparison.',occurred_at:'2026-10-02T00:00:00Z'})
 network.beforeModel=async()=>{throw Error('synthetic-penny-1')}
 await drainLearning(runtime,Date.now()+1000);network.beforeModel=undefined
 const uncertain=await json<LearningRunDetail>(call(url,undefined,f.cookie))
 expect(uncertain.runs.find(r=>r.state==='uncertain')).toMatchObject({actual_micros:null,reserved_micros:100000,reason:'learning_transport_failed'})
 expect(uncertain.investigation).toMatchObject({state:'paused',spentMicros:101100,reservedCostMicros:100000,actualCostMicros:1100})
 const home=await json<{investigations:Record<string,unknown>[]}>(call(path,undefined,f.cookie))
 expect(home.investigations.find(i=>i.id===f.investigation.id)).toMatchObject({reservedCostMicros:100000,actualCostMicros:1100})
 expect((await env.DB.prepare("SELECT state,actual_micros,reserved_micros FROM penny_ai_runs WHERE state='uncertain'").all()).results).toEqual([{state:'uncertain',actual_micros:null,reserved_micros:100000}])
 const noRetry=sent.length
 await dueLearning(f.investigation.id,'2000-01-03T00:00:00.000Z');await drainLearning(runtime,Date.now()+1000)
 expect((await call(url+'/control',{action:'resume'},f.cookie)).status).toBe(409)
 expect((await call(url+'/run',{},f.cookie)).ok).toBe(false)
 expect(sent).toHaveLength(noRetry)
 await json(call('/api/operator/settings/ai',{monthlyBudgetMicros:101100,includePrivate:true,choices:[]},f.cookie,undefined,'PUT'))
 const sibling=await json<{id:string}>(call(path+'/investigations',{nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:'Independent bounded comparison',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:100000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201)
 const refused=await call(path+`/investigations/${sibling.id}/run`,{},f.cookie)
 expect(refused.status).toBe(409);expect(await refused.json()).toMatchObject({error:'ai_budget_exhausted'})
 expect(await env.DB.prepare('SELECT spent_micros FROM learning_investigations WHERE id=?').bind(sibling.id).first('spent_micros')).toBe(0)
 expect(sent).toHaveLength(noRetry)
 expect((await json<LearningRunDetail>(call(url,undefined,f.cookie))).artifacts).toEqual(first.artifacts.map(a=>({...a,state:'contested'})))

 // A different Worker may find a durable running claim at the next due window.
 // It must hold that interrupted attempt, including a late provider response.
 await json(call(path+`/investigations/${sibling.id}/control`,{action:'pause'},f.cookie))
 await json(call('/api/operator/settings/ai',{monthlyBudgetMicros:100000000,includePrivate:true,choices:[]},f.cookie,undefined,'PUT'))
 const interrupted=await json<{id:string}>(call(path+'/investigations',{nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:'Interrupted bounded comparison',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:100000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201)
 let entered!:()=>void,release!:()=>void
 const reached=new Promise<void>(resolve=>{entered=resolve}),held=new Promise<void>(resolve=>{release=resolve})
 network.beforeModel=async()=>{entered();await held}
 const pending=drainLearning(runtime,Date.now()+1000)
 try{
  await reached;const transmitted=sent.length
  await dueLearning(interrupted.id);await drainLearning(runtime,Date.now()+1000)
  expect(sent).toHaveLength(transmitted)
  const detail=await json<LearningRunDetail>(call(path+`/investigations/${interrupted.id}`,undefined,f.cookie))
  expect(detail.investigation).toMatchObject({state:'paused',spentMicros:100000,reservedCostMicros:100000})
  expect(detail.runs).toMatchObject([{state:'uncertain',actual_micros:null,reserved_micros:100000,reason:'learning_interrupted'}])
  expect(JSON.parse(detail.runs[0].cursor_json)).toHaveLength(1)
  expect((await env.DB.prepare("SELECT actor_type,actor_id FROM audit_entries WHERE action='learning.schedule_paused' AND entity_id=? AND json_extract(details_json,'$.reason')='learning_interrupted'").bind(interrupted.id).all()).results).toEqual([{actor_type:'system',actor_id:'learning.scheduler'}])
 }finally{release();await pending;network.beforeModel=undefined}
 const late=await json<LearningRunDetail>(call(path+`/investigations/${interrupted.id}`,undefined,f.cookie))
 expect(late.artifacts).toEqual([]);expect(late.runs).toMatchObject([{state:'uncertain',actual_micros:null,reserved_micros:100000}])
 const noLateRetry=sent.length;await dueLearning(interrupted.id);await drainLearning(runtime,Date.now()+1000);expect(sent).toHaveLength(noLateRetry)
 expect(await learningEffects()).toEqual(effects)
 expect(sent.every(s=>s.startsWith('GET https://orbit.example.com/api/delegation/v1/evidence?')||s.startsWith('POST https://api.anthropic.com/v1/messages')||s.startsWith('POST https://api.openai.com/v1/chat/completions'))).toBe(true)
}

async function scheduledAuthority(){
 const f=await fixture(),runtime=createPennyRuntime(bindings())
 await json(call(path+`/investigations/${f.investigation.id}/control`,{action:'pause'},f.cookie))
 await seedLearningDraft();const effects=await learningEffects()
 for(const phase of ['before-source','before-model','result'] as const){
  for(const gate of ['source','purpose','native authority','expiry','budget','correction','erasure'] as const){
   // Purpose changes and corrections are valid new grants before acquisition;
   // the dangerous case is a version that moves while a run is in flight.
   if(phase==='before-source'&&['purpose','correction','erasure'].includes(gate))continue
   const label=`${phase}: ${gate}`
   const target='synthetic-penny-'+crypto.randomUUID()
   const source=await json<{id:string}>(call(path+'/sources',{name:'Selected synthetic evidence',provider:'orbit',resourceIds:[`signals/${target}`],useBasis:'Bounded internal comparison',allOperatorsAuthorized:true},f.cookie),201)
   const evidence=await json<{id:string;versionId:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Independent comparison note',wording:'A handoff needs a clearer report.',observedAt:'2026-10-01T00:00:00Z'},f.cookie),201)
   const erased=gate==='erasure'?await json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Independent erasure target',wording:'Remove this unrelated private contribution.',observedAt:'2026-10-01T00:00:00Z'},f.cookie),201):null
   let grantCookie=f.cookie,nativeId=''
   if(gate==='native authority'){
    const email=['synthetic-penny-'+crypto.randomUUID(),'example.test'].join('@')
    mockMail()
    try{
     await json(call('/api/operator/settings/operators',{email},f.cookie),202)
     const response=await call('/auth/confirm',{token:new URL(messages.findLast(m=>m.to===email)!.url).searchParams.get('token')})
     expect(response.status).toBe(303);grantCookie=response.headers.get('set-cookie')!.split(';')[0]
    }finally{vi.restoreAllMocks()}
    nativeId=(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<string>('id'))!
   }
   const grant=await json<{id:string}>(call(path+'/investigations',{sourceId:source.id,nativeEvidenceIds:[evidence.id],nativeRequestIds:[],purpose:'Bounded internal comparison',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},grantCookie),201)
   const url=path+`/investigations/${grant.id}`
   network.sourceText=canonical({id:target,subject:'Original permitted handoff evidence.',contact_id:source.id,occurred_at:'2026-10-01T00:00:00Z'})
   const first=await json<{artifactId:string}>(call(url+'/run',{},grantCookie))
   const artifacts=await env.DB.prepare('SELECT count(*) n FROM learning_artifacts WHERE investigation_id=?').bind(grant.id).first<number>('n')
   const change=async()=>{
    if(gate==='source')await json(call(path+`/sources/${source.id}/disconnect`,{},f.cookie))
    if(gate==='purpose')await env.DB.prepare("UPDATE learning_investigations SET purpose='A different purpose' WHERE id=?").bind(grant.id).run()
    if(gate==='native authority')await json(call(`/api/operator/settings/operators/${nativeId}`,{},f.cookie,undefined,'DELETE'))
    // Fixed past expiry avoids a wall-clock race while exercising D1's clock.
    if(gate==='expiry')await env.DB.prepare("UPDATE learning_investigations SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").bind(grant.id).run()
    if(gate==='budget')await env.DB.prepare('UPDATE learning_investigations SET budget_micros=1100 WHERE id=?').bind(grant.id).run()
    if(gate==='correction'){
     if(phase==='result')await json(call(`/api/operator/evidence/${evidence.id}/wording`,{wording:'Corrected native contribution.',expectedVersionId:evidence.versionId},f.cookie,undefined,'PATCH'))
     else await json(call(url+'/correct',{interpretationId:first.artifactId,correction:'Reassess this interpretation before using it.'},f.cookie))
    }
    if(gate==='erasure'){
     const target={table:'evidence_items',id:erased!.id},preview=await json<{planHash:string}>(call('/api/operator/data/erasure/preview',target,f.cookie))
     await json(call('/api/operator/data/erasure',{...target,planHash:preview.planHash},f.cookie))
    }
   }
   network.sourceText=canonical({id:target,subject:'An in-flight revision must not escape its original grant.',contact_id:source.id,occurred_at:'2026-10-02T00:00:00Z'})
   await dueLearning(grant.id)
   const before=sent.length,modelCalls=sent.filter(s=>s.startsWith('POST')).length
   if(phase==='before-source')await change()
   if(phase==='before-model')network.beforeSource=change
   if(phase==='result')network.beforeModel=change
   try{await drainLearning(runtime,Date.now()+1000)}finally{network.beforeSource=undefined;network.beforeModel=undefined}
   expect(sent.filter(s=>s.startsWith('POST')).length,label).toBe(modelCalls+(phase==='result'?1:0))
   if(phase==='before-source')expect(sent.length,label).toBe(before)
   expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts WHERE investigation_id=?').bind(grant.id).first('n'),label).toBe(gate==='source'?0:artifacts)
   expect(await env.DB.prepare("SELECT count(*) n FROM learning_runs WHERE investigation_id=? AND event_key LIKE 'scheduled:%' AND state='complete'").bind(grant.id).first('n'),label).toBe(0)
   if(phase==='before-model'&&gate!=='source'){
    const runs=(await json<LearningRunDetail>(call(url,undefined,f.cookie))).runs
    expect(runs.find(r=>r.reason!=='material_learning'),label).toMatchObject({state:'refused',actual_micros:0})
    expect(await env.DB.prepare('SELECT spent_micros FROM learning_investigations WHERE id=?').bind(grant.id).first('spent_micros'),label).toBe(1100)
   }
   // A changed version can remain due; isolate it from the next scenario.
   await env.DB.prepare("UPDATE learning_investigations SET state='paused' WHERE id=? AND state='active'").bind(grant.id).run()
  }
 }
 expect(await learningEffects()).toEqual(effects)
}

interface LearningRunDetail {
 investigation:Record<string,unknown>
 observations:{event_key:string;content_hash:string}[]
 artifacts:Record<string,unknown>[]
 runs:{state:string;event_key:string;claim:string;reason:string;cursor_json:string;actual_micros:number|null;reserved_micros:number}[]
}
async function dueLearning(id:string,at='2000-01-01T00:00:00.000Z'){
 await env.DB.prepare('UPDATE learning_investigations SET next_run_at=? WHERE id=?').bind(at,id).run()
}
async function seedLearningDraft(){
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,created_at,updated_at) VALUES('synthetic-penny-1','synthetic-penny-1','Handoff improvement','Keep production unchanged','planned','2026-10-01','2026-10-01')").run()
}
async function learningEffects(){
 const tables=['roadmap_items','roadmap_publications','releases','release_versions','notification_outbox','integration_deliveries','penny_integration_events','penny_tracker_commands','learning_commitments']
 return Promise.all(tables.map(async table=>({table,rows:(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results})))
}
it('[LEARN-003 LEARN-004] bounded scheduled work accounts for interrupted spend, fences changed authority and supports native operator controls',async()=>{
 // Budget periods stay in one UTC month even when the host crosses midnight.
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'))
 try{
  await scheduledAccounting();await resetLearningRuntime()
  await scheduledAuthority()
 }finally{vi.useRealTimers()}
 await resetLearningRuntime()
 const f=await fixture(),runtime=createPennyRuntime(bindings()),url=path+`/investigations/${f.investigation.id}`
 await drainLearning(runtime,Date.now()+1000)
 const first=await env.DB.prepare('SELECT id FROM learning_artifacts').first<string>('id');expect(first).toBeTruthy()
 await json(call(url+'/commit',{interpretationId:first,optionId:'assist',rationale:'Preserve the original decision history',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201)
 const makeDue=()=>env.DB.prepare("UPDATE learning_investigations SET next_run_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(f.investigation.id).run()
 await makeDue();await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(1);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
 await json(call(url+'/control',{action:'pause'},f.cookie));await makeDue();const count=sent.length;await drainLearning(runtime,Date.now()+1000);expect(sent).toHaveLength(count)
 await json(call(url+'/control',{action:'resume'},f.cookie));const original=network.sourceText;network.sourceText=canonical({id:'cancellation',subject:'The assisted handoff worked; the export still lacks a date filter.',occurred_at:'2026-10-02T00:00:00Z',confidence:'observed'})
 await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(2)
 network.sourceText=original;const returned=await json<{unchanged:boolean;artifactId:string}>(call(url+'/run',{},f.cookie));expect(returned.unchanged).toBe(false);expect(returned.artifactId).not.toBe(first);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(1)
 const repeated=await json<{unchanged:boolean;artifactId:string}>(call(url+'/run',{},f.cookie));expect(repeated.unchanged).toBe(true);expect(repeated.artifactId).toBe(returned.artifactId)
 const correction='The workaround failed for the larger account.'
 await json(call(url+'/correct',{interpretationId:returned.artifactId,correction},f.cookie));const corrected=await json<{artifactId:string;unchanged:boolean}>(call(url+'/run',{},f.cookie));expect(corrected.unchanged).toBe(false);expect(corrected.artifactId).not.toBe(returned.artifactId)
 const correctedDetail=await json<{corrections:{correction:string}[]}>(call(url,undefined,f.cookie));expect(correctedDetail.corrections.some(row=>row.correction===correction)).toBe(true)
 const home=await json<{results:{invalidated:boolean}[]}>(call(path,undefined,f.cookie));expect(home.results[0].invalidated).toBe(true)
 network.beforeModel=async()=>{await json(call(url+'/control',{action:'pause'},f.cookie))}
 network.sourceText=canonical({id:'cancellation',subject:'Another supplied revision',occurred_at:'2026-10-03T00:00:00Z'})
 await makeDue();await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(0)
 await json(call(path+'/control',{action:'pause'},f.cookie));expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
 await json(call(path+`/sources/${f.source.id}/disconnect`,{},f.cookie));expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 const bundle=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(bundle.archive)).not.toContain('Another supplied revision');expect(bundle.journal.epoch).toBeGreaterThan(0)

 // Revoking one grant must not turn its shared native/source originals into
 // erased evidence, or remove the independently accountable sibling history.
 network.beforeModel=undefined;network.sourceText=null
 const evidence=await json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Independent grant scope',wording:'An independently reusable handoff observation.',observedAt:'2026-10-01T00:00:00Z'},f.cookie),201)
 const source=await json<{id:string}>(call(path+'/sources',{name:'Shared grant scope',provider:'orbit',resourceIds:['signals/grant-revoke'],useBasis:'Authorized independent comparison',allOperatorsAuthorized:true},f.cookie),201)
 const grant=async(sourceId?:string,nativeEvidenceIds:string[]=[])=>json<{id:string}>(call(path+'/investigations',{sourceId,nativeEvidenceIds,nativeRequestIds:[],purpose:'Independent grant purpose',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201)
 const a=await grant(source.id,[evidence.id]),b=await grant(undefined,[evidence.id]),c=await grant(source.id),detail=(id:string)=>json(call(path+`/investigations/${id}`,undefined,f.cookie))
 for(const i of [a,b,c]){
  const target=path+`/investigations/${i.id}`,run=await json<{artifactId:string}>(call(target+'/run',{},f.cookie))
  await json(call(target+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Retain independent commitment history',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201)
  await json(call(target+'/correct',{interpretationId:run.artifactId,correction:'Retain this independent correction history.'},f.cookie));await json(call(target+'/run',{},f.cookie))
 }
 const readSource=()=>env.DB.prepare('SELECT * FROM learning_sources WHERE id=?').bind(source.id).first(),readFences=async()=>(await env.DB.prepare('SELECT source_id,event_hash FROM learning_erased_events UNION ALL SELECT source_id,person_hash FROM learning_erased_people ORDER BY 1,2').all()).results
 const before={b:await detail(b.id),c:await detail(c.id),source:await readSource(),fences:await readFences()},old=await exportArchive(env.DB,env.FILES)
 network.sourceText=canonical({id:'grant-revoke',subject:'An in-flight revision must never publish after revocation.',occurred_at:'2026-10-04T00:00:00Z'})
 network.beforeModel=async()=>{await json(call(path+`/investigations/${a.id}/control`,{action:'revoke'},f.cookie))}
 const inFlight=await call(path+`/investigations/${a.id}/run`,{},f.cookie);network.beforeModel=undefined
 const revoked=await detail(a.id),preserved={b:await detail(b.id),c:await detail(c.id),source:await readSource(),fences:await readFences()}
 const fresh=await grant(undefined,[evidence.id]),reuse=await call(path+`/investigations/${fresh.id}/run`,{},f.cookie),pauseRevoked=await call(path+`/investigations/${a.id}/control`,{action:'pause'},f.cookie)
 expect({preserved,revokedState:(revoked.investigation as {state:string}).state,retained:['observations','artifacts','runs','commitments','corrections'].map(key=>(revoked[key] as unknown[]).length),inFlightPublished:inFlight.ok,nativeReusable:reuse.ok,pauseReopensGrant:pauseRevoked.ok}).toEqual({preserved:before,revokedState:'revoked',retained:[0,0,0,0,0],inFlightPublished:false,nativeReusable:true,pauseReopensGrant:false})
 await json(call(path+`/investigations/${b.id}/run`,{},f.cookie));await json(call(path+`/investigations/${c.id}/run`,{},f.cookie))
 const latest=await exportArchive(env.DB,env.FILES),{reset,applyD1Migrations}=await import('cloudflare:test'),{inject}=await import('vitest'),{restoreArchive}=await import('@/core/features/data/operations')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));await expect(restoreArchive(env.DB,env.FILES,old.archive,latest.journal)).rejects.toMatchObject({code:'stale_archive'})
 expect((await restoreArchive(env.DB,env.FILES,latest.archive,latest.journal)).status).toBe('complete')
 expect(await env.DB.prepare('SELECT state FROM learning_investigations WHERE id=?').bind(a.id).first('state')).toBe('revoked')
 expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
},120000)
it('[LEARN-004] contribution erasure removes every dependent version/snapshot, preserves unrelated native records and refuses replay and active restored grants',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}`
 const privatePurpose='Customer cancelled after the report handoff failed.'
 const pending=await json<{id:string}>(call(path+'/investigations',{question:privatePurpose,nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:privatePurpose,expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201)
 const run=await json<{artifactId:string}>(call(url+'/run',{},f.cookie));await json(call(url+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Run the smaller test',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201)
 const before=await exportArchive(env.DB,env.FILES);expect(before.archive.tables.learning_investigations[0].state).toBe('held');expect(before.archive.tables.learning_sources[0].state).toBe('held')
 const plan=await planErasure(env.DB,'evidence_items',f.evidence.id);expect(plan.blockedCopies).toEqual([]);expect(plan.counts.learning_artifacts).toBe(1);expect(plan.counts.learning_commitments).toBe(1)
 const erased=await eraseEntity(env.DB,env.FILES,'evidence_items',f.evidence.id,plan.planHash);expect(erased.status).toBe('complete')
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_commitments').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(1)
 expect((await call(url+'/run',{},f.cookie)).status).toBe(409);expect(normalize('learning_sources',{state:'active',version:1}).state).toBe('held')
 expect(JSON.stringify(await json(call(path+`/investigations/${pending.id}`,undefined,f.cookie)))).not.toContain(privatePurpose)
 const after=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(after.archive)).not.toContain('Customer cancelled after the report handoff failed.');expect(after.journal.epoch).toBeGreaterThan(before.journal.epoch)

 // Native requester identity is verified through the public email flow; the
 // source-person endpoint must not report success for this different identity.
 const email='native-contributor@example.test';let requesterToken='';mockMail()
 try{
  await json(call('/api/public/identity/email',{email,displayName:'Native contributor'}),202)
  const link=messages.find(message=>message.to===email)!
  requesterToken=(await json<{token:string}>(call('/api/public/identity/email/verify',{token:new URLSearchParams(new URL(link.url).hash.slice(1)).get('token')}))).token
 }finally{vi.restoreAllMocks()}
 const requesterId=(await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=? AND verified_at IS NOT NULL').bind(email).first<string>('requester_id'))!
 expect(requesterId).toBeTruthy()
 await json(call('/api/operator/boards',{name:'Native feedback',slug:'native-feedback',visibility:'public'},f.cookie),201)
 await explicitConsentBoard('native-feedback',(path,method,body)=>publicCall(path,body,{Cookie:f.cookie},method))
 const nativeRequest=await json<{slug:string}>(publicCall('/api/public/requests',{title:'Clearer handoff',description:'A verified native contributor needs a clearer handoff.',boardSlug:'native-feedback',idempotencyKey:crypto.randomUUID()},{Authorization:`Bearer ${requesterToken}`}),201)
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(nativeRequest.slug).first<string>('id'))!
 const createNative=async(nativeEvidenceIds:string[],nativeRequestIds:string[]=[])=>json<{id:string}>(call(path+'/investigations',{question:'What would improve this handoff?',nativeEvidenceIds,nativeRequestIds,purpose:'Review native feedback',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201)
 const native=await createNative([],[requestId]),nativeUrl=path+`/investigations/${native.id}`
 await json(call(nativeUrl+'/run',{},f.cookie))
 const nativeDetail=await json<{investigation:{sourceId:string};observations:{id:string}[]}>(call(nativeUrl,undefined,f.cookie)),nativeSource=nativeDetail.investigation.sourceId
 expect(nativeDetail.observations).toHaveLength(1)
 expect(await env.DB.prepare('SELECT requester_id,source_person_id FROM learning_observations WHERE investigation_id=?').bind(native.id).first()).toEqual({requester_id:requesterId,source_person_id:null})
 const homeBefore=await json(call(path,undefined,f.cookie)),journalBefore=await json(call('/api/operator/data/journal',undefined,f.cookie)),peopleBefore=await env.DB.prepare('SELECT count(*) n FROM learning_erased_people').first('n'),callsBefore=sent.length
 const refusal=await call(path+`/sources/${nativeSource}/erase-person`,{sourcePersonId:requesterId},f.cookie)
 const retained=await env.DB.prepare('SELECT count(*) n FROM learning_observations WHERE requester_id=?').bind(requesterId).first('n')
 expect(refusal.status,JSON.stringify({body:await refusal.clone().json(),retainedNativeObservations:retained})).toBe(409)
 expect(await refusal.json()).toEqual({error:'learning_native_person_erasure_requires_data_flow'})
 expect(retained).toBe(1);expect(sent).toHaveLength(callsBefore)
 expect(await json(call(nativeUrl,undefined,f.cookie))).toEqual(nativeDetail)
 expect(await json(call(path,undefined,f.cookie))).toEqual(homeBefore)
 expect(await json(call('/api/operator/data/journal',undefined,f.cookie))).toEqual(journalBefore)
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_erased_people').first('n')).toBe(peopleBefore)
 const target={table:'requesters',id:requesterId},nativePlan=await json<{planHash:string;counts:Record<string,number>;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',target,f.cookie))
 expect(nativePlan.blockedCopies).toEqual([]);expect(nativePlan.counts.learning_observations).toBe(1)
 expect((await json<{status:string}>(call('/api/operator/data/erasure',{...target,planHash:nativePlan.planHash},f.cookie))).status).toBe('complete')
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(requesterId).first()).toBeNull()
 // The request stays for everyone else, without its author or their words.
 expect(await env.DB.prepare('SELECT author_requester_id,title FROM requests WHERE id=?').bind(requestId).first()).toEqual({author_requester_id:null,title:'Request from an erased person'})
 expect(await env.DB.prepare('SELECT id FROM learning_observations WHERE requester_id=?').bind(requesterId).first()).toBeNull()
 expect((await call(nativeUrl+'/run',{},f.cookie)).status).toBe(409)
 const original=await json<{id:string}>(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Independent note',wording:'Independent native original retained after disconnect.',observedAt:'2026-10-01T00:00:00Z'},f.cookie),201),disconnect=await createNative([original.id])
 await json(call(path+`/investigations/${disconnect.id}/run`,{},f.cookie))
 const disconnectDetail=await json<{investigation:{sourceId:string}}>(call(path+`/investigations/${disconnect.id}`,undefined,f.cookie))
 await json(call(path+`/sources/${disconnectDetail.investigation.sourceId}/disconnect`,{},f.cookie))
 expect(await env.DB.prepare('SELECT id FROM evidence_items WHERE id=?').bind(original.id).first()).toEqual({id:original.id})
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations WHERE investigation_id=?').bind(disconnect.id).first('n')).toBe(0)
 expect((await call(path+`/investigations/${disconnect.id}/run`,{},f.cookie)).status).toBe(409)
})
it('[LEARN-005] source person erasure covers duplicate connections and fresh-grant replay; actual restore holds all source authority',async()=>{
 const f=await fixture();await json(call('/api/operator/settings/redaction',{enabled:true,kinds:['email'],patterns:[]},f.cookie,undefined,'PUT'));network.sourceText=canonical({id:'person-1',name:'Private source contributor',email:'private-contributor@example.com',updated_at:'2026-10-01T00:00:00Z'})
 const create=async()=>{const source=await json<{id:string}>(call(path+'/sources',{name:'Private source contributor contacts',provider:'orbit',resourceIds:['contacts/person-1'],useBasis:'Private source contributor permitted this context',allOperatorsAuthorized:true},f.cookie),201);const investigation=await json<{id:string}>(call(path+'/investigations',{sourceId:source.id,question:'Why did Private source contributor cancel?',nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:'Investigate Private source contributor cancellation',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201);return {source,investigation}}
 const a=await create(),b=await create(),pending=await create();for(const item of [a,b]){const run=await json<{artifactId:string}>(call(path+`/investigations/${item.investigation.id}/run`,{},f.cookie));if(item===a){const url=path+`/investigations/${a.investigation.id}`;await json(call(url+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Private source contributor review',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201);await json(call(url+'/correct',{interpretationId:run.artifactId,correction:'Private source contributor clarification'},f.cookie))}}
 const old=await exportArchive(env.DB,env.FILES)
 expect(JSON.stringify(old.archive)).toContain('[REDACTED:email]');expect(JSON.stringify(old.archive)).not.toContain('private-contributor@example.com')
 await json(call(path+`/sources/${a.source.id}/erase-person`,{sourcePersonId:'person-1'},f.cookie));expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(2);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 const modelCalls=sent.filter(s=>s.startsWith('POST')).length;expect((await call(path+'/sources',{name:'Recreated contact',provider:'orbit',resourceIds:['contacts/person-1'],useBasis:'New grant',allOperatorsAuthorized:true},f.cookie)).status).toBe(409);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(modelCalls)
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_commitments').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_corrections').first('n')).toBe(0)
 for(const item of [a,b,pending]){const detail=await json(call(path+`/investigations/${item.investigation.id}`,undefined,f.cookie));expect(JSON.stringify(detail)).not.toContain('Private source contributor');expect(JSON.stringify(detail)).not.toContain('contacts/person-1')}
 expect(JSON.stringify(await json(call(path,undefined,f.cookie)))).not.toContain('person-1')
 const exported=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(exported.archive)).not.toContain('private-contributor@example.com');expect(JSON.stringify(exported.archive)).not.toContain('Private source contributor');expect(JSON.stringify(exported.archive)).not.toContain('person-1')
 const {reset,applyD1Migrations}=await import('cloudflare:test'),{inject}=await import('vitest'),{restoreArchive}=await import('@/core/features/data/operations')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));await expect(restoreArchive(env.DB,env.FILES,old.archive,exported.journal)).rejects.toMatchObject({code:'stale_archive'});expect((await restoreArchive(env.DB,env.FILES,exported.archive,exported.journal)).status).toBe('complete');expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
 const {runInvestigation}=await import('@/core/features/learning/run');await expect(runInvestigation(createPennyRuntime(bindings()),a.investigation.id,'restored',{db:env.DB,actor:{system:'learning.scheduler'}})).rejects.toMatchObject({code:'learning_scope_changed'})
})

it('[LEARN-005] observed provider credential revocation purges all matching source installations; outage preserves evidence',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}/run`;await json(call(url,{},f.cookie))
 network.sourceStatus=503;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(1)
 network.sourceStatus=401;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT state FROM learning_sources WHERE id=?').bind(f.source.id).first('state')).toBe('disconnected')
})

it('[LEARN-003] learning actions retain the acting peer and roll back with their audit',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}`,email='learning-peer@example.test';let peer=''
 mockMail()
 try{await json(call('/api/operator/settings/operators',{email},f.cookie),202);const confirmed=await call('/auth/confirm',{token:new URL(messages.findLast(message=>message.to===email)!.url).searchParams.get('token')});expect(confirmed.status).toBe(303);peer=confirmed.headers.get('set-cookie')!.split(';')[0]}finally{vi.restoreAllMocks()}
 await json(call(path,undefined,peer))
 const peerId=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(email).first('id'),creatorId=await env.DB.prepare("SELECT actor_id FROM learning_investigations WHERE id=?").bind(f.investigation.id).first('actor_id')
 const audits=async()=>(await env.DB.prepare("SELECT * FROM audit_entries WHERE entity_type IN('learning_investigation','learning_source') ORDER BY id").all<Record<string,unknown>>()).results
 const beforeRollback={detail:await json(call(url,undefined,peer)),audits:await audits()}
 await env.DB.prepare("CREATE TRIGGER reject_learning_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type IN('learning_investigation','learning_source') BEGIN SELECT RAISE(ABORT,'isolated audit insertion failure'); END").run()
 let failed:Response
 try{failed=await call(url+'/control',{action:'pause'},peer)}finally{await env.DB.prepare('DROP TRIGGER reject_learning_audit').run()}
 const afterRollback={detail:await json(call(url,undefined,peer)),audits:await audits()},checks:{action:string;attributed:boolean;entity:boolean}[]=[],retained:string[]=[]
 async function act(target:string,body:unknown,expected:string[],entity='learning_investigation',status=200){const previous=new Set((await audits()).map(row=>row.id)),result=await json<Record<string,any>>(call(target,body,peer),status),rows=(await audits()).filter(row=>!previous.has(row.id));for(const action of expected){const matching=rows.filter(row=>row.action===action);checks.push({action,attributed:matching.length===1&&matching[0].actor_id===peerId&&matching[0].actor_type==='operator',entity:matching.length===1&&matching[0].entity_type===entity})}retained.push(...rows.map(row=>String(row.id)));return result}
 const expected=['learning.paused','learning.resumed','learning.paused_all','learning.resumed','learning.grant_created','learning.source_attached','learning.run_requested','learning.run_completed','learning.committed','learning.corrected','learning.run_requested','learning.run_completed','learning.deferred','learning.grant_revoked','learning.source_created','learning.source_disconnected','learning.person_erased']
 network.sourceText=canonical({id:'cancellation',subject:'Private audit evidence wording',contact_id:'audit-source-person',occurred_at:'2026-10-01T00:00:00Z'})
 await drainLearning(createPennyRuntime(bindings()),Date.now()+1000)
 await act(url+'/control',{action:'pause'},['learning.paused']);await act(url+'/control',{action:'resume'},['learning.resumed']);await act(path+'/control',{action:'pause'},['learning.paused_all']);await act(url+'/control',{action:'resume'},['learning.resumed'])
 const b=await act(path+'/investigations',{nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:'Private grant purpose',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},['learning.grant_created'],'learning_investigation',201)
 await act(path+`/investigations/${b.id}/source`,{sourceId:f.source.id},['learning.source_attached'])
 const first=await act(url+'/run',{},['learning.run_requested','learning.run_completed'])
 await act(url+'/commit',{interpretationId:first.artifactId,optionId:'assist',rationale:'Private commitment rationale',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},['learning.committed'],'learning_investigation',201)
 await act(url+'/correct',{interpretationId:first.artifactId,correction:'Private audit correction wording'},['learning.corrected'])
 const current=await act(url+'/run',{},['learning.run_requested','learning.run_completed']);await act(path+`/artifacts/${current.artifactId}/defer`,{},['learning.deferred'])
 await act(path+`/investigations/${b.id}/control`,{action:'revoke'},['learning.grant_revoked'])
 const source=await act(path+'/sources',{name:'Private additional source',provider:'orbit',resourceIds:['signals/audit-disconnect'],useBasis:'Private source use',allOperatorsAuthorized:true},['learning.source_created'],'learning_source',201)
 await act(path+`/sources/${source.id}/disconnect`,{},['learning.source_disconnected'],'learning_source')
 const beforeRefusal=await audits(),stale=await call(url+'/correct',{interpretationId:first.artifactId,correction:'Stale private correction'},peer),unauthorized=await call(url+'/control',{action:'pause'}),refusalsUnchanged=canonical(await audits())===canonical(beforeRefusal)
 await act(path+`/sources/${f.source.id}/erase-person`,{sourcePersonId:'audit-source-person'},['learning.person_erased'],'learning_source')
 const rows=await audits(),ids=new Set(rows.map(row=>row.id))
 expect({checks,differentActors:peerId!==creatorId,rollbackFailed:!failed!.ok,rollback:afterRollback,historyRetained:retained.every(id=>ids.has(id)),safe:!/(Private audit|Private grant|Private commitment|Private additional|Private source|audit-source-person|network-edge)/.test(JSON.stringify(rows)),refusals:!stale.ok&&!unauthorized.ok&&refusalsUnchanged,scheduled:rows.some(row=>row.actor_type==='system'&&row.actor_id==='learning.scheduler'&&row.action==='learning.run_completed')}).toEqual({checks:expected.map(action=>({action,attributed:true,entity:true})),differentActors:true,rollbackFailed:true,rollback:beforeRollback,historyRetained:true,safe:true,refusals:true,scheduled:true})
})
