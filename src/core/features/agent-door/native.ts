import type { PennyRuntime } from '@/core/app/runtime'
import type { ToolContext, ResourceContext } from '../../../../base/modules/agent-door/types.ts'
import { ToolRefusal } from '../../../../base/modules/agent-door/errors.ts'
import { guardedDatabase, type AuthorityGuard } from '../integrations/guarded-database'
import { readDatabase } from '../integrations/read-database'

export async function nativeContext(runtime:PennyRuntime,ctx:Pick<ToolContext,'person'>,readOnly:boolean,attribution?:ToolContext){
 const db=runtime.database.binding
 const row=await db.prepare(`SELECT o.version,b.actor_id AS actor FROM oa_operators o JOIN penny_operator_bindings b ON b.native_operator_id=o.id WHERE o.id=? AND o.status='active'`).bind(ctx.person.id).first<{version:number;actor:string}>()
 if(!row)throw new ToolRefusal('sponsor_inactive')
 const guard:AuthorityGuard={sql:`EXISTS(SELECT 1 FROM oa_operators o JOIN penny_operator_bindings b ON b.native_operator_id=o.id WHERE o.id=? AND o.status='active' AND o.version=? AND b.actor_id=?)${readOnly?'':" AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')"}`,params:[ctx.person.id,row.version,row.actor]}
 const safe=readOnly?readDatabase(db,guard):agentDatabase(db,guard,attribution)
 return {db:safe,database:{binding:safe},actor:row.actor,now:new Date().toISOString()}
}

/** Attribution and native authority are fenced in the service's own D1 batch. */
function agentDatabase(db:D1Database,guard:AuthorityGuard,ctx?:ToolContext):D1Database{
 if(!ctx)return guardedDatabase(db,guard)
 const wrappers=new WeakMap<object,D1PreparedStatement>()
 async function batch(input:D1PreparedStatement[]){
  const safe=guardedDatabase(db,guard)
  const rows=await safe.batch([
   db.prepare('INSERT INTO penny_agent_transaction(singleton,native_id,agent,label,approvers,consent,scopes,client_id) VALUES(1,?,?,?,?,?,?,?)').bind(ctx!.person.id,JSON.stringify(ctx!.actor),ctx!.actor.label,JSON.stringify(ctx!.approvers),ctx!.consent??null,JSON.stringify(ctx!.scopes),ctx!.clientId??null),
   ...input.map(s=>wrappers.get(s)??s),
   db.prepare('DELETE FROM penny_agent_transaction WHERE singleton=1'),
  ])
  return rows.slice(1,-1)
 }
 const wrap=(native:D1PreparedStatement):D1PreparedStatement=>{
  const view={bind:(...v:unknown[])=>wrap(native.bind(...v)),all:async()=> (await batch([native]))[0],run:async()=> (await batch([native]))[0],first:async(column?:string)=>{const row=(await batch([native]))[0]?.results[0]??null;return column&&row?(row as Record<string,unknown>)[column]:row},raw:async()=>{throw new ToolRefusal('unsupported_database_operation')}} as D1PreparedStatement
  wrappers.set(view,native);return view
 }
 return new Proxy(db,{get(target,key){if(key==='prepare')return(sql:string)=>wrap(target.prepare(sql));if(key==='batch')return batch;if(key==='exec'||key==='dump')return()=>{throw new ToolRefusal('unsupported_database_operation')};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}})
}
export const resourceContext=(runtime:PennyRuntime,ctx:ResourceContext)=>nativeContext(runtime,ctx,true)
