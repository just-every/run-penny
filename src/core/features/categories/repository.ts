import type { DatabaseConnection } from '@/core/platform/database'
import { createUlid } from '@/core/shared/ulid'
import { RequestLifecycleError } from '../requests/lifecycle-types'
import { validateCategory } from './category-policy'

export interface CategoryInput {name:string;parentId?:string|null;position?:number;archived?:boolean}
export class CategoriesRepository {
 private readonly database:DatabaseConnection
 private readonly operatorId:string
 constructor(database:DatabaseConnection,operatorId:string){this.database=database;this.operatorId=operatorId}
 private get db(){return this.database.binding}
 private audit(action:string,id:string,now:string){return this.db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?,'category',?,?,?,?)`).bind(createUlid(),this.operatorId,action,id,now,now,now)}
 async create(boardSlug:string,input:CategoryInput){
  const board=await this.db.prepare('SELECT id FROM boards WHERE slug=?').bind(boardSlug).first<{id:string}>()
  if(!board)throw new RequestLifecycleError(404,'board_not_found','The board does not exist.')
  await this.parent(board.id,input.parentId??null)
  const id=createUlid(),now=new Date().toISOString()
  await this.db.batch([
   this.db.prepare('INSERT INTO request_categories(id,board_id,parent_id,name,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,board.id,input.parentId??null,input.name,input.position??0,now,now),
   this.audit('category.created',id,now),
  ])
  return {id}
 }
 private async find(boardSlug:string,id:string){
  const row=await this.db.prepare(`SELECT c.* FROM request_categories c JOIN boards b ON b.id=c.board_id WHERE b.slug=? AND c.id=? AND c.merged_into_category_id IS NULL`).bind(boardSlug,id).first<{id:string;board_id:string;parent_id:string|null;archived_at:string|null}>()
  if(!row)throw new RequestLifecycleError(404,'category_not_found','The category does not exist.')
  return row
 }
 private async parent(boardId:string,parentId:string|null){
  if(!parentId)return
  const row=await this.db.prepare(`SELECT 1 FROM request_categories WHERE id=? AND board_id=? AND parent_id IS NULL AND archived_at IS NULL AND merged_into_category_id IS NULL`).bind(parentId,boardId).first()
  if(!row)throw new RequestLifecycleError(400,'invalid_category_parent','Subcategories need an active top-level category on this board.')
 }
 async update(boardSlug:string,id:string,input:Partial<CategoryInput>){
  const row=await this.find(boardSlug,id),now=new Date().toISOString()
  if(input.parentId!==undefined){
   if(input.parentId===id)throw new RequestLifecycleError(400,'invalid_category_parent','A category cannot contain itself.')
   await this.parent(row.board_id,input.parentId)
   if(input.parentId&&await this.db.prepare('SELECT 1 FROM request_categories WHERE parent_id=?').bind(id).first())throw new RequestLifecycleError(400,'category_depth_exceeded','Only one level of subcategories is allowed.')
  }
  await this.db.batch([
   this.db.prepare(`UPDATE request_categories SET name=COALESCE(?,name),position=COALESCE(?,position),parent_id=CASE WHEN ? THEN ? ELSE parent_id END,
    archived_at=CASE WHEN ? IS NULL THEN archived_at WHEN ? THEN ? ELSE NULL END,updated_at=? WHERE id=? AND merged_into_category_id IS NULL`).bind(input.name??null,input.position??null,input.parentId!==undefined?1:0,input.parentId??null,input.archived===undefined?null:1,input.archived?1:0,now,now,id),
   this.audit(input.archived?'category.archived':'category.updated',id,now),
  ])
 }
 async merge(boardSlug:string,id:string,targetId:string){
  if(id===targetId)throw new RequestLifecycleError(400,'invalid_category_merge','Choose a different target category.')
  const [source,target]=await Promise.all([this.find(boardSlug,id),this.find(boardSlug,targetId)])
  const children=await this.db.prepare('SELECT id FROM request_categories WHERE parent_id=?').bind(id).all<{id:string}>()
  if(target.archived_at||target.parent_id===id||(children.results.length&&target.parent_id))throw new RequestLifecycleError(400,'invalid_category_merge','A category with subcategories must merge into an active top-level category outside itself.')
  const now=new Date().toISOString()
  await this.db.batch([
   // Merging categories deliberately changes category assignments only. Request merges keep their canonical category.
   this.db.prepare('UPDATE requests SET category_id=?,updated_at=? WHERE category_id=? AND board_id=?').bind(targetId,now,id,source.board_id),
   this.db.prepare('UPDATE request_categories SET parent_id=?,updated_at=? WHERE parent_id=?').bind(targetId,now,id),
   this.db.prepare('UPDATE request_categories SET merged_into_category_id=?,updated_at=? WHERE merged_into_category_id=?').bind(targetId,now,id),
   this.db.prepare('UPDATE request_categories SET merged_into_category_id=?,archived_at=?,updated_at=? WHERE id=?').bind(targetId,now,now,id),
   this.audit('category.merged',id,now),
  ])
 }
 async setRequest(slug:string,categoryId:string|null){
  const row=await this.db.prepare('SELECT id,board_id,category_id FROM requests WHERE slug=?').bind(slug).first<{id:string;board_id:string;category_id:string|null}>()
  if(!row)throw new RequestLifecycleError(404,'not_found','The request does not exist.')
  if(categoryId===row.category_id)return
  await validateCategory(this.database,row.board_id,categoryId)
  const now=new Date().toISOString()
  const result=await this.db.batch([
   this.db.prepare(`UPDATE requests SET category_id=?,updated_at=? WHERE id=? AND board_id=? AND category_id IS ?
    AND (? IS NULL OR EXISTS(SELECT 1 FROM request_categories c LEFT JOIN request_categories p ON p.id=c.parent_id
    WHERE c.id=? AND c.board_id=? AND c.archived_at IS NULL AND c.merged_into_category_id IS NULL AND (p.id IS NULL OR p.archived_at IS NULL))) RETURNING 1`).bind(categoryId,now,row.id,row.board_id,row.category_id,categoryId,categoryId,row.board_id),
   this.db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'request.category_changed','request',?,?,?,? WHERE changes()>0`).bind(createUlid(),this.operatorId,row.id,now,now,now),
  ])
  if(result[0].results.length!==1)throw new RequestLifecycleError(409,'request_category_changed','The request or category changed. Refresh and try again.')
 }
}
