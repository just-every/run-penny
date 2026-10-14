import {expect,it,vi} from 'vitest'
import {env} from 'cloudflare:workers'
import {call,json,fixture,path,bindings,sent,network} from './learning-test-runtime'
import {learningOutput} from './learning-fixture'
import {digest} from '@/core/features/auth/native-tokens'
it('[LEARN-001] captures native and real-protocol Orbit facts, validates exact spans, compares no-build and commits an immutable accountable protocol',async()=>{
 const f=await fixture();const run=await json<{artifactId:string}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie))
 const detail=await json<{observations:Record<string,unknown>[];artifacts:{body:ReturnType<typeof learningOutput>;id:string}[]}>(call(path+`/investigations/${f.investigation.id}`,undefined,f.cookie));expect(detail.observations).toHaveLength(2);expect(detail.observations.every(o=>o.requester_id===null&&o.account_id===null)).toBe(true)
 const orbit=detail.observations.find(o=>String(o.eventKey).startsWith('orbit:'))!,original=orbit.original as {envelope:{text:string;revision:string;canonicalUrl:string}},raw=JSON.parse(original.envelope.text),citation=detail.artifacts[0].body.citations.find(c=>c.observationId===orbit.id)!
 expect({human:orbit.wording,rawPreserved:await digest(original.envelope.text)===original.envelope.revision,exactQuote:String(orbit.wording).slice(citation.start,citation.end),quote: citation.quote,provenance:orbit.presentation}).toMatchObject({human:`Signal subject: ${raw.subject}`,rawPreserved:true,exactQuote:raw.subject,quote:raw.subject,provenance:{sourceLabel:raw.subject,observedAt:raw.occurred_at,href:original.envelope.canonicalUrl,excerpts:[{quote:raw.subject}]}})
 const body=detail.artifacts[0].body;expect(body.clarification?.distinguishes).toHaveLength(2);expect(body.options.some(o=>o.kind==='no-build')).toBe(true)
 expect((await call(path+`/investigations/${f.investigation.id}/commit`,{interpretationId:run.artifactId,optionId:'assist',rationale:'Test the support explanation first',confidence:'low',reviewAt:'2098-01-01T00:00:00Z'},f.cookie)).status).toBe(201)
 const snapshot=await env.DB.prepare('SELECT snapshot_json FROM learning_commitments').first<string>('snapshot_json');expect(JSON.parse(snapshot!).selectedOption.supportingEvidenceCount).toBe(2);expect(JSON.parse(snapshot!).ownerOperatorId).toBeTruthy();expect(JSON.parse(snapshot!).protocol.denominator).toBe(10)
 await expect(env.DB.prepare("UPDATE learning_commitments SET snapshot_json='{}'").run()).rejects.toThrow('learning_snapshot_immutable')
 expect((await call(path)).status).toBe(401);expect((await call('/api/public/learning')).status).toBe(404)
 const unchanged=await json<{unchanged:boolean}>(call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie));expect(unchanged.unchanged).toBe(true);expect(sent.filter(s=>s.startsWith('POST'))).toHaveLength(1)
})
it('[LEARN-002] refuses forged citations, absent model configuration and an in-flight authority revocation without a derived result',async()=>{
 const f=await fixture();network.badCitation=true;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(409);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
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
 const noConfig=bindings();delete noConfig.PENNY_LEARNING;expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie,noConfig)).status).toBe(503)
 network.beforeModel=async()=>{await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run()};expect((await call(path+`/investigations/${f.investigation.id}/run`,{},f.cookie)).status).toBe(401);expect(await env.DB.prepare('SELECT count(*) n FROM learning_artifacts').first('n')).toBe(0)
})
