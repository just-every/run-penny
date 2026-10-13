import {operatorAuth} from '../auth/operator'
import {NativeError} from '../auth/native-tokens'
import type {PennyRuntime} from '@/core/app/runtime'
export async function editorOwner(runtime:PennyRuntime,request:Request):Promise<boolean> {
 if(!request.headers.get('Cookie'))return false
 const session=await operatorAuth(runtime).getSession(request)
 return session?.operator.role==='owner'
}
export async function requireEditorOwner(runtime:PennyRuntime,request:Request):Promise<void> {
 const session=request.headers.get('Cookie')?await operatorAuth(runtime).getSession(request):null
 if(!session)throw new NativeError('unauthenticated',401)
 if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==runtime.configuration.appOrigin)throw new NativeError('forbidden_origin',403)
}
