import {settings} from './configuration'
/** Source policy is applied before serialization, including copied private values
 * inside free text. This setting never grants a role additional read permission. */
export async function promptInput(db:D1Database,input:unknown):Promise<unknown>{
 if((await settings(db)).include_private)return input
 const values=(await db.prepare("SELECT name value FROM accounts UNION SELECT health FROM accounts WHERE health IS NOT NULL UNION SELECT CAST(revenue_cents AS TEXT) FROM accounts WHERE revenue_cents>0 UNION SELECT printf('%.2f',revenue_cents/100.0) FROM accounts WHERE revenue_cents>0 UNION SELECT body FROM request_notes").all<{value:string}>()).results.map(r=>r.value).filter(Boolean).sort((a,b)=>b.length-a.length)
 const hidden=/^(account(Name|Id)?|revenue.*|mrr|arr|opportunity.*|health|internalNote.*|privateNote.*|notes|original)$/i
 function clean(value:unknown):unknown{
  if(typeof value==='string'){for(const literal of values)value=(value as string).replace(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[private context withheld]');return value}
  if(Array.isArray(value))return value.map(clean)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!hidden.test(key)).map(([key,item])=>[key,clean(item)]))
  return value
 }
 return clean(input)
}
