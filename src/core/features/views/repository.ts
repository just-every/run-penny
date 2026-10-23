import {createUlid} from '@/core/shared/ulid'
import {NativeError} from '../auth/native-tokens'
import {isCustomFieldValue} from '../settings/custom-field-types'
import type {ListQuery} from '../workspace/list-query'
import {viewInput,invalidView,type SavedView,type ViewInput,type ViewKind} from './definition'

export interface ViewActor {id:string;role:string}
type Stored={id:string;list_kind:ViewKind;name:string;scope:'private'|'shared';creator_id:string|null;creator_name:string|null;filter_json:string;sort:string;columns_json:string;presentation_json:string;revision:number;created_at:string;updated_at:string}
const visible="(v.scope='shared' OR (v.creator_id=? AND v.restored_private=0))"
const selection='SELECT v.*,o.display_name AS creator_name FROM penny_saved_views v LEFT JOIN operators o ON o.id=v.creator_id'
const manage=(row:Stored,actor:ViewActor)=>row.creator_id===actor.id||row.scope==='shared'&&['owner','admin'].includes(actor.role)
async function decode(db:D1Database,row:Stored,actor:ViewActor):Promise<SavedView>{
 const parsed=viewInput.safeParse({listKind:row.list_kind,name:row.name,scope:row.scope,filter:JSON.parse(row.filter_json),sort:row.sort,columns:JSON.parse(row.columns_json),...(row.list_kind==='roadmap'?{presentation:JSON.parse(row.presentation_json)}:{})})
 if(!parsed.success)invalidView()
 const removedFilters=await validateReferences(db,parsed.data,false)
 return {...parsed.data,id:row.id,creatorId:row.creator_id,creatorName:row.creator_name??'Removed operator',canManage:manage(row,actor),revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,removedFilters}
}
export async function validateReferences(db:D1Database,input:{filter:ListQuery;listKind:ViewKind},saving:boolean):Promise<string[]>{
 const removed:string[]=[],filter=input.filter
 if(filter.tag){
  const tag=saving?await db.prepare('SELECT id FROM tags WHERE id=? OR name=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').bind(filter.tag,filter.tag,filter.tag).first<{id:string}>():await db.prepare('SELECT id FROM tags WHERE id=?').bind(filter.tag).first<{id:string}>()
  if(!tag){if(saving)invalidView();removed.push('Tag removed')}else if(saving)filter.tag=tag.id
 }
 if(filter.owner&&!await db.prepare("SELECT p.id FROM operators p JOIN oa_operators n ON n.email=p.email WHERE p.id=? AND n.status='active'").bind(filter.owner).first()){if(saving)invalidView();removed.push('Owner removed')}
 if(filter.customField){
  const field=await db.prepare('SELECT entity_type,field_type FROM custom_field_definitions WHERE id=?').bind(filter.customField).first<{entity_type:string;field_type:'text'|'number'|'boolean'|'date'}>()
  if(!field){if(saving)invalidView();removed.push('Custom field removed')}
  else {if(field.entity_type!==(input.listKind==='requests'?'request':'evidence'))invalidView();let value:unknown=filter.customValue;if(field.field_type==='number')value=filter.customValue?.trim()?Number(filter.customValue):NaN;if(field.field_type==='boolean')value=filter.customValue==='true'?true:filter.customValue==='false'?false:null;if(!isCustomFieldValue(field.field_type,value)||value===null)invalidView()}
 }
 return removed
}
export async function listViews(db:D1Database,kind:ViewKind,actor:ViewActor){
 const rows=await db.prepare(`${selection} WHERE v.list_kind=? AND ${visible} ORDER BY v.name,v.id`).bind(kind,actor.id).all<Stored>()
 return Promise.all(rows.results.map(row=>decode(db,row,actor)))
}
export async function readView(db:D1Database,id:string,actor:ViewActor):Promise<SavedView>{
 const row=await db.prepare(`${selection} WHERE v.id=? AND ${visible}`).bind(id,actor.id).first<Stored>()
 if(!row)throw new NativeError('saved_view_not_found',404)
 return decode(db,row,actor)
}
export async function saveView(db:D1Database,id:string|null,input:ViewInput,actor:ViewActor){
 if(id){
  const current=await readView(db,id,actor);if(!current.canManage)throw new NativeError('saved_view_creator_required',403);if(current.listKind!==input.listKind)invalidView();if(current.revision!==input.revision)throw new NativeError('saved_view_changed',409)
  // An unchanged stored id cannot silently resolve to another tag's name.
  if(input.filter.tag&&input.filter.tag===current.filter.tag&&(await validateReferences(db,input,false)).length)invalidView()
 }
 await validateReferences(db,input,true)
 const key=id??createUlid(),now=new Date().toISOString(),admin=Number(['owner','admin'].includes(actor.role))
 const permitted="id=? AND revision=? AND (creator_id=? OR (scope='shared' AND ?=1))"
 await db.batch([
  ...(id?[db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_saved_views WHERE ${permitted}) THEN 1 ELSE json('saved_view_changed') END`).bind(key,input.revision!,actor.id,admin)]:[]),
  id?db.prepare('UPDATE penny_saved_views SET name=?,scope=?,filter_json=?,sort=?,columns_json=?,presentation_json=?,revision=revision+1,updated_at=? WHERE id=?').bind(input.name,input.scope,JSON.stringify(input.filter),input.sort,JSON.stringify(input.columns),JSON.stringify(input.presentation??(input.listKind==='roadmap'?{layout:'board',grain:'month'}:{})),now,key):db.prepare('INSERT INTO penny_saved_views(id,list_kind,name,scope,creator_id,filter_json,sort,columns_json,presentation_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(key,input.listKind,input.name,input.scope,actor.id,JSON.stringify(input.filter),input.sort,JSON.stringify(input.columns),JSON.stringify(input.presentation??(input.listKind==='roadmap'?{layout:'board',grain:'month'}:{})),now,now),
  db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'saved_view.saved','saved_view',?,?,?,?)").bind(createUlid(),actor.id,key,now,now,now),
 ])
 return {id:key}
}
export async function deleteView(db:D1Database,id:string,actor:ViewActor,revision:number){
 const current=await readView(db,id,actor);if(!current.canManage)throw new NativeError('saved_view_creator_required',403)
 const now=new Date().toISOString()
 await db.batch([db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM penny_saved_views WHERE id=? AND revision=? AND (creator_id=? OR (scope='shared' AND ?=1))) THEN 1 ELSE json('saved_view_changed') END").bind(id,revision,actor.id,Number(['owner','admin'].includes(actor.role))),db.prepare('DELETE FROM penny_saved_views WHERE id=?').bind(id),db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'saved_view.deleted','saved_view',?,?,?,?)").bind(createUlid(),actor.id,id,now,now,now)])
}
