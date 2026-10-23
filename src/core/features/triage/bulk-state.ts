/** No wording or requester identity is copied into batch custody. */
export const requestBatchState=`json_object('updatedAt',r.updated_at,'owner',
 json(COALESCE((SELECT json_object('id',o.operator_id,'updatedAt',o.updated_at) FROM penny_request_owners o WHERE o.request_id=r.id),'null')),
 'tags',json((SELECT json_group_array(json_object('id',tag_id,'createdAt',created_at)) FROM
 (SELECT tag_id,created_at FROM request_tag_assignments a WHERE a.request_id=r.id ORDER BY tag_id))))`
export function batchAudit(db:D1Database,actor:string,id:string,action:string,details:string,now:string){
 return db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) VALUES(?,'operator',?,?, 'request_batch',?,?,?,?,?)").bind(crypto.randomUUID(),actor,action,id,details,now,now,now)
}
