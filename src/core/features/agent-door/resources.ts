import type { PennyRuntime } from '@/core/app/runtime'
import type { ResourceDefinition,ResourceContext } from '../../../../base/modules/agent-door/types.ts'
import { resourceContext } from './native'
import { requestContext } from '../requests/operator-context'
import { workspaceReadService } from '../workspace/service'
import { EvidenceReadRepository } from '../evidence/read-repository'
import { roadmapContexts } from '../roadmap/read-contexts'

/** All records use explicit native projections. No auth/provider tables are read. */
export function resources(runtime:PennyRuntime):ResourceDefinition[]{
 const definitions=[
  {kind:'request',scope:'requests:inspect',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>{const row=await n.db.prepare('SELECT slug,title,description FROM requests WHERE id=?').bind(id).first<{slug:string;title:string;description:string}>();return row?{...row,...await requestContext(n.database,row.slug)}:null}},
  {kind:'evidence',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>(await new EvidenceReadRepository(n.database).list(undefined,undefined,[id]))[0]??null},
  {kind:'decision',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>{const row=await n.db.prepare('SELECT slug FROM decisions WHERE id=?').bind(id).first<{slug:string}>();return row?workspaceReadService(n.database).findDecision(row.slug):null}},
  {kind:'roadmap-item',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>(await roadmapContexts(n.db,[id]))[id]??null},
  {kind:'release',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>{const row=await n.db.prepare('SELECT slug FROM releases WHERE id=?').bind(id).first<{slug:string}>();return row?workspaceReadService(n.database).findRelease(row.slug):null}},
  {kind:'account',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>{const row=await n.db.prepare('SELECT slug FROM accounts WHERE id=?').bind(id).first<{slug:string}>();return row?workspaceReadService(n.database).findAccount(row.slug):null}},
  {kind:'person',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>n.db.prepare('SELECT id,display_name AS name,blocked_at AS blockedAt FROM requesters WHERE id=?').bind(id).first()},
  {kind:'board',scope:'feedback:read',read:async(id:string,n:Awaited<ReturnType<typeof resourceContext>>)=>n.db.prepare('SELECT id,slug,name,visibility,archived_at AS archivedAt FROM boards WHERE id=?').bind(id).first()},
 ]
 return definitions.map(({kind,scope,read})=>({uriTemplate:`penny://${kind}/{id}`,name:kind,scope,classes:['standard'],
  classify:()=>[{class:'standard',facts:{measure:1}}],
  async read(uri:string,ctx:ResourceContext){
   const match=new RegExp(`^penny://${kind}/([^/?#]+)$`).exec(uri)
   if(!match||!ctx.scopes.includes(scope))return null
   try{const json=await read(decodeURIComponent(match[1]),await resourceContext(runtime,ctx,scope));return json?{json,untrusted:true}:null}catch{return null}
  },
 }))
}
