import {NativeError} from '../auth/native-tokens'
import {activeOwner} from '../ownership/repository'
import {requestBatchState,batchAudit} from './bulk-state'
export interface BatchInput {requestIds:string[];tagId?:string;operatorId?:string|null}
interface Batch {id:string;selected:number;undone_at:string|null;held:number}
export async function createRequestBatch(db:D1Database,actor:string,input:BatchInput){
 const id=crypto.randomUUID(),guard=crypto.randomUUID(),now=new Date().toISOString(),ids=JSON.stringify(input.requestIds),ownerSet=Number(Object.hasOwn(input,'operatorId'))
 try{await db.batch([
  db.prepare(`INSERT INTO penny_ownership_guards(id,allowed) VALUES (?,
   (SELECT count(*) FROM requests WHERE id IN(SELECT value FROM json_each(?)))=?
   AND (? IS NULL OR EXISTS(SELECT 1 FROM tags WHERE id=?)) AND (?=0 OR ? IS NULL OR ${activeOwner}))`)
   .bind(guard,ids,input.requestIds.length,input.tagId??null,input.tagId??null,ownerSet,input.operatorId??null,input.operatorId??null),
  db.prepare('INSERT INTO penny_request_batches(id,actor_id,selected,created_at) VALUES(?,?,?,?)').bind(id,actor,input.requestIds.length,now),
  db.prepare(`INSERT INTO penny_request_batch_items(batch_id,request_id,before_json) SELECT ?,r.id,${requestBatchState} FROM requests r WHERE r.id IN(SELECT value FROM json_each(?))`).bind(id,ids),
  db.prepare(`INSERT INTO request_tag_assignments(request_id,tag_id,created_at) SELECT request_id,?,? FROM penny_request_batch_items WHERE batch_id=? AND ? IS NOT NULL ON CONFLICT(request_id,tag_id) DO NOTHING`).bind(input.tagId??null,now,id,input.tagId??null),
  db.prepare(`INSERT INTO penny_request_owners(request_id,operator_id,updated_at) SELECT request_id,?,? FROM penny_request_batch_items WHERE batch_id=? AND ?=1 ON CONFLICT(request_id) DO UPDATE SET operator_id=excluded.operator_id,updated_at=excluded.updated_at`).bind(input.operatorId??null,now,id,ownerSet),
  db.prepare(`UPDATE penny_request_batch_items AS i SET after_json=(SELECT ${requestBatchState} FROM requests r WHERE r.id=i.request_id) WHERE batch_id=?`).bind(id),
  batchAudit(db,actor,id,'triage.batch_applied',JSON.stringify({selected:input.requestIds.length,tagId:input.tagId??null,...(ownerSet?{operatorId:input.operatorId}: {})}),now),
  db.prepare('DELETE FROM penny_ownership_guards WHERE id=?').bind(guard),
 ])}catch(error){if(String(error).includes('penny_ownership_admitted'))throw new NativeError('batch_targets_changed',409);throw error}
 const [count,tag,owner]=await db.batch<{n?:number;name?:string}>([
  db.prepare('SELECT count(*) n FROM penny_request_batch_items WHERE batch_id=? AND before_json!=after_json').bind(id),
  db.prepare('SELECT name FROM tags WHERE id=?').bind(input.tagId??null),
  db.prepare('SELECT display_name name FROM operators WHERE id=?').bind(input.operatorId??null),
 ])
 return {id,selected:input.requestIds.length,changed:Number(count.results[0].n),tagName:tag.results[0]?.name??null,ownerName:ownerSet?(owner.results[0]?.name??'Unassigned'):null}
}
export async function undoRequestBatch(db:D1Database,actor:string,id:string){
 const batch=await db.prepare('SELECT id,selected,undone_at,held FROM penny_request_batches WHERE id=?').bind(id).first<Batch>()
 if(!batch)throw new NativeError('batch_not_found',404)
 if(batch.held)throw new NativeError('restored_batch_held',409)
 const summary=async()=>{const restored=Number(await db.prepare('SELECT count(*) n FROM penny_request_batch_items WHERE batch_id=? AND restored=1').bind(id).first('n'));return {id,restored,skipped:batch.selected-restored,undone:true as const}}
 if(batch.undone_at)return summary()
 const guard=crypto.randomUUID(),now=new Date().toISOString(),restored=`SELECT request_id FROM penny_request_batch_items WHERE batch_id=? AND restored=1`
 try{await db.batch([
  db.prepare("INSERT INTO penny_ownership_guards(id,allowed) VALUES (?,EXISTS(SELECT 1 FROM penny_request_batches WHERE id=? AND held=0 AND undone_at IS NULL))").bind(guard,id),
  db.prepare(`UPDATE penny_request_batch_items AS i SET restored=1 WHERE batch_id=? AND after_json=(SELECT ${requestBatchState} FROM requests r WHERE r.id=i.request_id)
   AND (json_extract(before_json,'$.owner.id') IS NULL OR EXISTS(SELECT 1 FROM operators p JOIN oa_operators n ON n.email=p.email WHERE p.id=json_extract(i.before_json,'$.owner.id') AND n.status='active'))`).bind(id),
  db.prepare(`DELETE FROM request_tag_assignments WHERE request_id IN(${restored})`).bind(id),
  db.prepare(`INSERT INTO request_tag_assignments(request_id,tag_id,created_at) SELECT i.request_id,json_extract(t.value,'$.id'),json_extract(t.value,'$.createdAt') FROM penny_request_batch_items i,json_each(i.before_json,'$.tags') t WHERE i.batch_id=? AND i.restored=1`).bind(id),
  db.prepare(`DELETE FROM penny_request_owners WHERE request_id IN(${restored})`).bind(id),
  db.prepare(`INSERT INTO penny_request_owners(request_id,operator_id,updated_at) SELECT request_id,json_extract(before_json,'$.owner.id'),json_extract(before_json,'$.owner.updatedAt') FROM penny_request_batch_items WHERE batch_id=? AND restored=1 AND json_type(before_json,'$.owner')='object'`).bind(id),
  db.prepare('UPDATE penny_request_batches SET undone_at=? WHERE id=? AND undone_at IS NULL').bind(now,id),
  batchAudit(db,actor,id,'triage.batch_undone','{}',now),
  db.prepare('DELETE FROM penny_ownership_guards WHERE id=?').bind(guard),
 ])}catch(error){
  if(String(error).includes('penny_ownership_admitted')){
   if(await db.prepare('SELECT undone_at FROM penny_request_batches WHERE id=? AND held=0').bind(id).first('undone_at'))return summary()
   throw new NativeError('batch_changed',409)
  }
  throw error
 }
 return summary()
}
