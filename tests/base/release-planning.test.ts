import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,expect,inject,it} from 'vitest'
import {call,env,owner} from './support'
import type {Planning} from '@/core/features/planning/types'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0084'))})
it('[ROAD-011] dated release plans retain items and states; slipped dependencies flag transitive dependents and public promises privately with atomic admission',async()=>{
 const operator=await owner();expect((await call('/api/operator/loop/options',undefined,operator)).status).toBe(200)
 const actor=await env.DB.prepare('SELECT id FROM operators').first<string>('id'),now=new Date().toISOString()
 const ids=['01J00000000000000000000001','01J00000000000000000000002','01J00000000000000000000003']
 for(const [index,id] of ids.entries())await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,target_window,created_at,updated_at) VALUES(?,?,?,'Internal delivery context','planned',?,?,?)").bind(id,id,['Reporting data model','Scheduled reports','Finance launch'][index],index===0?'2000-Q1':'2099-12',now,now).run()
 await env.DB.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,approved_by_operator_id,approved_at,public_slug,created_at,updated_at) VALUES('planning-public',?,'Public finance launch','Approved wording',?,?,'finance-launch',?,?)").bind(ids[2],actor,now,now,now).run()
 const before=(await env.DB.prepare('SELECT * FROM roadmap_items ORDER BY id').all()).results
 await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0085'));await applyD1Migrations(env.DB,inject('migrations').filter(m=>m.name<'0085'))
 expect((await env.DB.prepare('SELECT * FROM roadmap_items ORDER BY id').all()).results).toEqual(before)
 await env.DB.prepare("UPDATE roadmap_publications SET public_eta='2099-Q4' WHERE id='planning-public'").run()
 const json=async<T>(path:string,body?:unknown,method?:string,status=200):Promise<T>=>{const response=await call(path,body,operator,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const read=()=>json<Planning>('/api/operator/release-planning')
 const plan=await json<{id:string}>('/api/operator/release-planning',{name:'Private finance launch plan',releaseDate:'2099-10-01',itemIds:ids},'POST',201)
 const edge=(blockerId:string,dependentId:string,linked=true)=>json('/api/operator/roadmap-dependency',{blockerId,dependentId,linked},'PUT')
 await edge(ids[0],ids[1]);await edge(ids[1],ids[2])
 let state=await read();expect(state.plans[0]).toMatchObject({id:plan.id,releaseDate:'2099-10-01',itemIds:ids,revision:1})
 expect(state.items.find(i=>i.id===ids[1])!.risks).toMatchObject([{id:ids[0],reason:'Blocker is past its delivery date'}])
 expect(state.items.find(i=>i.id===ids[2])!).toMatchObject({publicEta:'2099-Q4',risks:[{id:ids[0]}]})
 expect((await call('/api/operator/roadmap-dependency',{blockerId:ids[2],dependentId:ids[0],linked:true},operator,'PUT')).status).toBe(409)
 expect((await read())).toEqual(state)
 await json(`/api/operator/release-planning/${plan.id}`,{name:'Private finance launch plan',releaseDate:'2099-11-01',itemIds:ids.slice(1),revision:1},'PUT')
 expect((await call(`/api/operator/release-planning/${plan.id}`,{name:'Stale edit',releaseDate:'2099-01-01',itemIds:[],revision:1},operator,'PUT')).status).toBe(409)
 await env.DB.prepare("UPDATE roadmap_items SET status='shipped' WHERE id=?").bind(ids[0]).run();expect((await read()).items.every(i=>!i.risks.length)).toBe(true)
 await env.DB.prepare("UPDATE roadmap_items SET status='dropped' WHERE id=?").bind(ids[0]).run();expect((await read()).items.find(i=>i.id===ids[2])!.risks[0]).toMatchObject({id:ids[0],reason:'Blocker was dropped'})
 await edge(ids[0],ids[1],false);expect((await read()).items.every(i=>!i.risks.length)).toBe(true)
 // A later blocker window threatens the dependent and its separately approved ETA.
 await env.DB.prepare("UPDATE roadmap_items SET status='planned',target_window='2100-01' WHERE id=?").bind(ids[0]).run();await edge(ids[0],ids[2]);expect((await read()).items.find(i=>i.id===ids[2])!.risks[0].reason).toBe('Blocker is scheduled after this item')
 state=await read()
 await env.DB.exec("CREATE TRIGGER refuse_plan_audit BEFORE INSERT ON audit_entries WHEN NEW.entity_type='release_plan' BEGIN SELECT RAISE(ABORT,'refused'); END")
 try{expect((await call(`/api/operator/release-planning/${plan.id}`,{name:'Unrecorded',releaseDate:'2099-12-01',itemIds:[],revision:2},operator,'PUT')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER refuse_plan_audit')}
 expect(await read()).toEqual(state)
 expect((await call('/api/operator/release-planning')).status).toBe(401)
 expect((await call('/api/operator/release-planning',{name:'Foreign',releaseDate:'2099-12-01',itemIds:[]},{...operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 expect((await call('/api/operator/release-planning',{name:'Invalid date',releaseDate:'2099-02-31',itemIds:[]},operator)).status).toBe(400)
 const archive=await json<{archive:{tables:Record<string,unknown[]>}}>('/api/operator/data/export');expect(archive.archive.tables.penny_release_plans).toMatchObject([{id:plan.id}]);expect(archive.archive.tables.penny_roadmap_dependencies).toHaveLength(2)
 for(const path of ['/api/public/roadmap','/api/public/releases','/api/public/requests']){const text=await(await call(path)).text();for(const marker of ['Private finance launch plan','Blocker is','blockerId','risks','releaseDate'])expect(text).not.toContain(marker)}
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
