import {applyD1Migrations,reset} from 'cloudflare:test'
import {env} from 'cloudflare:workers'
import {expect,inject} from 'vitest'
import type {exportArchive} from '@/core/features/data/archive'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import {bindings,call,config,fixture,json,network,path,resetLearning,sent} from './learning-test-runtime'

type Run = {
 id:string;event_key:string;claim:string;state:string;reason:string|null;
 cursor_json:string;reserved_micros:number;actual_micros:number|null
}
type Detail = {
 investigation:{id:string;sourceId:string;state:string;version:number;spentMicros:number;lastReason:string|null};
 runs:Run[];artifacts:unknown[];observations:{id:string;eventKey:string;contentHash:string}[]
}

export async function proveRunningRestore(){
 await resetLearning()
 const source=await fixture(),url=path+`/investigations/${source.investigation.id}`
 const sourceOwner=await env.DB.prepare('SELECT id FROM oa_operators').first('id')

 // Interrupt settlement after the real run reaches the model HTTP edge. The
 // bounded storage fault also prevents the failure handler settling the claim.
 network.beforeModel=async()=>{
  await env.DB.prepare("CREATE TRIGGER synthetic_learning_restore_interruption BEFORE UPDATE ON penny_ai_runs BEGIN SELECT RAISE(ABORT,'synthetic-penny-1'); END").run()
 }
 try{expect((await call(url+'/run',{},source.cookie)).ok).toBe(false)}finally{
  network.beforeModel=undefined
  await env.DB.prepare('DROP TRIGGER synthetic_learning_restore_interruption').run()
 }
 expect(sent.map(request=>request.split(' ')[0])).toEqual(['GET','POST'])
 const running=await json<Detail>(call(url,undefined,source.cookie))
 expect(running.runs).toHaveLength(1)
 const claim=running.runs[0]
 expect(claim).toMatchObject({state:'running',reason:null,reserved_micros:100000,actual_micros:null})
 expect(claim.id).toBeTruthy();expect(claim.claim).toBeTruthy();expect(claim.event_key).toMatch(/^manual:/)
 const cursor=JSON.parse(claim.cursor_json)
 expect(cursor).toHaveLength(2)
 expect(cursor).toEqual(expect.arrayContaining(running.observations.map(observation=>({eventKey:observation.eventKey,contentHash:observation.contentHash}))))
 expect(running.artifacts).toEqual([])
 expect(running.investigation).toMatchObject({state:'active',spentMicros:claim.reserved_micros})
 const reservation=await env.DB.prepare('SELECT * FROM penny_ai_runs').first()
 expect(reservation).toMatchObject({state:'reserved',reserved_micros:claim.reserved_micros,actual_micros:null})

 // Export before any scheduler recovery, through the same authenticated data
 // door an owner uses. Export normalizes the archive, never the live claim.
 expect((await call('/api/operator/data/export')).status).toBe(401)
 const bundle=await json<Awaited<ReturnType<typeof exportArchive>>>(call('/api/operator/data/export',undefined,source.cookie))
 const restoredClaim={...claim,state:'uncertain',reason:'restored_run_reconciliation_required'}
 expect(bundle.archive.tables.learning_runs).toEqual([restoredClaim])
 expect(bundle.archive.tables.penny_ai_runs).toEqual([{...reservation,state:'uncertain'}])
 expect(bundle.archive.tables.learning_sources).toEqual([expect.objectContaining({id:source.source.id,state:'held'})])
 expect(bundle.archive.tables.learning_investigations).toEqual([expect.objectContaining({id:source.investigation.id,state:'held',last_reason:'restored_grant_review_required'})])
 const wire=JSON.stringify(bundle)
 expect(wire).not.toContain(config.orbit.token)
 for(const provider of Object.values(JSON.parse(bindings().PENNY_AI!)) as {apiKey:string}[])expect(wire).not.toContain(provider.apiKey)
 expect((await json<Detail>(call(url,undefined,source.cookie))).runs).toEqual([claim])
 const transmitted=[...sent]

 // A new installation owns its own operator session; archived authority is
 // never used to read or resume the restored investigation.
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const boot=await call('/auth/bootstrap',{token:env.SETUP_TOKEN,displayName:'Destination owner'})
 expect(boot.status).toBe(303)
 const cookie=boot.headers.get('set-cookie')!.split(';')[0]
 expect(await env.DB.prepare('SELECT id FROM oa_operators').first('id')).not.toBe(sourceOwner)
 expect((await call('/api/operator/data/import',bundle,source.cookie)).status).toBe(401)
 expect((await json<{status:string}>(call('/api/operator/data/import',bundle,cookie))).status).toBe('complete')
 expect((await call(url,undefined,source.cookie)).status).toBe(401)
 const restored=await json<Detail>(call(url,undefined,cookie))
 expect(restored.runs).toEqual([restoredClaim])
 expect(restored.investigation).toEqual({...running.investigation,state:'held',version:running.investigation.version+1,lastReason:'restored_grant_review_required'})
 expect(restored.observations).toHaveLength(running.observations.length)
 expect(restored.observations).toEqual(expect.arrayContaining(running.observations))
 expect(restored.artifacts).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM penny_ai_runs').all()).results).toEqual([{...reservation,state:'uncertain'}])
 const home=await json<{sources:{id:string;state:string}[];investigations:{state:string;reservedCostMicros:number}[]}>(call(path,undefined,cookie))
 expect(home.sources).toEqual([expect.objectContaining({id:source.source.id,state:'held'})])
 expect(home.investigations).toEqual([expect.objectContaining({state:'held',reservedCostMicros:claim.reserved_micros})])
 const report=await json<{report:{meteredMicros:number;reservedMicros:number}}>(call('/api/operator/settings/ai',undefined,cookie))
 expect(report.report).toMatchObject({meteredMicros:0,reservedMicros:claim.reserved_micros})

 for(let tick=1;tick<=3;tick++){
  await runNotificationSchedule({scheduledTime:Date.now()+tick*3_600_000,cron:'* * * * *',noRetry(){}} as ScheduledController,bindings())
  expect(await json(call(url+'/run',{},cookie),409)).toEqual({error:'learning_scope_changed'})
  expect(await json(call(url+'/control',{action:'resume'},cookie),409)).toEqual({error:'learning_control_requires_new_grant'})
 }
 expect(sent).toEqual(transmitted)
 expect(await json(call(url,undefined,cookie))).toEqual(restored)
 expect(await json(call(path,undefined,cookie))).toEqual(home)
 expect(await json(call('/api/operator/settings/ai',undefined,cookie))).toEqual(report)
 expect((await env.DB.prepare('SELECT * FROM penny_ai_runs').all()).results).toEqual([{...reservation,state:'uncertain'}])
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM learning_commitments').first('n')).toBe(0)
}
