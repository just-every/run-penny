import type { PennyRuntime } from '@/core/app/runtime'
import type { Principal } from '../../../../base/modules/agent-door/types.ts'
import { sha256 } from '../../../../base/modules/integrations/core/crypto.ts'
import { apiAuthority } from '../integrations/keys'

/** Legacy credentials retain only their exact native verbs and public reads. */
const scopes:Record<string,string[]>={
 'requests:read':['requests:public'], 'requests:write':['requests:create'],
 'comments:read':['comments:public'],'comments:write':['comments:write'],
 'status:read':['status:public'],'status:write':['status:write'],
 'releases:read':['releases:public'],'releases:write':['releases:write'],
 'votes:write':['votes:write'],
}
const project=(native:string[])=>[...new Set(native.flatMap(s=>scopes[s]??[]))]
export function localCredentials(runtime:PennyRuntime){return async(request:Request)=>{
 const header=request.headers.get('Authorization')??''
 if(!/^Bearer int_[a-f0-9]{64}$/.test(header))return null
 const token=header.slice(7),hash=await sha256(token)
 const row=await runtime.database.binding.prepare(`SELECT t.id,t.name,t.scopes,i.native_operator_id FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id WHERE t.namespace='penny-api' AND t.token_hash=?`).bind(hash).first<{id:string;name:string;scopes:string;native_operator_id:string}>()
 if(!row)return null
 const native=JSON.parse(row.scopes) as string[],first=native.find(s=>Object.hasOwn(scopes,s))
 if(!first)return null
 try{await apiAuthority(runtime,request,first as Parameters<typeof apiAuthority>[2],'agent-door')}catch{return null}
 return {sponsor:{id:row.native_operator_id},agent:{id:`penny-key:${row.id}`,name:row.name},clientId:row.id,scopes:project(native)}
}}
export function currentScopes(runtime:PennyRuntime){return async(principal:Principal)=>{
 if(!principal.clientId)return principal.scopes
 const row=await runtime.database.binding.prepare(`SELECT t.scopes FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id JOIN oa_operators o ON o.id=i.native_operator_id
 WHERE t.namespace='penny-api' AND t.id=? AND i.native_operator_id=? AND o.status='active' AND o.version=i.operator_version AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>unixepoch('subsec')*1000)`).bind(principal.clientId,principal.person.id).first<{scopes:string}>()
 return row?project(JSON.parse(row.scopes)):[]
}}
