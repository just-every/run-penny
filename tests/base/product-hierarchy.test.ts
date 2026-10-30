import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester} from './support'
import {graph} from './notification-regression-fixture'
import type {Hierarchy} from '@/core/features/hierarchy/types'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0082'))})
afterAll(()=>vi.restoreAllMocks())
it('[PRIO-001] populated upgrade, linked feature rollups, move custody and private source/archive boundaries work through operator routes',async()=>{
 const g=await graph(3),second=await requester('Morgan Reed')
 for(const r of g.requests)expect((await call(`/api/public/requests/${r.slug}/vote`,{},second)).status).toBe(204)
 const actor=await env.DB.prepare('SELECT id FROM operators').first<string>('id')
 const json=async<T>(path:string,body?:unknown,method?:string,status=200,headers=g.operator):Promise<T>=>{const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const accounts=[]
 for(const [name,revenueCents] of [['Harbor Analytics',120000],['Northstar Logistics',360000]] as const)accounts.push(await json<{id:string}>('/api/operator/accounts',{name,internalOwnerId:actor,revenueCents},'POST',201))
 const people=(await env.DB.prepare('SELECT id FROM requesters ORDER BY id').all<{id:string}>()).results
 for(let i=0;i<people.length;i++)await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(people[i].id,accounts[i].id,new Date().toISOString()).run()
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 // An additive migration may add columns; preserve every previous cell and row.
 const previous=await Promise.all(tables.map(async t=>({...t,columns:(await env.DB.prepare(`PRAGMA table_info("${t.name}")`).all<{name:string}>()).results.map(c=>'"'+c.name+'"')})))
 const read=()=>env.DB.batch(previous.map(t=>env.DB.prepare(`SELECT ${t.columns.join(',')} FROM "${t.name}" ORDER BY rowid`)))
 const before=(await read()).map(r=>r.results)
 await applyD1Migrations(env.DB,inject('migrations'));expect((await read()).map(r=>r.results)).toEqual(before)
 await applyD1Migrations(env.DB,inject('migrations'));expect((await read()).map(r=>r.results)).toEqual(before)
 const product=await json<{id:string}>('/api/operator/hierarchy/product',{name:'Private finance platform'},'POST',201)
 const components=[];for(const name of ['Reporting','Automation'])components.push(await json<{id:string}>('/api/operator/hierarchy/component',{name,parentId:product.id},'POST',201))
 const feature=await json<{id:string}>('/api/operator/hierarchy/feature',{name:'Private scheduled reports',parentId:components[0].id},'POST',201)
 for(const r of g.requests)await json(`/api/operator/hierarchy/feature/${feature.id}/link`,{kind:'request',targetId:r.id,linked:true},'PUT')
 const now=new Date().toISOString(),item='01J00000000000000000000000'
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,created_at,updated_at) VALUES(?,?,'Finance delivery','Private roadmap','planned',?,?)").bind(item,item,now,now).run()
 await json(`/api/operator/hierarchy/feature/${feature.id}/link`,{kind:'roadmap',targetId:item,linked:true},'PUT')
 const hierarchy=()=>json<Hierarchy>('/api/operator/hierarchy')
 expect((await hierarchy()).features[0]).toMatchObject({demand:{voters:2,accounts:2,evidence:3,revenueCents:480000},requests:expect.any(Array),roadmap:[{id:item}]})
 expect((await hierarchy()).features[0].requests).toHaveLength(3)
 await json(`/api/operator/hierarchy/feature/${feature.id}`,{name:'Private scheduled reports',parentId:components[1].id},'PATCH')
 expect((await hierarchy()).features[0]).toMatchObject({componentId:components[1].id,demand:{accounts:2,revenueCents:480000}})
 expect((await hierarchy()).features[0].requests).toHaveLength(3)
 const state=await hierarchy()
 expect((await call(`/api/operator/hierarchy/feature/${feature.id}`,{name:'Bad move',parentId:product.id},g.operator,'PATCH')).status).toBe(404)
 expect((await call('/api/operator/hierarchy/product',{name:'Bad origin'},{...g.operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 expect((await call('/api/operator/hierarchy')).status).toBe(401)
 expect((await call('/api/operator/hierarchy',undefined,second)).status).toBe(401)
 expect((await hierarchy())).toEqual(state)
 await env.DB.exec("CREATE TRIGGER reject_feature_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type='feature' BEGIN SELECT RAISE(ABORT,'no audit'); END")
 try{expect((await call(`/api/operator/hierarchy/feature/${feature.id}`,{name:'Unrecorded edit',parentId:components[0].id},g.operator,'PATCH')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER reject_feature_audit')}
 expect(await hierarchy()).toEqual(state)
 for(const path of ['/api/public/requests','/api/public/roadmap','/api/public/releases',`/api/public/requests/${g.requests[0].slug}`]){const text=await(await call(path)).text();for(const privateText of ['Private finance platform','Private scheduled reports','480000','revenueCents','componentId'])expect(text).not.toContain(privateText)}
 const exported=await json<{archive:{tables:Record<string,unknown[]>}}>('/api/operator/data/export');expect(exported.archive.tables.penny_feature_requests).toHaveLength(3);expect(exported.archive.tables.penny_features).toMatchObject([{id:feature.id,component_id:components[1].id}])
 const {schema}=await import('@/core/features/data/archive');expect((await schema(env.DB)).map(t=>t.name)).toEqual(expect.arrayContaining(['penny_products','penny_components','penny_features','penny_feature_requests','penny_feature_roadmap']))
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
