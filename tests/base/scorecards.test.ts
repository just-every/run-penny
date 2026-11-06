import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,beforeEach,expect,inject,it,vi} from 'vitest'
import {call,env,messages,owner} from './support'
import {graph,rows} from './notification-regression-fixture'
import type {readScorecard} from '@/core/features/scorecards/repository'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'

type Card=Awaited<ReturnType<typeof readScorecard>>
const definition={name:'Native request scorecard',criteria:[{key:'impact',name:'Customer impact',scale:5,weight:3},{key:'confidence',name:'Confidence',scale:10,weight:1}]}
const tables=['penny_scorecards','penny_scorecard_versions','penny_scorecard_scores']
const snapshot=async()=>Object.fromEntries(await Promise.all([...tables,'audit_entries'].map(async table=>[table,await rows(table)])))
async function json<T>(path:string,headers:Record<string,string>,body?:unknown,method?:string,status=200):Promise<T>{
 const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>
}
async function peer(operator:Record<string,string>){
 const email=['synthetic-penny-peer','example.test'].join('@')
 await json('/api/operator/settings/operators',operator,{email},'POST',202)
 const token=new URL(messages.findLast(m=>m.to===email)!.url).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token});expect(confirmed.status).toBe(303)
 const headers={Cookie:confirmed.headers.get('Set-Cookie')!.split(';')[0]}
 expect((await call('/api/auth/session',undefined,headers)).status).toBe(200)
 return {headers,email}
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0110'))})
afterEach(()=>vi.restoreAllMocks())
it('[PRIO-004] two native scorers rank requests transparently, keep version history and refuse unsafe or unrecorded changes',async()=>{
 const g=await graph(4)
 // Upgrade a populated immediate predecessor, including native authority and
 // participation, then repeat. No prior row or applied migration is replaced.
 const previous=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{name:string}>()).results
 const prior=async()=> (await env.DB.batch(previous.map(({name})=>env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)))).map(r=>r.results)
 const before=await prior();await applyD1Migrations(env.DB,inject('migrations'));const once=await prior()
 // Only the migration ledger appends the newly applied migration.
 for(const [index,table] of previous.entries())if(table.name!=='d1_migrations')expect(once[index],table.name).toEqual(before[index])
 await applyD1Migrations(env.DB,inject('migrations'));expect(await prior()).toEqual(once)
 const p=await peer(g.operator),actors=(await env.DB.prepare('SELECT id,email FROM operators ORDER BY id').all<{id:string;email:string}>()).results
 const peerId=actors.find(a=>a.email===p.email)!.id,ownerId=actors.find(a=>a.email!==p.email)!.id
 const decision=await json<{id:string;slug:string}>('/api/operator/decisions',g.operator,{question:'Which improvement should we commit?',ownerOperatorId:ownerId},'POST',201)
 const bet=await json<{id:string}>(`/api/operator/decisions/${decision.id}/bets`,g.operator,{title:'Explicit business choice',summary:'A separately reasoned alternative'},'POST',201)
 const link=await env.DB.prepare('SELECT evidence_id FROM request_evidence_links WHERE request_id=?').bind(g.requests[0].id).first<{evidence_id:string}>()
 await json(`/api/operator/evidence/${link!.evidence_id}/links`,g.operator,{target:'bet',targetId:bet.id,stance:'supporting'},'PUT')
 const committed=await json<{itemId:string}>(`/api/operator/decisions/${decision.id}/commit`,g.operator,{selectedCandidateBetId:bet.id,rationale:'Independent human decision',ownerOperatorId:ownerId,confidence:'medium',reviewAt:'2099-12-01',noViableAlternativeReason:'No viable alternative identified'})
 await json(`/api/operator/roadmap/${committed.itemId}/approve`,g.operator,{publicTitle:'Approved public improvement',publicSummary:'Approved public problem',boardSlug:'regression',requestIds:[g.requests[0].id]})
 const decisionTables=['decisions','candidate_bets','decision_revisions','decision_bet_snapshots','decision_evidence_snapshots','roadmap_items']
 const business=async()=>Object.fromEntries(await Promise.all(decisionTables.map(async table=>[table,await rows(table)])))
 const businessBefore=await business(),briefBefore=await json(`/api/operator/decisions/${decision.slug}`,g.operator)
 const publicBefore=await json(`/api/public/requests/${g.requests[0].slug}`,g.operator)
 const created=await json<{id:string;versionId:string}>('/api/operator/scorecards',g.operator,definition,'POST',201),path=`/api/operator/scorecards/${created.id}`
 const score=(index:number,inputs:Record<string,number>,headers:Record<string,string>=g.operator,versionId=created.versionId)=>call(`${path}/requests/${g.requests[index].id}/scores`,{versionId,inputs},headers,'PUT')
 for(const [index,a,b] of [[0,{impact:5,confidence:2},{impact:3,confidence:6}],[1,{impact:3,confidence:9},{impact:4,confidence:9}]] as const){expect((await score(index,a)).status).toBe(204);expect((await score(index,b,p.headers)).status).toBe(204)}
 expect((await score(2,{impact:5})).status).toBe(204)
 const original=await json<Card>(path,g.operator),a=original.rows.find(r=>r.requestId===g.requests[0].id)!,b=original.rows[0],missing=original.rows.find(r=>r.requestId===g.requests[2].id)!
 expect(original.rows.slice(0,2).map(r=>[r.requestId,r.weightedResult,r.rank])).toEqual([[g.requests[1].id,0.75,1],[g.requests[0].id,0.7,2]])
 expect(a.scorers.map(s=>[s.operatorId,s.inputs]).sort()).toEqual([[ownerId,{impact:5,confidence:2}],[peerId,{impact:3,confidence:6}]].sort())
 expect(a.components).toEqual([{key:'impact',name:'Customer impact',scale:5,weight:3,count:2,mean:4,contribution:2.4},{key:'confidence',name:'Confidence',scale:10,weight:1,count:2,mean:4,contribution:0.4}])
 expect(b.components.map(c=>c.mean)).toEqual([3.5,9])
 expect(missing).toMatchObject({weightedResult:null,rank:null,missing:['confidence']});expect(missing.scorers[0].inputs).toEqual({impact:5});expect(missing.components[1]).toMatchObject({count:0,mean:null,contribution:null})
 const unscored=original.rows.find(r=>r.requestId===g.requests[3].id)!;expect(unscored.scorers).toEqual([]);expect(unscored.missing).toEqual(['impact','confidence'])
 expect((await json<Card>(path,p.headers)).rows).toEqual(original.rows)
 // Equal weighted results have one competition rank and a stable ID order.
 expect((await score(2,{impact:4,confidence:4})).status).toBe(204)
 const tied=(await json<Card>(path,g.operator)).rows.filter(r=>r.weightedResult===0.7)
 expect(tied.map(r=>r.requestId)).toEqual([g.requests[0].id,g.requests[2].id].sort());expect(tied.map(r=>r.rank)).toEqual([2,2])
 const old=await json<Card>(path,g.operator)
 const revised={...definition,name:'Revised request scorecard',criteria:definition.criteria.map(c=>({...c,weight:c.key==='impact'?9:1}))}
 const version=await json<{id:string;versionId:string}>(path+'/versions',g.operator,{previousVersionId:created.versionId,definition:revised},'POST',201)
 expect((await json<Card>(path,g.operator)).rows.every(r=>r.weightedResult===null&&r.scorers.length===0)).toBe(true)
 for(const [index,a,b] of [[0,{impact:5,confidence:2},{impact:3,confidence:6}],[1,{impact:3,confidence:9},{impact:4,confidence:9}]] as const){expect((await score(index,a,g.operator,version.versionId)).status).toBe(204);expect((await score(index,b,p.headers,version.versionId)).status).toBe(204)}
 expect((await json<Card>(path,g.operator)).rows.slice(0,2).map(r=>[r.requestId,r.weightedResult])).toEqual([[g.requests[0].id,0.76],[g.requests[1].id,0.72]])
 const history=await json<Card>(`${path}?versionId=${created.versionId}`,p.headers)
 expect(history.version).toEqual(old.version);expect(history.rows).toEqual(old.rows)
 const stable=await snapshot()
 expect((await score(0,{impact:1})).status).toBe(409)
 expect((await call(path+'/versions',{previousVersionId:created.versionId,definition:revised},g.operator)).status).toBe(409)
 for(const inputs of [{impact:6},{confidence:11},{impact:0},{impact:1.5},{unknown:3}] as Record<string,number>[])expect((await score(0,inputs,g.operator,version.versionId)).status).toBe(400)
 for(const criteria of [[{key:'impact',name:'Impact',scale:7,weight:1}],[{key:'impact',name:'Impact',scale:5,weight:0}],[...definition.criteria,definition.criteria[0]]])expect((await call('/api/operator/scorecards',{name:'Invalid',criteria},g.operator)).status).toBe(400)
 expect((await call(path+'/versions',{previousVersionId:version.versionId,definition:revised},p.headers)).status).toBe(404)
 expect((await score(0,{impact:1},{...g.operator,Origin:'https://foreign.test'},version.versionId)).status).toBe(403)
 expect((await call(path)).status).toBe(401);expect((await score(0,{impact:1},g.person,version.versionId)).status).toBe(401)
 expect(await snapshot()).toEqual(stable)
 await env.DB.exec("CREATE TRIGGER refuse_scorecard_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type='scorecard' BEGIN SELECT RAISE(ABORT,'no audit'); END")
 try{
  expect((await call('/api/operator/scorecards',definition,g.operator)).status).toBe(503)
  expect((await call(path+'/versions',{previousVersionId:version.versionId,definition:revised},g.operator)).status).toBe(503)
  expect((await score(0,{impact:1},g.operator,version.versionId)).status).toBe(503)
 }finally{await env.DB.exec('DROP TRIGGER refuse_scorecard_audit')}
 expect(await snapshot()).toEqual(stable)
 const native=await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(p.email).first<{id:string}>()
 await json(`/api/operator/settings/operators/${native!.id}`,g.operator,{},'DELETE')
 const removed=await snapshot();expect((await score(0,{impact:1},p.headers,version.versionId)).status).toBe(401);expect((await call(path,undefined,p.headers)).status).toBe(401);expect(await snapshot()).toEqual(removed)
 expect(await business()).toEqual(businessBefore)
 expect(await json(`/api/operator/decisions/${decision.slug}`,g.operator)).toEqual(briefBefore)
 expect(await json(`/api/public/requests/${g.requests[0].slug}`,g.operator)).toEqual(publicBefore)
 for(const door of [`/api/operator/decisions/${decision.slug}`,'/api/public/requests',`/api/public/requests/${g.requests[0].slug}`,'/api/public/roadmap','/api/public/releases','/api/operator/decisions']){
  const response=await call(door,undefined,g.operator);expect(response.status).toBe(200)
  const text=await response.text();for(const value of [created.id,created.versionId,definition.name,'"weightedResult"','"scorers"'])expect(text).not.toContain(value)
 }
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('[PRIO-004 DATA-001 DATA-003] populated scorecards restore without source authority and erasure removes request scores while anonymising former scorers',async()=>{
 await applyD1Migrations(env.DB,inject('migrations'))
 const g=await graph(),p=await peer(g.operator)
 const other=await json<{slug:string}>('/api/public/requests',g.person,{title:'Independent proposal',description:'Different source content',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},'POST',201)
 await json(`/api/operator/moderation/${other.slug}`,g.operator,{verdict:'approved',title:'Independent public proposal',description:'Different approved content',boardSlug:'regression',displayName:'Second author'})
 g.requests.push((await env.DB.prepare('SELECT id,slug FROM requests WHERE slug=?').bind(other.slug).first<{id:string;slug:string}>())!)
 const card=await json<{id:string;versionId:string}>('/api/operator/scorecards',g.operator,definition,'POST',201),path=`/api/operator/scorecards/${card.id}`
 for(const request of g.requests)expect((await call(`${path}/requests/${request.id}/scores`,{versionId:card.versionId,inputs:{impact:5,confidence:8}},p.headers,'PUT')).status).toBe(204)
 const history=await json<Card>(path,g.operator)
 const revised=await json<{versionId:string}>(path+'/versions',g.operator,{previousVersionId:card.versionId,definition:{...definition,name:'Second native definition'}},'POST',201)
 for(const request of g.requests)expect((await call(`${path}/requests/${request.id}/scores`,{versionId:revised.versionId,inputs:{impact:3,confidence:6}},p.headers,'PUT')).status).toBe(204)
 const original=await json<Card>(path,g.operator),saved=await json<{archive:Archive;journal:ErasureJournal}>('/api/operator/data/export',g.operator)
 for(const table of tables)expect(saved.archive.tables[table].length,table).toBeGreaterThan(0)
 await reset();await applyD1Migrations(env.DB,inject('migrations'));const destination=await owner()
 const authority=(await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results
 await json('/api/operator/data/import',destination,saved)
 expect((await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results).toEqual(authority)
 expect((await call(path,undefined,g.operator)).status).toBe(401);expect((await call(path,undefined,p.headers)).status).toBe(401)
 expect((await json<Card>(path,destination)).rows).toEqual(original.rows)
 const earlier=await json<Card>(`${path}?versionId=${card.versionId}`,destination);expect(earlier.version).toEqual(history.version);expect(earlier.rows).toEqual(history.rows)
 const unchanged=await snapshot()
 expect((await call(`${path}/requests/${g.requests[0].id}/scores`,{versionId:revised.versionId,inputs:{impact:1}},p.headers,'PUT')).status).toBe(401)
 expect(await snapshot()).toEqual(unchanged)
 const restored=await json<{archive:Archive}>('/api/operator/data/export',destination)
 for(const table of tables)expect(restored.archive.tables[table],table).toEqual(saved.archive.tables[table])
 const former=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(p.email).first<{id:string}>()
 const erased=await json<{planHash:string;blockedCopies:unknown[]}>('/api/operator/data/erasure/preview',destination,{table:'operators',id:former!.id})
 expect(erased.blockedCopies).toEqual([])
 await json('/api/operator/data/erasure',destination,{table:'operators',id:former!.id,planHash:erased.planHash})
 const anonymous=await json<Card>(path,destination);expect(anonymous.rows.slice(0,2).every(r=>r.scorers[0].displayName==='Erased operator')).toBe(true)
 expect(anonymous.rows.map(r=>r.weightedResult)).toEqual(original.rows.map(r=>r.weightedResult))
 const root={table:'requests',id:g.requests[0].id},preview=await json<{planHash:string;counts:Record<string,number>;blockedCopies:{table:string;key:string;resolvable?:true}[]}>('/api/operator/data/erasure/preview',destination,root)
 expect(preview.counts.penny_scorecard_scores).toBe(2)
 expect(preview.blockedCopies.filter(copy=>!copy.resolvable)).toEqual([])
 await json('/api/operator/data/erasure',destination,{...root,planHash:preview.planHash,copies:preview.blockedCopies.map(copy=>({table:copy.table,key:copy.key,resolution:'redact'}))})
 const after=await json<Card>(path,destination);expect(after.rows.map(r=>r.requestId)).toEqual([g.requests[1].id]);expect(after.rows[0].scorers[0].inputs).toEqual({impact:3,confidence:6})
 expect((await call('/api/operator/data/import',saved,destination)).status).toBe(409)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
