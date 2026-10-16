import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,expect,inject,it } from 'vitest'
import { call,env,owner,origin } from './support'
import { preview,complete,importPath } from './feedback-import-fixture'
import { pagedUservoiceFixture,uservoiceFixture } from './uservoice-fixture'
import { exportArchive } from '@/core/features/data/archive'
import { restoreArchive } from '@/core/features/data/operations'
import { importContext,requestPrincipal } from '@/core/features/imports/service'
import { runtime } from './notification-regression-fixture'
import { readSavedFeedback } from '@/core/features/imports/source'
import { feedbackMapping } from '@/core/features/imports/mapping'
import { planD1Import,createD1ImportJob,applyD1ImportBatches,resumeD1Import } from '../../base/modules/import-kit/src/d1/index'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
const requests=async()=>(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first<{n:number}>())!.n
const listed=async(operator:Record<string,string>)=>{
 const response=await call(importPath+'/jobs',undefined,operator)
 expect(response.status,await response.clone().text()).toBe(200)
 return (await response.json() as {id:string}[]).map(job=>job.id)
}
// Populate the former operator-bound plan through the real mapper and Base
// engine. Its immutable principal and fingerprint remain untouched thereafter.
async function legacyJob(namespace:string,operator:Record<string,string>,principal:string,partial=false){
 const input=uservoiceFixture(namespace),{context,actor}=await importContext(runtime(),await requestPrincipal(runtime(),new Request(origin+importPath+'/apply',{method:'POST',headers:{Origin:origin,...operator}})),namespace)
 context.authorization={...context.authorization,principalId:principal}
 const source=await readSavedFeedback(input),plan=await planD1Import(source,feedbackMapping(source,actor),context)
 context.reviewedFingerprint=plan.fingerprint
 const job=await createD1ImportJob(plan,context),started=await applyD1ImportBatches(job.id,context)
 return partial?started:complete(started,operator)
}

it('[IMP-003][OWN-001] export, reset, import, setup: current owner reads, undoes and resumes legacy history; demoted operators cannot',async()=>{
 const first=await owner(),creator=(await env.DB.prepare('SELECT id FROM oa_operators').first<{id:string}>())!.id
 const done=await legacyJob('restored-done',first,creator)
 const forward=await legacyJob('restored-forward',first,creator,true)
 expect(forward.state).not.toBe('completed')
 const reverse=await legacyJob('restored-reverse',first,creator)
 const reversal=await call(importPath+'/jobs/'+reverse.id+'/undo',{},first)
 expect(reversal.status,await reversal.clone().text()).toBe(200)
 expect((await reversal.json() as {state:string}).state).not.toBe('undone')
 const source=pagedUservoiceFixture('role-owned'),reviewed=await preview(source,first)
 const started=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},first)
 expect(started.status,await started.clone().text()).toBe(202)
 const fresh=await started.json() as typeof forward
 expect(fresh.state).not.toBe('completed')
 expect(await env.DB.prepare('SELECT COUNT(*) FROM ik_d1_stream_pages WHERE stream_id=?').bind(fresh.id).first('COUNT(*)')).toBeGreaterThan(1)
 const jobs=[done.id,forward.id,reverse.id,fresh.id]
 const custody=await env.DB.prepare('SELECT id,principal_id,fingerprint FROM ik_jobs ORDER BY id').all()
 const snapshot=await exportArchive(env.DB,env.FILES)
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 // Internal archive helper models the local CLI, which restores before setup;
 // the authenticated HTTP import endpoint necessarily needs an existing owner.
 await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM oa_operators').first('n')).toBe(0)
 const operator=await owner()
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM oa_operators WHERE id=?').bind(creator).first('n')).toBe(0)
 expect((await listed(operator)).sort()).toEqual([...jobs].sort())
 for(const id of [done.id,fresh.id])for(const suffix of ['', '/originals','/receipt']){
  const response=await call(importPath+'/jobs/'+id+suffix,undefined,operator)
  expect(response.status,await response.clone().text()).toBe(200)
 }
 const resumed=await call(importPath+'/jobs/'+forward.id+'/resume',{},operator)
 console.log('restore-forward-http',resumed.status)
 expect(resumed.status,await resumed.clone().text()).toBe(200)
 expect((await complete(await resumed.json() as typeof forward,operator)).state).toBe('completed')
 const streamResume=await call(importPath+'/jobs/'+fresh.id+'/resume',{},operator)
 expect(streamResume.status,await streamResume.clone().text()).toBe(200)
 expect((await complete(await streamResume.json() as typeof fresh,operator)).state).toBe('completed')
 // The historical native row can still exist after an owner handoff. Its
 // existence is attribution, never authority over the installation's archive.
 await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,'historical@example.test','Historical owner','member','active',1,0)").bind(creator).run()
 const handoff=await call(importPath+'/jobs/'+done.id,undefined,operator)
 console.log('owner-handoff-read-http',handoff.status)
 expect(handoff.status,await handoff.clone().text()).toBe(200)
 const before=await requests()
 const undo=await call(importPath+'/jobs/'+done.id+'/undo',{},operator)
 console.log('owner-handoff-undo-http',undo.status)
 expect(undo.status,await undo.clone().text()).toBe(200)
 expect((await complete(await undo.json() as typeof done,operator)).state).toBe('undone');expect(await requests()).toBeLessThan(before)
 const reverseResume=await call(importPath+'/jobs/'+reverse.id+'/resume',{},operator)
 console.log('restore-reversal-resume-http',reverseResume.status)
 expect(reverseResume.status,await reverseResume.clone().text()).toBe(200)
 expect((await complete(await reverseResume.json() as typeof reverse,operator)).state).toBe('undone')
 expect((await env.DB.prepare('SELECT id,principal_id,fingerprint FROM ik_jobs ORDER BY id').all()).results).toEqual(custody.results)
 // This owner also owns a legacy job personally; demotion cannot retain power
 // through that historical principal, even with a freshly current session.
 const current=(await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner'").first<{id:string}>())!.id
 const own=await legacyJob('own-before-demotion',operator,current,true)
 const admitted=await importContext(runtime(),await requestPrincipal(runtime(),new Request(origin+importPath+'/jobs/'+own.id+'/resume',{method:'POST',headers:{Origin:origin,...operator}})),'own-before-demotion',false,current)
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(creator).run()
 await env.DB.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(current).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 const list=await call(importPath+'/jobs',undefined,operator)
 expect(list.status).toBe(403)
 const remaining=await requests()
 const checkpoint=await env.DB.prepare('SELECT checkpoint FROM ik_jobs WHERE id=?').bind(own.id).first('checkpoint')
 await expect(resumeD1Import(own.id,admitted.context)).rejects.toThrow(/IMPORT_ATOMIC_GUARD/)
 expect(await env.DB.prepare('SELECT checkpoint FROM ik_jobs WHERE id=?').bind(own.id).first('checkpoint')).toBe(checkpoint)
 const deniedSource=uservoiceFixture('denied');expect((await call(importPath+'/preview',deniedSource,operator)).status).toBe(403)
 expect((await call(importPath+'/apply',{source:deniedSource,fingerprint:'0'.repeat(64)},operator)).status).toBe(403)
 for(const id of [forward.id,own.id,fresh.id])for(const [path,body] of [['/originals',undefined],['',undefined],['/receipt',undefined],['/undo',{}],['/rollback',{}],['/resume',{}]] as const){
  const response=await call(importPath+'/jobs/'+id+path,body,operator)
  expect(response.status,id+path).toBe(403)
 }
 expect(await requests()).toBe(remaining)
 // Re-admit an owner, then revoke after context creation. Base's next batch
 // must reject the stale admission without progressing the persisted job.
 await env.DB.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(current).run()
 await env.DB.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=operator_id)').run()
 const revoked=await importContext(runtime(),await requestPrincipal(runtime(),new Request(origin+importPath+'/jobs/'+own.id+'/resume',{method:'POST',headers:{Origin:origin,...operator}})),'own-before-demotion',false,current)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1 WHERE operator_id=?').bind(current).run()
 await expect(resumeD1Import(own.id,revoked.context)).rejects.toThrow(/IMPORT_ATOMIC_GUARD/)
 expect((await call(importPath+'/jobs/'+own.id+'/resume',{},operator)).status).toBe(401)
 expect(await env.DB.prepare('SELECT checkpoint FROM ik_jobs WHERE id=?').bind(own.id).first('checkpoint')).toBe(checkpoint)
 expect(await requests()).toBe(remaining)
})
