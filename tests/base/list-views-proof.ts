import {expect} from 'vitest'
import {call,env} from './support'
import {good} from './ownership-fixture'
import type {SavedView,ViewInput} from '../../src/core/features/views/definition'
import type {OperatorPage} from '../../src/core/features/workspace/list-query'
export async function proveListViews(owner:{Cookie:string},peer:{Cookie:string}){
 const create=(input:ViewInput,cookie=owner)=>good<{id:string}>('/api/operator/saved-views',input,cookie,'POST',201)
 const path=(id:string)=>`/api/operator/saved-views/${id}`
 const requests=[]
 for(const name of ['synthetic-penny-2','synthetic-penny-1','Unrelated item'])requests.push(await good<{id:string;slug:string}>('/api/operator/requests',{title:name,description:'Private context',boardSlug:'regression'},owner,'POST',201))
 for(const name of ['synthetic-penny-2','synthetic-penny-1'])await good('/api/operator/evidence',{sourceType:'interview',wording:name,observedAt:new Date().toISOString()},owner,'POST',201)
 const definitions:ViewInput[]=[{listKind:'requests',name:'synthetic-penny-requests',scope:'shared',filter:{q:'synthetic-penny-'},sort:'name',columns:['title','status']},{listKind:'evidence',name:'synthetic-penny-evidence',scope:'shared',filter:{q:'synthetic-penny-'},sort:'name',columns:['wording','source']}]
 for(const definition of definitions){
  const shared=await create(definition),privateView=await create({...definition,name:definition.name+' private',scope:'private'})
  const listPath=definition.listKind==='requests'?'/api/operator/moderation':'/api/operator/evidence'
  const expected=await good<OperatorPage<{id:string}>>(listPath+'?q=synthetic-penny-&sort=name',undefined,owner)
  const own=await good<OperatorPage<{id:string}>>(listPath+'?view='+shared.id,undefined,owner),other=await good<OperatorPage<{id:string}>>(listPath+'?view='+shared.id,undefined,peer)
  expect(own.items.map(row=>row.id)).toEqual(expected.items.map(row=>row.id));expect(other.items).toEqual(own.items);expect(own.total).toBe(2)
  expect(own.savedView).toMatchObject({sort:'name',columns:definition.columns})
  expect((await call(path(privateView.id),undefined,peer)).status).toBe(404)
  expect((await call(listPath+'?view='+privateView.id,undefined,peer)).status).toBe(404)
  const visible=await good<SavedView[]>('/api/operator/saved-views?listKind='+definition.listKind,undefined,peer)
  expect(visible.some(view=>view.id===shared.id)).toBe(true);expect(visible.some(view=>view.id===privateView.id)).toBe(false)
  const current=await good<SavedView>(path(shared.id),undefined,owner)
  expect((await call(path(shared.id),{...definition,revision:current.revision},peer,'PUT')).status).toBe(403)
  expect((await call(path(shared.id),{revision:current.revision},peer,'DELETE')).status).toBe(403)
  await good(path(shared.id),{...definition,name:'Renamed shared view',revision:current.revision},owner,'PUT')
  expect((await call(path(shared.id),{...definition,revision:current.revision},owner,'PUT')).status).toBe(409)
 }
 const definition=definitions[0]
 for(const input of [{...definition,creatorId:'forged'},{...definition,filter:{foreignField:'unsafe'}},{...definition,columns:['title','email']},{...definition,sort:'observed'},{...definition,filter:{owner:'not-an-operator'}},{...definition,filter:{after:'2026-02-30'}}])expect((await call('/api/operator/saved-views',input,owner)).status).toBe(400)
 const field=await good<{id:string}>('/api/operator/settings/custom-fields',{entityType:'evidence',name:'synthetic-penny-field',fieldType:'number'},owner,'POST',201)
 expect((await call('/api/operator/saved-views',{...definition,filter:{customField:field.id,customValue:'2'}},owner)).status).toBe(400)
 const evidenceField=await create({...definitions[1],filter:{customField:field.id,customValue:'2'}})
 await env.DB.prepare('DELETE FROM custom_field_definitions WHERE id=?').bind(field.id).run()
 const removedField=await good<OperatorPage<unknown>>('/api/operator/evidence?view='+evidenceField.id,undefined,owner)
 expect(removedField.items).toEqual([]);expect(removedField.savedView?.removedFilters).toEqual(['Custom field removed'])
 const tag=await good<{id:string}>('/api/operator/catalog/tags',{name:'synthetic-penny-tag'},owner,'POST',201)
 await good(`/api/operator/catalog/requests/${requests[0].id}/tags/${tag.id}`,{},owner,'PUT')
 const tagged=await create({...definition,filter:{tag:'synthetic-penny-tag'}})
 expect((await good<SavedView>(path(tagged.id),undefined,owner)).filter.tag).toBe(tag.id)
 await good('/api/operator/catalog/tags/'+tag.id,{name:'Renamed tag'},owner,'PATCH')
 expect((await good<OperatorPage<{id:string}>>('/api/operator/moderation?view='+tagged.id,undefined,peer)).items.map(row=>row.id)).toEqual([requests[0].id])
 expect((await call('/api/operator/catalog/tags/'+tag.id,{},owner,'DELETE')).status).toBe(204)
 const replacement=await good<{id:string}>('/api/operator/catalog/tags',{name:tag.id},owner,'POST',201)
 await good(`/api/operator/catalog/requests/${requests[0].id}/tags/${replacement.id}`,{},owner,'PUT')
 const removed=await good<OperatorPage<unknown>>('/api/operator/moderation?view='+tagged.id,undefined,peer)
 expect(removed.items).toEqual([]);expect(removed.savedView?.removedFilters).toEqual(['Tag removed'])
 const removedDefinition=await good<SavedView>(path(tagged.id),undefined,owner)
 expect((await call(path(tagged.id),{...definition,filter:removedDefinition.filter,revision:removedDefinition.revision},owner,'PUT')).status).toBe(400)
 const foreignPrivate=await create({...definition,scope:'private',name:'synthetic-penny-peer-private'},peer)
 for(const [url,body] of [['/api/operator/data/export',undefined],['/api/portability/exports',{}]] as const){const response=await call(url,body,owner);expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'private_views_export_refused'})}
 expect((await call(path(foreignPrivate.id),undefined,owner)).status).toBe(404)
 await good(path(foreignPrivate.id),{revision:1},peer,'DELETE')
 const archived=await good<{archive:{tables:Record<string,unknown[]>}}>('/api/operator/data/export',undefined,owner)
 expect(archived.archive.tables.penny_saved_views.length).toBeGreaterThan(0)
 expect((await call('/api/operator/saved-views?listKind=requests')).status).toBe(401)
 expect((await call('/api/operator/saved-views',definition,{...owner,Origin:'https://other.test'})).status).toBe(403)
}
