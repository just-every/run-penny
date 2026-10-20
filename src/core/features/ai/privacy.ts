import type {Capability} from './configuration'
import {privateLearningInput} from './learning-policy'
import {settings} from './configuration'
import {NativeError} from '../auth/native-tokens'
export interface PrivateValue {value:string;field:string}
/** Stored literals also protect copies in otherwise permitted free text. */
export async function privateValues(db:D1Database):Promise<PrivateValue[]>{
 const [accounts,notes]=await Promise.all([db.prepare('SELECT name,revenue_cents,renewal_date,health FROM accounts LIMIT 10001').all<{name:string;revenue_cents:number|null;renewal_date:string|null;health:string|null}>(),db.prepare('SELECT body FROM request_notes UNION ALL SELECT correction FROM learning_corrections LIMIT 10001').all<{body:string}>()])
 if(accounts.results.length>10000||notes.results.length>10000)throw new NativeError('ai_privacy_scope_limit',413,'AI cannot safely inspect all private context within this call. Manual work remains available.')
 return [...accounts.results.flatMap(a=>[{value:a.name,field:'Account name'},{value:a.renewal_date??'',field:'Renewal date'},{value:a.health??'',field:'Account health'},...(a.revenue_cents===null?[]:[{value:String(a.revenue_cents),field:'Revenue'},{value:(a.revenue_cents/100).toFixed(2),field:'Revenue'},{value:new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(a.revenue_cents/100),field:'Revenue'}])]),...notes.results.map(n=>({value:n.body,field:'Internal note'}))].filter(v=>v.value.length>0).sort((a,b)=>b.value.length-a.value.length)
}
/** Apply policy before serialization. This switch never grants read permission. */
export async function promptInput(db:D1Database,input:unknown,capability:Capability):Promise<unknown>{
 if((await settings(db)).include_private)return input
 const values=await privateValues(db)
 if(capability==='learning'){const policy=await privateLearningInput(db,input);input=policy.input;values.push(...policy.values)}
 return maskValues(input,values)
}
export function maskValues(input:unknown,values:PrivateValue[]):unknown{
 const hidden=/^(account([_]?Name|[_]?Id)?|commercial.*|revenue.*|mrr|arr|opportunity.*|health|internalNote.*|privateNote.*|notes|original)$/i
 function clean(value:unknown):unknown{
  if(typeof value==='string'){for(const {value:literal} of values)value=(value as string).replace(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[private context withheld]');return value}
  if(Array.isArray(value))return value.map(clean)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!hidden.test(key)).map(([key,item])=>[key,clean(item)]))
  return value
 }
 return clean(input)
}
