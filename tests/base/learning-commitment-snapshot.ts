import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
import type {Observation} from '@/core/features/learning/schema'
import type {Output} from '@/core/features/learning/ui/types'
import {call,json,path,type fixture} from './learning-test-runtime'

interface Commitment {
 id:string;artifact_id:string;actor_id:string;snapshot_json:string
 snapshot:{interpretationId:string;interpretationVersion:number;interpretation:Output;observations:Observation[];selectedOption:Output['options'][number];declinedOptions:Output['options'];protocol:Output['protocol'];rationale:string;confidence:string;reviewAt:string;ownerOperatorId:string;status:string}
}
interface Detail {
 artifacts:{id:string;version:number;state:string;body:Output}[]
 commitments:Commitment[]
 observations:(Observation&{original:Record<string,unknown>})[]
 corrections:{artifact_id:string;correction:string;actor_id:string}[]
}

/** Extend the existing native learning journey without another registration. */
export async function proveCommitmentSnapshot(f:Awaited<ReturnType<typeof fixture>>,artifactId:string){
 const url=path+`/investigations/${f.investigation.id}`
 const detail=await json<Detail>(call(url,undefined,f.cookie))
 const artifact=detail.artifacts.find(row=>row.id===artifactId)!
 expect(artifact.version).toBe(1)
 expect(artifact.body.interpretation).toBe('The record supports an unresolved handoff problem; feature demand alone does not explain the cancellation.')
 expect(artifact.body.options.map(option=>option.id)).toEqual(['build','assist'])
 expect(detail.commitments).toHaveLength(1)
 const commitment=detail.commitments[0],snapshot=commitment.snapshot
 const owner=await env.DB.prepare("SELECT id FROM operators WHERE display_name='Owner'").first<string>('id')
 expect(owner).toBeTruthy()

 // These are the real originals contributed to the interpretation, rather
 // than values read back from the commitment being checked.
 const originals=(await env.DB.prepare('SELECT o.* FROM learning_observations o JOIN learning_contributions c ON c.observation_id=o.id WHERE c.artifact_id=? ORDER BY o.id').bind(artifactId).all<Observation>()).results
 expect(originals).toHaveLength(2)
 const native=originals.find(row=>row.evidence_id===f.evidence.id)!
 const orbit=originals.find(row=>row.event_key.startsWith('orbit:'))!
 const nativeOriginal=JSON.parse(native.original_json)
 expect(native).toMatchObject({event_key:`native:evidence:${f.evidence.id}`,wording:'Customer cancelled after the report handoff failed.',observed_at:'2026-10-01T00:00:00Z',evidence_id:f.evidence.id,request_id:null})
 expect(nativeOriginal).toMatchObject({id:f.evidence.id,source_label:'Native cancellation note',wording:'Customer cancelled after the report handoff failed.',version_id:expect.any(String)})
 expect(orbit).toMatchObject({event_key:'orbit:fixture-orbit:'+['signals','cancellation'].join('/'),wording:'Signal subject: I cancelled because I could not hand off the report.',observed_at:'2026-10-01T00:00:00.000Z',evidence_id:null,request_id:null})
 expect(JSON.parse(JSON.parse(orbit.original_json).envelope.text)).toEqual({id:'cancellation',subject:'I cancelled because I could not hand off the report.',occurred_at:'2026-10-01T00:00:00.000Z',confidence:'observed'})
 expect(snapshot.observations.toSorted((a,b)=>a.id.localeCompare(b.id))).toEqual(originals)
 const protocol={
  cohort:'Ten consenting eligible renewal accounts',denominator:10,
  baseline:'Previous month handoff completion; not yet measured',window:'Four weeks after approved start',
  measure:'Accounts completing the handoff / ten eligible accounts',dataSource:'Authorized customer task observations',
  comparison:'Staged assisted versus usual onboarding',limits:'Observational comparison; cannot establish revenue saved',
  stopRule:'Stop for unauthorized contact or adverse customer response',budgetMicros:100000,
 }
 expect(snapshot.protocol).toEqual(protocol)
 expect({...snapshot,observations:snapshot.observations.toSorted((a,b)=>a.id.localeCompare(b.id))}).toEqual({
  interpretationId:artifactId,interpretationVersion:artifact.version,interpretation:artifact.body,
  observations:originals,selectedOption:artifact.body.options[1],declinedOptions:[artifact.body.options[0]],
  protocol,rationale:'Test the support explanation first',confidence:'low',reviewAt:'2098-01-01T00:00:00Z',
  ownerOperatorId:owner,status:'committed; outcome not yet observed',
 })
 expect(commitment.artifact_id).toBe(artifactId)
 expect(commitment.actor_id).toBe(owner)
 expect(JSON.parse(commitment.snapshot_json)).toEqual(snapshot)
 const audits=(await env.DB.prepare("SELECT actor_type,actor_id,details_json FROM audit_entries WHERE entity_id=? AND action='learning.committed'").bind(f.investigation.id).all<{actor_type:string;actor_id:string;details_json:string}>()).results
 expect(audits).toEqual([{actor_type:'operator',actor_id:owner,details_json:JSON.stringify({commitmentId:commitment.id,interpretationId:artifactId})}])
 const home=await json<{results:{id:string;body:Commitment['snapshot']}[]}>(call(path,undefined,f.cookie))
 expect(home.results.find(row=>row.id===commitment.id)!.body).toEqual(snapshot)

 const correction='The larger account needs a different handoff comparison.'
 await json(call(url+'/correct',{interpretationId:artifactId,correction},f.cookie))
 expect((await json<Detail>(call(url,undefined,f.cookie))).commitments).toEqual(detail.commitments)
 const wording='The customer completed the handoff after a guided walkthrough.'
 await json(call(`/api/operator/evidence/${f.evidence.id}/wording`,{wording,expectedVersionId:nativeOriginal.version_id},f.cookie,undefined,'PATCH'))
 const refresh=await json<{artifactId:string;unchanged:boolean}>(call(url+'/run',{},f.cookie))
 expect(refresh.unchanged).toBe(false)
 expect(refresh.artifactId).not.toBe(artifactId)
 const after=await json<Detail>(call(url,undefined,f.cookie))
 const current=after.artifacts.find(row=>row.id===refresh.artifactId)!
 expect(current).toMatchObject({version:2,state:'current'})
 expect(after.artifacts.find(row=>row.id===artifactId)!.state).toBe('contested')
 expect(after.corrections).toEqual([expect.objectContaining({artifact_id:artifactId,correction,actor_id:owner})])
 const revised=after.observations.find(row=>row.evidence_id===f.evidence.id&&row.wording===wording)!
 expect(revised.id).not.toBe(native.id)
 expect(revised.original).toMatchObject({id:f.evidence.id,wording})
 for(const option of current.body.options){
  expect(option.supportingObservationIds).toContain(revised.id)
  expect(option.supportingObservationIds).not.toContain(native.id)
 }
 expect(after.commitments).toEqual(detail.commitments)
 expect(after.commitments[0].snapshot_json).toBe(commitment.snapshot_json)
 const correctedHome=await json<{results:{id:string;body:Commitment['snapshot'];invalidated:boolean;invalidationReason:string}[]}>(call(path,undefined,f.cookie))
 expect(correctedHome.results.find(row=>row.id===commitment.id)).toMatchObject({body:snapshot,invalidated:true,invalidationReason:'source_or_interpretation_corrected'})
}
