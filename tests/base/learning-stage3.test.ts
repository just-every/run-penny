import {expect,it,vi} from 'vitest'
import {mockMail,messages,call as publicCall} from './support'
import {env} from 'cloudflare:workers'
import {createPennyRuntime} from '@/core/app/runtime'
import {drainLearning} from '@/core/features/learning/scheduled'
import {exportArchive,planErasure,eraseEntity,normalize} from '@/core/features/data/archive'
import {canonical} from '@/core/features/data/archive'
import {call,json,fixture,path,bindings,sent,network} from './learning-test-runtime'
it('[LEARN-003] scheduled refresh obtains new evidence, deduplicates unchanged work and supports pause, correction, resume and revoke',async()=>{
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
})
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
 expect(await env.DB.prepare('SELECT id FROM requests WHERE id=?').bind(requestId).first()).toBeNull()
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
 const f=await fixture();network.sourceText=canonical({id:'person-1',name:'Private source contributor',email:'private-contributor@example.com',updated_at:'2026-10-01T00:00:00Z'})
 const create=async()=>{const source=await json<{id:string}>(call(path+'/sources',{name:'Private source contributor contacts',provider:'orbit',resourceIds:['contacts/person-1'],useBasis:'Private source contributor permitted this context',allOperatorsAuthorized:true},f.cookie),201);const investigation=await json<{id:string}>(call(path+'/investigations',{sourceId:source.id,question:'Why did Private source contributor cancel?',nativeEvidenceIds:[f.evidence.id],nativeRequestIds:[],purpose:'Investigate Private source contributor cancellation',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201);return {source,investigation}}
 const a=await create(),b=await create(),pending=await create();for(const item of [a,b]){const run=await json<{artifactId:string}>(call(path+`/investigations/${item.investigation.id}/run`,{},f.cookie));if(item===a){const url=path+`/investigations/${a.investigation.id}`;await json(call(url+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Private source contributor review',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201);await json(call(url+'/correct',{interpretationId:run.artifactId,correction:'Private source contributor clarification'},f.cookie))}}
 const old=await exportArchive(env.DB,env.FILES)
 await json(call(path+`/sources/${a.source.id}/erase-person`,{sourcePersonId:'person-1'},f.cookie));expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(2);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 const modelCalls=sent.filter(s=>s.startsWith('POST')).length;expect((await call(path+'/sources',{name:'Recreated contact',provider:'orbit',resourceIds:['contacts/person-1'],useBasis:'New grant',allOperatorsAuthorized:true},f.cookie)).status).toBe(409);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(modelCalls)
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_commitments').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_corrections').first('n')).toBe(0)
 for(const item of [a,b,pending]){const detail=await json(call(path+`/investigations/${item.investigation.id}`,undefined,f.cookie));expect(JSON.stringify(detail)).not.toContain('Private source contributor');expect(JSON.stringify(detail)).not.toContain('contacts/person-1')}
 expect(JSON.stringify(await json(call(path,undefined,f.cookie)))).not.toContain('person-1')
 const exported=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(exported.archive)).not.toContain('private-contributor@example.com');expect(JSON.stringify(exported.archive)).not.toContain('Private source contributor');expect(JSON.stringify(exported.archive)).not.toContain('person-1')
 const {reset,applyD1Migrations}=await import('cloudflare:test'),{inject}=await import('vitest'),{restoreArchive}=await import('@/core/features/data/archive')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));await expect(restoreArchive(env.DB,env.FILES,old.archive,exported.journal)).rejects.toMatchObject({code:'stale_archive'});expect((await restoreArchive(env.DB,env.FILES,exported.archive,exported.journal)).status).toBe('complete');expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
 const {runInvestigation}=await import('@/core/features/learning/run');await expect(runInvestigation(createPennyRuntime(bindings()),a.investigation.id,'restored')).rejects.toMatchObject({code:'learning_scope_changed'})
})

it('[LEARN-005] observed provider credential revocation purges all matching source installations; outage preserves evidence',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}/run`;await json(call(url,{},f.cookie))
 network.sourceStatus=503;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(1)
 network.sourceStatus=401;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT state FROM learning_sources WHERE id=?').bind(f.source.id).first('state')).toBe('disconnected')
})
