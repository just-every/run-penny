import type { PennyRuntime } from '@/core/app/runtime'
import { operatorAuth, operatorSession } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'
import { sessionGuard } from '../integrations/keys'
import { guardedDatabase } from '../integrations/guarded-database'

/** Current native authority is checked again inside every business transaction. */
export async function decisionDatabase(runtime:PennyRuntime,request:Request):Promise<D1Database>{
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
 const session=await (request.method==='GET'?operatorSession(runtime,request):operatorAuth(runtime).getSession(request))
 if(!session)throw new NativeError('unauthenticated',401)
 return guardedDatabase(runtime.database.binding,sessionGuard(session))
}
