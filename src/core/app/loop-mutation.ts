import type { Context } from 'hono'
import { MutationError,mutationFailure,requireOperator,type OperatorMutationEnvironment } from './operator-mutations'
export async function loopMutation(c:Context<OperatorMutationEnvironment>,action:(actor:string,now:string)=>Promise<Response>){
 const operator=await requireOperator(c)
 if(!operator)return c.json({authenticated:false},401)
 c.header('Cache-Control','no-store')
 if(!['GET','HEAD'].includes(c.req.method)&&await c.get('runtime').database.binding.prepare("SELECT singleton FROM data_state WHERE singleton=1 AND phase='locked'").first())return c.json({error:'data_maintenance_in_progress'},409)
 try{return await action(operator.id,new Date().toISOString())}catch(error){if(String(error).includes('Decision already committed'))return mutationFailure(c,new MutationError(409,'Decision already committed. Refresh the brief.'));return mutationFailure(c,error)}
}
