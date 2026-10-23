import {proveScorecards} from './scorecard-proof'
import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester,messages} from './support'
import {graph} from './notification-regression-fixture'
import type {ViewResult,SavedView} from '@/core/features/prioritisation/repository'
import type {ViewInput} from '@/core/features/prioritisation/formulas'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0083'))})
afterAll(()=>vi.restoreAllMocks())
it('[PRIO-003 PRIO-004 REQ-035] saves and shares transparent native-demand comparisons, re-sorts explicit inputs and keeps decisions and public records score-free',async()=>{
 const g=await graph(2),second=await requester('Morgan Reed')
 const json=async<T>(path:string,body?:unknown,method?:string,status=200,headers=g.operator):Promise<T>=>{const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const prior=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(prior.map(async({name})=>({name,columns:(await env.DB.prepare(`PRAGMA table_info("${name}")`).all<{name:string}>()).results.map(c=>c.name)})))
 const readPrior=async()=>(await env.DB.batch(tables.map(({name,columns})=>env.DB.prepare(`SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM "${name}" ORDER BY rowid`)))).map(r=>r.results)
 const pre=await readPrior()
 await applyD1Migrations(env.DB,inject('migrations'));await applyD1Migrations(env.DB,inject('migrations'));expect(await readPrior()).toEqual(pre)
 await json('/api/operator/boards/regression/vote-importance',{enabled:true,labels:['Nice to have','Important','Must have']},'PUT')
 expect((await call(`/api/public/requests/${g.requests[0].slug}/vote`,{importance:3},second)).status).toBe(204)
 const p=await json<{id:string}>('/api/operator/hierarchy/product',{name:'Harbor platform'},'POST',201),c=await json<{id:string}>('/api/operator/hierarchy/component',{name:'Finance',parentId:p.id},'POST',201)
 const features:string[]=[];for(const [index,name] of ['Scheduled finance reports','Department exports'].entries()){
  const f=await json<{id:string}>('/api/operator/hierarchy/feature',{name,parentId:c.id},'POST',201);features.push(f.id)
  await json(`/api/operator/hierarchy/feature/${f.id}/link`,{kind:'request',targetId:g.requests[index].id,linked:true},'PUT')
 }
 const definition={name:'Finance RICE',entity:'features',shared:true,formula:'rice',weights:{},manualInputs:{[features[0]]:{impact:3,confidence:80,effort:2},[features[1]]:{impact:8,confidence:50,effort:1}}}
 const created=await json<{id:string}>('/api/operator/prioritisation',definition,'POST',201),path=`/api/operator/prioritisation/${created.id}`
 let view=await json<ViewResult>(path)
 expect(view.rows.map(r=>r.id)).toEqual([features[1],features[0]])
 expect(view.rows[0].score).toBe(4);expect(view.rows[1].score).toBeCloseTo(2.4)
 expect(view.rows[1]).toMatchObject({importance:[0,0,1,0],inputs:{reach:2,impact:3,confidence:80,effort:2,importance3:1}})
 // Shared views read the same live source set under another real native session.
 await json('/api/operator/settings/operators',{email:'finance-peer@example.test'},'POST',202)
 const token=new URL(messages.findLast(message=>message.to==='finance-peer@example.test')!.url).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token});expect(confirmed.status).toBe(303);const peer={Cookie:confirmed.headers.get('Set-Cookie')!.split(';')[0]}
 expect((await json<ViewResult>(path,undefined,'GET',200,peer)).rows).toEqual(view.rows)
 expect((await call(path,{...view.view,revision:view.revision},peer,'PUT')).status).toBe(404)
 await json(path,{...view.view,revision:view.revision,formula:'weighted_sum',weights:{reach:0,importance3:5}},'PUT')
 expect((await call(path,{...view.view,revision:view.revision},g.operator,'PUT')).status).toBe(409)
 view=await json<ViewResult>(path);expect(view.rows.map(r=>r.id)).toEqual([features[0],features[1]]);expect(view.rows[0].score).toBe(5);expect(view.rows[0].weights.importance3).toBe(5)
 const privateView=await json<{id:string}>('/api/operator/prioritisation',{name:'Private scenario',entity:'requests',shared:false,formula:'rice'},'POST',201)
 expect((await call(`/api/operator/prioritisation/${privateView.id}`,undefined,peer)).status).toBe(404)
 expect((await json<SavedView[]>('/api/operator/prioritisation',undefined,'GET',200,peer)).map(v=>v.id)).toEqual([created.id])
 const missing=await json<ViewResult>(`/api/operator/prioritisation/${privateView.id}`)
 expect(missing.rows.every(r=>r.score===null&&r.missing.includes('effort'))).toBe(true)
 // Other presets require stated values; zero is valid value, never invented effort.
 const preset=async(formula:string,manualInputs:ViewInput['manualInputs'])=>{await json(path,{...view.view,revision:view.revision,formula,manualInputs},'PUT');view=await json<ViewResult>(path);return view.rows}
 expect((await preset('value_over_effort',{[features[0]]:{value:12,effort:3}}))[0]).toMatchObject({id:features[0],score:4})
 expect((await preset('weighted_segment_demand',{[features[0]]:{segmentDemand:7}})).find(r=>r.id===features[0])?.inputs.segmentDemand).toBe(7)
 const before=await json<ViewResult>(path)
 await env.DB.exec("CREATE TRIGGER refuse_priority_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type='prioritisation_view' BEGIN SELECT RAISE(ABORT,'no audit'); END")
 try{expect((await call(path,{...before.view,name:'Unrecorded change',revision:before.revision},g.operator,'PUT')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER refuse_priority_audit')}
 expect(await json<ViewResult>(path)).toEqual(before)
 for(const payload of [{...definition,formula:'rice',manualInputs:{[features[0]]:{effort:0}}},{...definition,ownerId:'forged'},{...definition,weights:{unknown:1}}])expect((await call('/api/operator/prioritisation',payload,g.operator)).status).toBe(400)
 expect((await call('/api/operator/prioritisation')).status).toBe(401)
 expect((await call('/api/operator/prioritisation',definition,{...g.operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 for(const url of ['/api/public/requests','/api/public/roadmap','/api/public/releases','/api/operator/decisions']){const text=await(await call(url,undefined,g.operator)).text();expect(text).not.toContain('Finance RICE');expect(text).not.toContain('"score"')}
 const exported=await json<{archive:{tables:Record<string,unknown[]>}}>('/api/operator/data/export');expect(exported.archive.tables.penny_priority_views).toHaveLength(2)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 await proveScorecards(g.operator,peer,g.requests)
})
