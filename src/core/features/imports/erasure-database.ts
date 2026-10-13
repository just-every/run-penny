import {requestContext,reserveReturn} from '../../../../base/modules/import-kit/src/d1/budget'
import type {D1ImportContext} from '../../../../base/modules/import-kit/src/d1/types'
import {dataBatch,type DataAuthority} from '../data/authority'
/** The runner claim owns one maintenance invocation. Base checks the exact
 * operation and current native authority before and after every transaction.
 * Reserve the bounded route admission/release tail and count phase changes. */
export async function withErasureDatabase<T>(context:D1ImportContext,operation:string,authority:DataAuthority|undefined,status:string,run:(context:D1ImportContext)=>Promise<T>):Promise<T> {
 const outer=reserveReturn(requestContext(context),48),counted=outer.storage.database
 const bounded=erasureOperationContext(outer,operation,status)
 await dataBatch(counted as unknown as D1Database,[counted.prepare("UPDATE data_state SET phase='applying' WHERE singleton=1 AND lock_id=? AND phase='locked' AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status=?) AND EXISTS(SELECT 1 FROM data_apply_claims WHERE operation_id=?)").bind(operation,operation,status,operation)] as D1PreparedStatement[],authority)
 try{return await run(bounded)}finally{
  // Releasing only this invocation's maintenance phase is safe even if its
  // authority was revoked. It never releases the installation operation lock.
  await counted.batch([counted.prepare("UPDATE data_state SET phase='locked' WHERE singleton=1 AND lock_id=? AND phase='applying' AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status=?)").bind(operation,operation,status)])
 }
}

export function erasureOperationContext(context:D1ImportContext,operation:string,status:string):D1ImportContext {
 const predicate=context.authorization.predicate
 return {...context,authorization:{...context.authorization,predicate(action:Parameters<typeof predicate>[0],destination:string){const current=predicate(action,destination);return {sql:`(${current.sql}) AND EXISTS(SELECT 1 FROM data_operations WHERE id=? AND status=?) AND EXISTS(SELECT 1 FROM data_apply_claims WHERE operation_id=?)`,params:[...current.params??[],operation,status,operation]}}}}
}
