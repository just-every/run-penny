import {expect,it} from 'vitest'
import {env} from 'cloudflare:workers'
import {call,json,fixture,path,bindings,sent,network} from './learning-test-runtime'
import {learningOutput} from './learning-fixture'
it('[LEARN-001] captures native and real-protocol Orbit facts, validates exact spans, compares no-build and commits an immutable accountable protocol',async()=>{
 const f=await fixture();const run=await json<{artifactId:string}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie))
 const detail=await json<{observations:Record<string,unknown>[];artifacts:{body:ReturnType<typeof learningOutput>;id:string}[]}>(call(path+`/investigations/${f.investigation.id}`,undefined,f.cookie));expect(detail.observations).toHaveLength(2);expect(detail.observations.every(o=>o.requester_id===null&&o.account_id===null)).toBe(true)
 const body=detail.artifacts[0].body;expect(body.clarification?.distinguishes).toHaveLength(2);expect(body.options.some(o=>o.kind==='no-build')).toBe(true)
 expect((await call(path+`/investigations/${f.investigation.id}/commit`,{interpretationId:run.artifactId,optionId:'assist',rationale:'Test the support explanation first',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie)).status).toBe(201)
 const snapshot=await env.DB.prepare('SELECT snapshot_json FROM learning_commitments').first<string>('snapshot_json');expect(JSON.parse(snapshot!).selectedOption.supportingEvidenceCount).toBe(2);expect(JSON.parse(snapshot!).ownerOperatorId).toBeTruthy();expect(JSON.parse(snapshot!).protocol.denominator).toBe(10)
 await expect(env.DB.prepare("UPDATE learning_commitments SET snapshot_json='{}'").run()).rejects.toThrow('learning_snapshot_immutable')
 expect((await call(path)).status).toBe(401);expect((await call('/api/public/learning')).status).toBe(404)
 const unchanged=await json<{unchanged:boolean}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie));expect(unchanged.unchanged).toBe(true);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
})
it('[LEARN-002] refuses forged citations, absent model configuration and an in-flight authority revocation without a derived result',async()=>{
 const f=await fixture();network.badCitation=true;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
 network.badCitation=false;const noConfig=bindings();delete noConfig.PENNY_LEARNING;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie,noConfig)).status).toBe(503)
 network.beforeModel=async()=>{await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run()};expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(401);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
})
