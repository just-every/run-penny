import type { Context } from 'hono'
import { loopMutation } from '@/core/app/loop-mutation'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { integrationOperator } from '../integrations/destinations'
/** A native session is checked again inside every business transaction. */
export function evidenceMutation(c:Context<OperatorMutationEnvironment>,action:(actor:string,now:string,db:D1Database)=>Promise<Response>){
 return loopMutation(c,async(actor,now)=>{const {db}=await integrationOperator(c.get('runtime'),c.req.raw);return action(actor,now,db)})
}
