import {expect,inject,it,vi} from 'vitest'
import {env} from 'cloudflare:workers'
import {applyD1Migrations,reset} from 'cloudflare:test'
import {call,json,fixture,path,bindings,sent,network} from './learning-test-runtime'
import {learningOutput} from './learning-fixture'
import {digest} from '@/core/features/auth/native-tokens'
import {canonical,hash,type exportArchive} from '@/core/features/data/archive'
it('[LEARN-001] captures native and real-protocol Orbit facts, validates exact spans, compares no-build and commits an immutable accountable protocol',async()=>{
 const f=await fixture();network.sourceText=canonical({id:'cancellation',subject:'I cancelled because I could not hand off the report.',occurred_at:'2026-10-01T00:00:00.000Z',confidence:'observed'})
 const run=await json<{artifactId:string}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie))
 const detail=await json<{observations:Record<string,unknown>[];artifacts:{body:ReturnType<typeof learningOutput>;id:string}[]}>(call(path+`/investigations/${f.investigation.id}`,undefined,f.cookie));expect(detail.observations).toHaveLength(2);expect(detail.observations.every(o=>o.requester_id===null&&o.account_id===null)).toBe(true)
 const orbit=detail.observations.find(o=>String(o.eventKey).startsWith('orbit:'))!,original=orbit.original as {envelope:{text:string;revision:string;canonicalUrl:string}},raw=JSON.parse(original.envelope.text),citation=detail.artifacts[0].body.citations.find(c=>c.observationId===orbit.id)!
 expect({human:orbit.wording,rawPreserved:await digest(original.envelope.text)===original.envelope.revision,exactQuote:String(orbit.wording).slice(citation.start,citation.end),quote: citation.quote,provenance:orbit.presentation}).toMatchObject({human:`Signal subject: ${raw.subject}`,rawPreserved:true,exactQuote:raw.subject,quote:raw.subject,provenance:{sourceLabel:raw.subject,observedAt:raw.occurred_at,href:original.envelope.canonicalUrl,excerpts:[{quote:raw.subject}]}})
 const body=detail.artifacts[0].body;expect(body.clarification?.distinguishes).toHaveLength(2);expect(body.options.some(o=>o.kind==='no-build')).toBe(true)
 expect((await call(path+`/investigations/${f.investigation.id}/commit`,{interpretationId:run.artifactId,optionId:'assist',rationale:'Test the support explanation first',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie)).status).toBe(201)
 const snapshot=await env.DB.prepare('SELECT snapshot_json FROM learning_commitments').first<string>('snapshot_json');expect(JSON.parse(snapshot!).selectedOption.supportingEvidenceCount).toBe(2);expect(JSON.parse(snapshot!).ownerOperatorId).toBeTruthy();expect(JSON.parse(snapshot!).protocol.denominator).toBe(10)
 await expect(env.DB.prepare("UPDATE learning_commitments SET snapshot_json='{}'").run()).rejects.toThrow('learning_snapshot_immutable')
 expect((await call(path)).status).toBe(401);expect((await call('/api/public/learning')).status).toBe(404)
 const unchanged=await json<{unchanged:boolean}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie));expect(unchanged.unchanged).toBe(true);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
 const exported=await json<Awaited<ReturnType<typeof exportArchive>>>(call('/api/operator/data/export',undefined,f.cookie)),reordered=structuredClone(exported)
 reordered.archive.tables.learning_observations.reverse();const {sha256:ignored,...archiveBody}=reordered.archive;void ignored;reordered.archive.sha256=await hash(archiveBody)
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Restore owner'}),cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
 const restored=await json<{status:string}>(call('/api/operator/data/import',reordered,cookie)),again=await json<typeof exported>(call('/api/operator/data/export',undefined,cookie))
 expect({status:restored.status,originals:again.archive.tables.learning_observations,snapshots:again.archive.tables.learning_commitments}).toEqual({status:'complete',originals:exported.archive.tables.learning_observations,snapshots:exported.archive.tables.learning_commitments})
})
it('[AI-010 LEARN-002] configures providers, meters the monthly cap, preserves manual work and refuses invalid or revoked learning',async()=>{
 const f=await fixture();network.badCitation=true;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)

 const report=await json<{report:{meteredMicros:number;reservedMicros:number;inputTokens:number;outputTokens:number}}>(call('/api/operator/settings/ai',undefined,f.cookie));expect(report.report).toMatchObject({meteredMicros:1100,reservedMicros:0,inputTokens:100,outputTokens:500});expect(network.lastBody).toContain('configured-claude')
 await json(call('/api/operator/settings/ai',{monthlyBudgetMicros:0,includePrivate:false,choices:[]},f.cookie,undefined,'PUT'))
 const count=sent.length;const refusal=await json(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie),409);expect(refusal.error).toBe('ai_budget_exhausted');expect(refusal.message).toBeTruthy();expect(sent).toHaveLength(count)
 await json(call('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Manual while capped',wording:'Export still needs a date filter',observedAt:'2026-10-01T00:00:00Z'},f.cookie),201)
 expect((await call('/api/operator/triage',undefined,f.cookie)).ok).toBe(true)
 expect((await call('/api/public/requests/suggestions?title=export')).ok).toBe(true)
 await json(call('/api/operator/settings/ai',{monthlyBudgetMicros:100000000,includePrivate:false,choices:[{capability:'learning',provider:'openai',model:'configured-model'}]},f.cookie,undefined,'PUT'))
 network.badCitation=false
 const logged=vi.spyOn(console,'error').mockImplementation(()=>{})
 try{
  const cases=[...['GET','POST'].flatMap(method=>['PRIVATE MALFORMED PROVIDER secret-key',JSON.stringify({secret:'PRIVATE MALFORMED PROVIDER secret-key'})].map(body=>({method,body,reason:method==='GET'?'learning_source_payload_invalid':'learning_model_payload_invalid',throws:false}))),...['GET','POST'].map(method=>({method,body:'',reason:'learning_transport_failed',throws:true})),...['PRIVATE MODEL OUTPUT secret-key',JSON.stringify({question:{secret:'PRIVATE MODEL OUTPUT secret-key'}})].map(content=>({method:'POST',body:JSON.stringify({choices:[{message:{content},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:500}}),reason:'learning_model_output_invalid',throws:false}))]
  for(const fault of cases){
   const custom=bindings(),edge=custom.PENNY_LEARNING_EGRESS!;custom.PENNY_LEARNING_EGRESS={async send(wire){if(wire.method!==fault.method)return edge.send(wire);if(fault.throws)throw new Error('PRIVATE TRANSPORT '+wire.headers.Authorization);return {status:200,headers:{},body:fault.body}}}
   const response=await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie,custom);expect(response.status).toBe(409);expect(await response.json()).toEqual({error:fault.reason});expect(JSON.stringify(logged.mock.calls)).not.toContain('PRIVATE');expect(JSON.stringify(logged.mock.calls)).not.toContain('network-edge')
   const runs=(await env.DB.prepare('SELECT * FROM learning_runs').all()).results;expect(JSON.stringify(runs)).not.toContain('PRIVATE');expect(JSON.stringify(runs)).not.toContain('network-edge');expect(runs.some(run=>run.reason===fault.reason&&run.state===(fault.method==='POST'?'uncertain':'refused'))).toBe(true)
  }
 }finally{logged.mockRestore()}
 const noConfig=bindings();delete noConfig.PENNY_AI;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie,noConfig)).status).toBe(503)
 network.beforeModel=async()=>{await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run()};expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(401);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
})
