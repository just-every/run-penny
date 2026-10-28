import {safeProjection} from './projection'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { ToolDefinition, ToolContext, ClassAndFacts, ApprovalSummary, UndoContext } from '../../../../base/modules/agent-door/types.ts'
import { ToolRefusal } from '../../../../base/modules/agent-door/errors.ts'
import { nativeContext } from './native'
import { NativeError } from '../auth/native-tokens'
import { MutationError } from '@/core/app/operator-mutations'
import { RequestLifecycleError } from '../requests/lifecycle-types'

type Native=Awaited<ReturnType<typeof nativeContext>>
type Options<S extends z.ZodType>= {
 name:string;title:string;scope:string;clauses:string[];schema:S;readOnly?:boolean;classes?:ToolDefinition['classes'];
 run(args:z.output<S>,native:Native,ctx:ToolContext):Promise<unknown>;
 classify?(args:z.output<S>,native:Native,ctx:ToolContext):Promise<ClassAndFacts[]>;
 summary?(args:z.output<S>,native:Native,ctx:ToolContext):Promise<ApprovalSummary>;
 revision?(args:z.output<S>,native:Native):Promise<string|number|null>;
 undo?(saved:unknown,ctx:UndoContext):Promise<void>;
 authority?:ToolDefinition['authority'];output?:ToolDefinition['outputSchema'];untrusted?:boolean;
}
export function tool<S extends z.ZodType>(runtime:PennyRuntime,o:Options<S>):ToolDefinition{
 const parse=(args:Record<string,unknown>)=>{const p=o.schema.safeParse(args);if(!p.success)throw new ToolRefusal('invalid_arguments');return p.data}
 const definition:ToolDefinition={name:`penny.${o.name}`,title:o.title,description:o.title,scope:o.scope,readOnly:!!o.readOnly,
  inputSchema:doorSchema(z.toJSONSchema(o.schema,{io:'input',unrepresentable:'any'})) as ToolDefinition['inputSchema'],outputSchema:o.output??{type:['object','array']},
  classes:o.classes??['standard'],clauses:[...o.clauses,'SURFACE-001'],untrusted:o.untrusted??true,
  classify:async(args,ctx)=>o.classify?o.classify(parse(args),await nativeContext(runtime,ctx,true,undefined,o.scope),ctx):[{class:'standard',facts:{measure:1}}],
  async run(args,ctx){try{
   const value=await o.run(parse(args),await nativeContext(runtime,ctx,!!o.readOnly,o.readOnly?undefined:ctx,o.scope),ctx)
   const result=safeProjection(JSON.parse(JSON.stringify(value??{ok:true}))) as Record<string,unknown>;const links=await nativeLinks(runtime,o.name,args,result,ctx,o.scope);return {result,...(links.length?{resources:links}:{}),...(o.undo?{undo:result}:{})}
  }catch(error){if(error instanceof ToolRefusal)throw error;if(error instanceof NativeError||error instanceof RequestLifecycleError)throw new ToolRefusal(error.code);if(error instanceof MutationError)throw new ToolRefusal(error.status===404?'not_found':error.status===409?'native_conflict':'native_validation_failed',error.message);throw error}},
 }
 if(!o.readOnly)definition.summary=async(args,ctx)=>JSON.parse(JSON.stringify(o.summary?await o.summary(parse(args),await nativeContext(runtime,ctx,true,undefined,o.scope),ctx):{items:[o.title,JSON.stringify(parse(args))],target:{id:typeof args.id==='string'?args.id:typeof args.slug==='string'?args.slug:undefined}}))
 if(o.revision){definition.revisionType='string';definition.revision=async(args,ctx)=>o.revision!(parse(args),await nativeContext(runtime,ctx,true,undefined,o.scope))}
 if(o.undo)definition.undo=o.undo
 if(o.authority)definition.authority=o.authority
 return definition
}
export const id=z.string().trim().min(1).max(128),text=z.string().trim().min(1).max(20000),name=z.string().trim().min(1).max(280)
export const nullable=z.string().max(20000).nullable()
export const recordOutput={type:'object'} as const
export async function revision(db:D1Database,table:string,value:string,column='id'){
 const row=await db.prepare(`SELECT updated_at AS revision FROM ${table} WHERE ${column}=?`).bind(value).first<{revision:string}>()
 return row?.revision??null
}
export const external=(counterparty:'public'|'known'|'new'='public',measure=1):ClassAndFacts[]=>[{class:'external',facts:{counterparty,measure}}]

/** Base supports patternProperties; preserve Zod's nonempty record keys there. */
function doorSchema(value:unknown):unknown{
 if(Array.isArray(value))return value.map(doorSchema)
 if(!value||typeof value!=='object')return value
 const node=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,doorSchema(item)]))
 if(node.propertyNames){const names=node.propertyNames as {type?:string;minLength?:number};if(names.type!=='string'||names.minLength!==1)throw new Error('unsupported_native_record_keys');node.patternProperties={'^.{1,}$':node.additionalProperties};node.additionalProperties=false;delete node.propertyNames}
 return node
}

/** Link outcomes by current native record IDs, never by an imported URL. */
async function nativeLinks(runtime:PennyRuntime,name:string,args:Record<string,unknown>,result:Record<string,unknown>,ctx:ToolContext,scope:string){
 const table=name.startsWith('evidence.')?'evidence_items':name.startsWith('requests.')||name==='moderation.decide'?'requests':name.startsWith('decisions.')?'decisions':name.startsWith('releases.')||name==='outcomes.get'?'releases':null
 if(!table||!ctx.scopes.includes(table==='requests'?'requests:inspect':'feedback:read'))return []
 const db=(await nativeContext(runtime,ctx,true,undefined,scope)).db
 const candidate=typeof args.slug==='string'?await db.prepare(`SELECT id FROM ${table} WHERE slug=?`).bind(args.slug).first<{id:string}>():typeof result.id==='string'?{id:result.id}:typeof args.id==='string'?{id:args.id}:null
 if(!candidate||!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(candidate.id).first())return []
 const kind=table==='evidence_items'?'evidence':table==='requests'?'request':table==='decisions'?'decision':'release'
 return [{uri:`penny://${kind}/${encodeURIComponent(candidate.id)}`,name:kind}]
}
