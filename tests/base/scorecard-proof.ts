import {applyD1Migrations,reset} from 'cloudflare:test'
import {expect,inject} from 'vitest'
import {call,env,owner} from './support'
import type {ScorecardResult} from '@/core/features/prioritisation/scorecard-model'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'
export async function proveScorecards(operator:Record<string,string>,peer:Record<string,string>,ideas:{id:string}[]){
 const json=async<T>(path:string,body?:unknown,headers=operator,method=body===undefined?'GET':'POST',status=200):Promise<T>=>{const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const definition={name:'synthetic-penny-1 scorecard',entity:'requests',criteria:[{name:'Impact',scale:5,weight:2},{name:'Confidence',scale:10,weight:1}]}
 expect((await call('/api/operator/scorecards',definition,peer)).status).toBe(403)
 const {id}=await json<{id:string}>('/api/operator/scorecards',definition,operator,'POST',201),path=`/api/operator/scorecards/${id}`
 let card=await json<ScorecardResult>(path),version=card.versions[0].id
 await json(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[4,6]},operator,'PUT')
 await json(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[2,3]},peer,'PUT')
 await json(`${path}/ideas/${ideas[1].id}`,{versionId:version,values:[5,10]},operator,'PUT')
 card=await json<ScorecardResult>(path)
 expect(card.rows.map(row=>row.id)).toEqual([ideas[1].id,ideas[0].id])
 // First scorer: (80*2+60)/3; peer: (40*2+30)/3; mean = 55.
 expect(card.rows[1].score).toBeCloseTo(55)
 expect(card.submissions.filter(s=>s.ideaId===ideas[0].id).map(s=>({name:s.scorer,values:s.values}))).toEqual(expect.arrayContaining([{name:'Owner',values:[4,6]},{name:'finance-peer',values:[2,3]}]))
 const peerScore=card.submissions.find(s=>s.ideaId===ideas[0].id&&!s.own)!
 expect((await call(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[5,10],operatorId:'another-operator'},operator,'PUT')).status).toBe(400)
 expect((await call(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[6,10]},operator,'PUT')).status).toBe(422)
 expect((await json<ScorecardResult>(path)).submissions.find(s=>s.id===peerScore.id)).toEqual(peerScore)
 const comparison=await json<{id:string}>('/api/operator/prioritisation',{name:'Scorecard comparison',entity:'requests',formula:'scorecard',scorecardId:id},operator,'POST',201)
 expect((await json<{rows:{id:string;score:number}[]}>(`/api/operator/prioritisation/${comparison.id}`)).rows.map(row=>[row.id,row.score])).toEqual([[ideas[1].id,100],[ideas[0].id,55]])
 await json(path,{...definition,criteria:[{name:'Revised impact',scale:5,weight:1}],revision:card.revision},operator,'PUT')
 expect((await call(path,{...definition,revision:card.revision},operator,'PUT')).status).toBe(409)
 expect((await call(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[4,6]},operator,'PUT')).status).toBe(409)
 card=await json<ScorecardResult>(path)
 expect(card.rows.every(row=>row.score===null)).toBe(true)
 expect(card.versions.find(v=>v.id===version)?.criteria).toEqual(definition.criteria)
 expect(card.submissions.find(s=>s.id===peerScore.id)).toEqual(peerScore)
 version=card.versions[0].id
 await json(`${path}/ideas/${ideas[0].id}`,{versionId:version,values:[5]},operator,'PUT')
 expect((await json<ScorecardResult>(path)).rows[0]).toMatchObject({id:ideas[0].id,score:100})
 expect((await call(path)).status).toBe(401)
 expect((await call('/api/operator/scorecards/invalid',undefined,operator)).status).toBe(400)
 const original=await json<ScorecardResult>(path)
 const bundle=await json<{archive:Archive;journal:ErasureJournal}>('/api/operator/data/export')
 expect(bundle.archive.tables.penny_scorecard_versions).toHaveLength(2)
 expect(bundle.archive.tables.penny_score_inputs).toHaveLength(7)
 // Empty-install restore uses the public import and resume doors, then the same read.
 await reset();await applyD1Migrations(env.DB,inject('migrations'));const destination=await owner()
 let operation=await json<{operationId:string;status:string}>('/api/operator/data/import',bundle,destination)
 for(let step=0;step<80&&operation.status!=='complete';step++)operation=await json(`/api/operator/data/operations/${operation.operationId}/resume`,{},destination)
 expect(operation.status).toBe('complete')
 const restored=await json<ScorecardResult>(path,undefined,destination)
 expect(restored.submissions.map(s=>[s.values,s.result])).toEqual(original.submissions.map(s=>[s.values,s.result]))
 const peerActor=bundle.archive.tables.operators.find(o=>o.display_name==='finance-peer')!
 const target={table:'operators',id:peerActor.id},preview=await json<{planHash:string;blockedCopies:unknown[]}>('/api/operator/data/erasure/preview',target,destination)
 expect(preview.blockedCopies).toEqual([])
 operation=await json('/api/operator/data/erasure',{...target,planHash:preview.planHash},destination)
 for(let step=0;step<80&&operation.status!=='complete';step++)operation=await json(`/api/operator/data/operations/${operation.operationId}/resume`,{},destination)
 expect(operation.status).toBe('complete')
 const erased=await json<ScorecardResult>(path,undefined,destination)
 expect(erased.submissions.find(s=>s.id===peerScore.id)).toMatchObject({scorer:'a removed operator',values:[2,3],result:peerScore.result})
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_score_scorers WHERE operator_id=?').bind(peerActor.id).first('n')).toBe(0)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}
