import {expect} from 'vitest'
import {call,env} from './support'
export async function scorecardProof(owner:Record<string,string>,peer:Record<string,string>,ideaId:string){
 const json=async<T>(path:string,body?:unknown,method?:string,status=200,headers=owner):Promise<T>=>{const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const definition={name:'synthetic-penny-4',entity:'requests',criteria:[{name:'Impact',scale:5,weight:2},{name:'Confidence',scale:10,weight:1}]}
 const {id}=await json<{id:string}>('/api/operator/scorecards',definition,'POST',201),path='/api/operator/scorecards/'+id
 const actor=(await json<{scorerId:string}>('/api/operator/scorecards')).scorerId
 const peerActor=(await json<{scorerId:string}>('/api/operator/scorecards',undefined,'GET',200,peer)).scorerId
 expect((await call('/api/operator/scorecards',definition,peer)).status).toBe(403)
 await json(path+'/scores/'+actor,{ideaId,version:1,values:[5,8]},'PUT')
 await json(path+'/scores/'+peerActor,{ideaId,version:1,values:[2,5]},'PUT',200,peer)
 type Result={revision:number;versions:{version:number;criteria:typeof definition.criteria;ideas:{id:string;score:number|null;scorers:{name:string;values:number[];weighted:number}[]}[]}[]}
 let card=await json<Result>(path)
 const idea=card.versions[0].ideas.find(row=>row.id===ideaId)!
 // Owner (5*2+8)/3=6; peer (2*2+5)/3=3; mean=4.5.
 expect(idea.score).toBe(4.5);expect(idea.scorers.map(s=>s.weighted).sort()).toEqual([3,6])
 expect(idea.scorers.map(s=>s.values)).toEqual(expect.arrayContaining([[5,8],[2,5]]))
 expect(new Set(idea.scorers.map(s=>s.name)).size).toBe(2)
 expect((await call(path+'/scores/'+peerActor,{ideaId,version:1,values:[1,1]},owner,'PUT')).status).toBe(403)
 expect((await call(path+'/scores/'+actor,{ideaId,version:1,values:[6,8]},owner,'PUT')).status).toBe(400)
 expect(await json<Result>(path)).toEqual(card)
 await json(path,{...definition,revision:card.revision,criteria:[{name:'Benefit',scale:5,weight:1}]},'PUT')
 card=await json<Result>(path);expect(card.revision).toBe(2)
 expect(card.versions.find(v=>v.version===1)?.ideas.find(r=>r.id===ideaId)).toEqual(idea)
 expect(card.versions.find(v=>v.version===1)?.criteria).toEqual(definition.criteria)
 expect(card.versions.find(v=>v.version===2)?.ideas.every(r=>r.score===null)).toBe(true)
 expect((await call(path,{...definition,revision:1},owner,'PUT')).status).toBe(409)
 expect((await call(path+'/scores/'+actor,{ideaId,version:1,values:[5,8]},owner,'PUT')).status).toBe(409)
 return {id,card}
}

export async function scorecardArchiveProof(bundle:unknown,id:string){
 const {reset,applyD1Migrations}=await import('cloudflare:test'),{inject}=await import('vitest'),{owner}=await import('./support')
 const tables=['penny_scorecards','penny_scorecard_versions','penny_scorecard_scores','penny_scorecard_inputs']
 const read=async()=>Promise.all(tables.map(table=>env.DB.prepare('SELECT * FROM '+table+' ORDER BY rowid').all().then(result=>result.results)))
 const before=await read(),peerId=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('finance-peer@example.test').first<string>('id')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));const operator=await owner()
 const result=await call('/api/operator/data/import',bundle,operator)
 expect([200,202],await result.clone().text()).toContain(result.status)
 let operation=await result.json() as {operationId:string;status:string}
 for(let step=0;operation.status!=='complete'&&step<100;step++)operation=await(await call('/api/operator/data/operations/'+operation.operationId+'/resume',{},operator)).json() as typeof operation
 expect(operation.status).toBe('complete');expect(await read()).toEqual(before)
 const readCard=async()=>{const response=await call('/api/operator/scorecards/'+id,undefined,operator);expect(response.status).toBe(200);return response.json() as Promise<{versions:{ideas:{scorers:{name:string;values:number[];weighted:number}[]}[]}[]}>}
 expect((await readCard()).versions.flatMap(v=>v.ideas.flatMap(r=>r.scorers)).length).toBe(2)
 // Restored product attributions confer no native session or key authority.
 expect((await call('/api/operator/scorecards/'+id)).status).toBe(401)
 const native=await env.DB.prepare('SELECT id,status FROM oa_operators WHERE email=?').bind('finance-peer@example.test').first<{id:string;status:string}>()
 if(native&&native.status!=='inactive')expect((await call('/api/operator/settings/operators/'+native.id,{},operator,'DELETE')).status).toBe(200)
 const target={table:'operators',id:peerId},preview=await call('/api/operator/data/erasure/preview',target,operator)
 expect(preview.status).toBe(200)
 const plan=await preview.json() as {planHash:string;blockedCopies:unknown[]}
 expect(plan.blockedCopies).toEqual([])
 const erase=await call('/api/operator/data/erasure',{...target,planHash:plan.planHash},operator)
 expect([200,202],await erase.clone().text()).toContain(erase.status)
 let erased=await erase.json() as typeof operation
 for(let step=0;erased.status!=='complete'&&step<100;step++)erased=await(await call('/api/operator/data/operations/'+erased.operationId+'/resume',{},operator)).json() as typeof operation
 expect(erased.status).toBe('complete')
 const scorers=(await readCard()).versions.flatMap(v=>v.ideas.flatMap(r=>r.scorers))
 expect(scorers.find(s=>s.name==='a removed operator')).toMatchObject({values:[2,5],weighted:3})
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_scorecard_scores WHERE scorer_id=?').bind(peerId).first('n')).toBe(0)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
}
