import type {ToolContext} from '../../../../base/modules/agent-door/types.ts'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'
import {context} from '../learning/authority'

/** A changed grant is new native authority, never a transfer of the old
 * sponsor's queued consent or pending approval to another operator. */
export async function learningCustody(db:D1Database,id:string,ctx:ToolContext){
 const current=await context(db,id)
 if(current.i.native_operator_id!==ctx.person.id)throw new ToolRefusal('learning_scope_changed')
 const saved=await db.prepare("SELECT principal FROM penny_agent_work WHERE kind='learning' AND id=?").bind(id).first<{principal:string}>()
 if(saved){const p=JSON.parse(saved.principal);if(p.person.id!==ctx.person.id||p.agent.id!==ctx.agent.id||(p.consent??null)!==(ctx.consent??null)||(p.clientId??null)!==(ctx.clientId??null)||!Array.isArray(p.scopes)||p.scopes.some((scope:string)=>!ctx.scopes.includes(scope)))throw new ToolRefusal('learning_scope_changed')}
 return current
}
