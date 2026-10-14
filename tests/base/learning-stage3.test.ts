import {expect,it} from 'vitest'
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
 const makeDue=()=>env.DB.prepare("UPDATE learning_investigations SET next_run_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(f.investigation.id).run()
 await makeDue();await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(1);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
 await json(call(url+'/control',{action:'pause'},f.cookie));await makeDue();const count=sent.length;await drainLearning(runtime,Date.now()+1000);expect(sent).toHaveLength(count)
 await json(call(url+'/control',{action:'resume'},f.cookie));network.sourceText=canonical({id:'cancellation',subject:'The assisted handoff worked; the export still lacks a date filter.',occurred_at:'2026-10-02T00:00:00Z',confidence:'observed'})
 await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(2)
 const latest=await env.DB.prepare("SELECT id FROM learning_artifacts WHERE state='current'").first<string>('id')
 network.beforeModel=async()=>{await json(call(url+'/correct',{interpretationId:latest,correction:'The workaround failed for the larger account.'},f.cookie))}
 network.sourceText=canonical({id:'cancellation',subject:'Another supplied revision',occurred_at:'2026-10-03T00:00:00Z'})
 await makeDue();await drainLearning(runtime,Date.now()+1000);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(0)
 await json(call(path+'/control',{action:'pause'},f.cookie));expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
 await json(call(path+`/sources/${f.source.id}/disconnect`,{},f.cookie));expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 const bundle=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(bundle.archive)).not.toContain('Another supplied revision');expect(bundle.journal.epoch).toBeGreaterThan(0)
})
it('[LEARN-004] contribution erasure removes every dependent version/snapshot, preserves unrelated native records and refuses replay and active restored grants',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}`
 const run=await json<{artifactId:string}>(call(url+'/run',{},f.cookie));await json(call(url+'/commit',{interpretationId:run.artifactId,optionId:'assist',rationale:'Run the smaller test',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie),201)
 const before=await exportArchive(env.DB,env.FILES);expect(before.archive.tables.learning_investigations[0].state).toBe('held');expect(before.archive.tables.learning_sources[0].state).toBe('held')
 const plan=await planErasure(env.DB,'evidence_items',f.evidence.id);expect(plan.blockedCopies).toEqual([]);expect(plan.counts.learning_artifacts).toBe(1);expect(plan.counts.learning_commitments).toBe(1)
 const erased=await eraseEntity(env.DB,env.FILES,'evidence_items',f.evidence.id,plan.planHash);expect(erased.status).toBe('complete')
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_commitments').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(1)
 expect((await call(url+'/run',{},f.cookie)).status).toBe(409);expect(normalize('learning_sources',{state:'active',version:1}).state).toBe('held')
 const after=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(after.archive)).not.toContain('Customer cancelled after the report handoff failed.');expect(after.journal.epoch).toBeGreaterThan(before.journal.epoch)
})
it('[LEARN-005] source person erasure covers duplicate connections and fresh-grant replay; actual restore holds all source authority',async()=>{
 const f=await fixture();network.sourceText=canonical({id:'person-1',name:'Private source contributor',email:'private-contributor@example.com',updated_at:'2026-10-01T00:00:00Z'})
 const create=async()=>{const source=await json<{id:string}>(call(path+'/sources',{name:'Selected contacts',provider:'orbit',resourceIds:['contacts/person-1'],useBasis:'Authorized exact-record cancellation context',allOperatorsAuthorized:true},f.cookie),201);const investigation=await json<{id:string}>(call(path+'/investigations',{sourceId:source.id,question:'What would make the handoff useful?',nativeEvidenceIds:[],nativeRequestIds:[],purpose:'Investigate the supplied contact context',expiresAt:'2099-01-01T00:00:00Z',budgetMicros:1000000,maxRunCostMicros:100000,intervalMinutes:60},f.cookie),201);return {source,investigation}}
 const a=await create(),b=await create();for(const item of [a,b])await json(call(path+`/investigations/${item.investigation.id}/run`,{},f.cookie))
 await json(call(path+`/sources/${a.source.id}/erase-person`,{sourcePersonId:'person-1'},f.cookie));expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 const c=await create(),modelCalls=sent.filter(s=>s.startsWith('POST')).length;expect((await call(path+`/investigations/${c.investigation.id}/run`,{},f.cookie)).status).toBe(409);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(modelCalls)
 const exported=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(exported.archive)).not.toContain('private-contributor@example.com')
 const {reset,applyD1Migrations}=await import('cloudflare:test'),{inject}=await import('vitest'),{restoreArchive}=await import('@/core/features/data/archive')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));expect((await restoreArchive(env.DB,env.FILES,exported.archive,exported.journal)).status).toBe('complete');expect(await env.DB.prepare("SELECT count(*) n FROM learning_investigations WHERE state='active'").first('n')).toBe(0)
 const {runInvestigation}=await import('@/core/features/learning/run');await expect(runInvestigation(createPennyRuntime(bindings()),c.investigation.id,'restored')).rejects.toMatchObject({code:'learning_scope_changed'})
})

it('[LEARN-005] observed provider credential revocation purges all matching source installations; outage preserves evidence',async()=>{
 const f=await fixture(),url=path+`/investigations/${f.investigation.id}/run`;await json(call(url,{},f.cookie))
 network.sourceStatus=503;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare("SELECT count(*) n FROM learning_artifacts WHERE state='current'").first('n')).toBe(1)
 network.sourceStatus=401;expect((await call(url,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0);expect(await env.DB.prepare('SELECT count(*) n FROM learning_observations').first('n')).toBe(0);expect(await env.DB.prepare('SELECT state FROM learning_sources WHERE id=?').bind(f.source.id).first('state')).toBe('disconnected')
})
