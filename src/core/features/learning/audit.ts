import {audit} from '../decisions/write-support'
import {createUlid} from '@/core/shared/ulid'

export type LearningActor={operatorId:string}|{system:'learning.scheduler'|'learning.run'|'learning.provider_revocation'}
type Entity='learning_investigation'|'learning_source'
/** Operator events use the same product actor and audit helper as decisions. */
export function learningAudit(db:D1Database,actor:LearningActor,entity:Entity,id:string,action:string,details:unknown=null){
 if('operatorId' in actor)return audit(db,actor.operatorId,entity,id,action,new Date().toISOString(),details)
 return systemLearningAudit(db,actor.system,entity,id,action,details)
}
/** Conditional system receipts follow the immediately preceding UPDATE in the
 * same batch, so a stale runner cannot claim it changed a removed/revoked scope. */
export function systemLearningAudit(db:D1Database,feature:Extract<LearningActor,{system:string}>['system'],entity:Entity,id:string,action:string,details:unknown=null,changedOnly=false){
 const now=new Date().toISOString()
 return db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) SELECT ?,'system',?,?,?,?,?,?,?,? ${changedOnly?'WHERE changes()>0':''}`).bind(createUlid(),feature,action,entity,id,details===null?null:JSON.stringify(details),now,now,now)
}
