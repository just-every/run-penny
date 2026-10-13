import type { PennyRuntime } from '@/core/app/runtime'
import { operatorAuth } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'

/** An import job names the operator row that created it. A restore carries the
 * jobs but never the installation's authority, and setup then claims a new
 * owner with a new operator id, so the jobs' creator no longer exists here.
 * Such a job is the installation owner's to read, open and undo; a job whose
 * creator still exists stays that operator's alone. */
export const RESTORED_JOB="NOT EXISTS(SELECT 1 FROM oa_operators creator WHERE creator.id=j.principal_id)"

export type ImportAuthority={operatorId:string;owner:boolean}

export async function importAuthority(runtime:PennyRuntime,request:Request):Promise<ImportAuthority> {
 const session=await operatorAuth(runtime).getSession(request)
 if(!session)throw new NativeError('unauthenticated',401)
 return {operatorId:session.operatorId,owner:session.operator.role==='owner'}
}

/** The creator id a restored job must be bound to when this operator acts on
 * it as the installation owner, or undefined when it is their own job or not
 * theirs to take (Base then refuses the binding as before). */
export async function restoredPrincipal(runtime:PennyRuntime,authority:ImportAuthority,principalId:string):Promise<string|undefined> {
 if(!authority.owner||principalId===authority.operatorId)return undefined
 const creator=await runtime.database.binding.prepare('SELECT 1 present FROM oa_operators WHERE id=?').bind(principalId).first()
 return creator?undefined:principalId
}
