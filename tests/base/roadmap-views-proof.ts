import {expect} from 'vitest'
import {env} from 'cloudflare:workers'
import type {OperatorPage} from '../../src/core/features/workspace/list-query'
import type {SavedView} from '../../src/core/features/views/definition'
import {call} from './support'
export async function proveRoadmapViews(cookie:Record<string,string>,feature:string,component:string,product:string,owner:string){
 const json=async<T>(path:string,body?:unknown,method?:string,status=200):Promise<T>=>{const response=await call(path,body,cookie,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const stamp=new Date().toISOString(),ids=['01J00000000000000000000003','01J00000000000000000000004','01J00000000000000000000005']
 const publicBefore=await(await call('/api/public/roadmap')).json()
 for(const [index,id] of ids.entries()){
  await env.DB.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,owner_operator_id,target_window,created_at,updated_at) VALUES(?,?,?,'Customer workflow','planned',?,?,?,?)").bind(id,id,`synthetic-penny-roadmap-${index}`,index<2?owner:null,index===0?'2026-11':null,stamp,stamp).run()
  await json(`/api/operator/hierarchy/feature/${feature}/link`,{kind:'roadmap',targetId:id,linked:true},'PUT')
 }
 const plan=await json<{id:string}>('/api/operator/release-planning',{name:'synthetic-penny-release',releaseDate:'2026-12-14',itemIds:[ids[1]]},'POST',201)
 const filter={product,component,owner,q:'synthetic-penny-roadmap'},query=new URLSearchParams({...filter,sort:'name'}),page=await json<OperatorPage<{id:string}>>('/api/operator/roadmap?'+query)
 expect(page.items.map(row=>row.id)).toEqual(ids.slice(0,2));expect(page.releaseWindows).toContainEqual({itemId:ids[1],name:'synthetic-penny-release',releaseDate:'2026-12-14'})
 const definition={listKind:'roadmap',name:'synthetic-penny-roadmap-view',scope:'shared',filter,sort:'name',columns:['title','owner','targetWindow'],presentation:{layout:'timeline',grain:'quarter'}}
 const view=await json<{id:string}>('/api/operator/saved-views',definition,'POST',201)
 expect(await json<SavedView>('/api/operator/saved-views/'+view.id)).toMatchObject(definition)
 const saved=await json<OperatorPage<{id:string}>>('/api/operator/roadmap?view='+view.id)
 expect(saved.items).toEqual(page.items);expect(saved.releaseWindows).toEqual(page.releaseWindows)
 expect((await call('/api/operator/saved-views',{...definition,filter:{segment:'not-a-filter'}},cookie)).status).toBe(400)
 expect((await call('/api/operator/evidence?view='+view.id,undefined,cookie)).status).toBe(400)
 expect(await(await call('/api/public/roadmap')).json()).toEqual(publicBefore)
 void plan
}
