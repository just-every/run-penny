import type {PennyRuntime} from '@/core/app/runtime'
import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository'
import {TokenService} from '../../../../base/modules/integrations/core/tokens'
import {NativeError} from '../auth/native-tokens'
import {apiAuthority,apiScopes} from '../integrations/keys'
export type ApiScope=typeof apiScopes[number]
/** Discovery also admits capture-only keys. Base owns the token/usage decision;
 * apiAuthority then checks current issuer, dev provenance and data maintenance. */
export async function mcpAuthority(runtime:PennyRuntime,request:Request,resource:string){
 const header=request.headers.get('Authorization')??''
 if(!/^Bearer int_[a-f0-9]{64}$/.test(header))throw new NativeError('integration_token_required',401)
 const service=new TokenService(new IntegrationsRepository(new D1SqlDatabase(runtime.database.binding),'penny-api'),{
  grant:async()=>{throw new NativeError('integration_namespace_denied',403)},administer:async()=>{throw new NativeError('integration_namespace_denied',403)},
 })
 const metadata=await service.authorize(header.slice(7),[],{requestId:crypto.randomUUID(),resource:`mcp/${resource}`})
 const scope=metadata?.scopes.find((value):value is ApiScope=>apiScopes.some(scope=>scope===value))
 if(!metadata||!scope)throw new NativeError('integration_token_denied',401)
 const authority=await apiAuthority(runtime,request,scope,`mcp/${resource}`)
 await authority.database.binding.prepare('SELECT 1 AS admitted').first()
 return {scopes:metadata.scopes,scope}
}
