import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,name} from './tool'
import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database.ts'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository.ts'
import {TokenService} from '../../../../base/modules/integrations/core/tokens.ts'
import {guardedDatabase} from '../integrations/guarded-database'
import {apiScopes} from '../integrations/keys'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'

/** The same Base token service and native issuance trigger as the person UI. */
function service(db:D1Database,nativeId:string,version:number,actor:string,issuing:boolean,dev:boolean){
 const guard={sql:"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?) AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')",params:[nativeId,version]}
 const connection=guardedDatabase(db,guard,()=>issuing?[db.prepare('INSERT INTO penny_api_issuance(singleton,native_operator_id,operator_version,actor_id,dev) VALUES(1,?,?,?,?)').bind(nativeId,version,actor,Number(dev))]:[])
 const sql=new D1SqlDatabase(connection)
 const storage={batch:async(input:Parameters<typeof sql.batch>[0])=>{
  const result=await sql.batch(issuing?[...input,{sql:'DELETE FROM penny_api_issuance WHERE singleton=1'}]:input)
  return issuing?result.slice(0,-1):result
 }}
 return new TokenService(new IntegrationsRepository(storage,'penny-api'),{grant:async()=>({scopes:apiScopes,commitGuard:{sql:`SELECT 1 WHERE ${guard.sql}`,params:guard.params}}),administer:async()=>{if(!await db.prepare(`SELECT 1 WHERE ${guard.sql}`).bind(...guard.params).first())throw new ToolRefusal('sponsor_inactive')}})
}
export function keyTools(runtime:PennyRuntime){
 const issue=tool(runtime,{name:'keys.issue',title:'Issue one scoped native API credential',scope:'access:write',clauses:['API-001','API-002'],classes:['access','security'],schema:z.object({name,scopes:z.array(z.enum(apiScopes)).min(1),expiresAt:z.number().int().optional()}),
 // Issuance creates a new client; no existing native person/client is its subject.
 authority:async()=>null,classify:async()=>[{class:'access',facts:{measure:1,direction:'widens'}},{class:'security',facts:{measure:1,setting:'api_credentials'}}],summary:async(a)=>({items:[a.name,...a.scopes]}),run:async(a,n,c)=>{const row=await n.db.prepare('SELECT version FROM oa_operators WHERE id=?').bind(c.person.id).first<{version:number}>();const result=await service(n.db,c.person.id,row!.version,n.actor,true,runtime.configuration.environment==='local').issue(null,a);return result}})
 const revoke=tool(runtime,{name:'keys.revoke',title:'Revoke a native API key without granting authority',scope:'access:write',clauses:['API-002'],classes:['access','security'],schema:z.object({id}).strict(),authority:async(a,_c)=>{const row=await runtime.database.binding.prepare('SELECT native_operator_id FROM penny_api_issuers WHERE token_id=?').bind(a.id).first<{native_operator_id:string}>();return row?{subject:row.native_operator_id,widens:false}:null},classify:async()=>[{class:'access',facts:{measure:1,direction:'narrows'}},{class:'security',facts:{measure:1,setting:'api_credentials'}}],run:async(a,n,c)=>{const row=await n.db.prepare('SELECT version FROM oa_operators WHERE id=?').bind(c.person.id).first<{version:number}>();await service(n.db,c.person.id,row!.version,n.actor,false,false).revoke(null,a.id);return {id:a.id,revoked:true}}})
 revoke.widens=false;revoke.narrowing={effect:'revoke',target:'id'}
 return [issue,revoke,tool(runtime,{name:'keys.grants',title:'Read effective native API grants without a bearer value',scope:'access:read',readOnly:true,clauses:['API-001','API-002'],schema:z.object({id}),run:async(a,n)=>{const row=await n.db.prepare("SELECT scopes FROM integration_tokens WHERE namespace='penny-api' AND id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>unixepoch('subsec')*1000)").bind(a.id).first<{scopes:string}>();return {id:a.id,grants:row?JSON.parse(row.scopes):[]}}})]
}
