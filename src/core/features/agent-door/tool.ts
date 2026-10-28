import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import type { ToolDefinition, ToolContext, ClassAndFacts, ApprovalSummary } from '../../../../base/modules/agent-door/types.ts'
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
 authority?:ToolDefinition['authority'];output?:ToolDefinition['outputSchema'];untrusted?:boolean;
}
export function tool<S extends z.ZodType>(runtime:PennyRuntime,o:Options<S>):ToolDefinition{
 const parse=(args:Record<string,unknown>)=>{const p=o.schema.safeParse(args);if(!p.success)throw new ToolRefusal('invalid_arguments');return p.data}
 const definition:ToolDefinition={name:`penny.${o.name}`,title:o.title,description:o.title,scope:o.scope,readOnly:!!o.readOnly,
  inputSchema:z.toJSONSchema(o.schema,{io:'input',unrepresentable:'any'}) as ToolDefinition['inputSchema'],outputSchema:o.output??{type:['object','array']},
  classes:o.classes??['standard'],clauses:[...o.clauses,'SURFACE-001'],untrusted:o.untrusted??true,
  classify:async(args,ctx)=>o.classify?o.classify(parse(args),await nativeContext(runtime,ctx,true),ctx):[{class:'standard',facts:{measure:1}}],
  async run(args,ctx){try{
   const value=await o.run(parse(args),await nativeContext(runtime,ctx,!!o.readOnly,o.readOnly?undefined:ctx),ctx)
   return {result:value??{ok:true}}
  }catch(error){if(error instanceof ToolRefusal)throw error;if(error instanceof NativeError||error instanceof RequestLifecycleError)throw new ToolRefusal(error.code);if(error instanceof MutationError)throw new ToolRefusal(error.status===404?'not_found':error.status===409?'native_conflict':'native_validation_failed',error.message);throw error}},
 }
 if(!o.readOnly)definition.summary=async(args,ctx)=>o.summary?o.summary(parse(args),await nativeContext(runtime,ctx,true),ctx):{items:[o.title],target:{id:typeof args.id==='string'?args.id:typeof args.slug==='string'?args.slug:undefined}}
 if(o.revision){definition.revisionType='string';definition.revision=async(args,ctx)=>o.revision!(parse(args),await nativeContext(runtime,ctx,true))}
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
