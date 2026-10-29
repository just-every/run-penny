import type {ApprovalSummary} from '../../../../base/modules/agent-door/types.ts'

const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())
/** Exact proposed fields stay readable on the person's approval page. */
export function proposedSummary(title:string,args:Record<string,unknown>):ApprovalSummary{
 const fields=(value:unknown,prefix:string):string[]=>{
  if(value===null)return [`${prefix}: clear`]
  if(Array.isArray(value))return value.length?value.flatMap((item,index)=>fields(item,`${prefix} ${index+1}`)):[`${prefix}: none`]
  if(value&&typeof value==='object')return Object.entries(value).flatMap(([key,item])=>fields(item,prefix?`${prefix} — ${label(key)}`:label(key)))
  return [`${prefix}: ${typeof value==='boolean'?(value?'yes':'no'):String(value)}`]
 }
 return {items:[title,...fields(args,'')],target:{id:typeof args.id==='string'?args.id:typeof args.slug==='string'?args.slug:undefined}}
}
