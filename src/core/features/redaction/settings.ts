import {z} from 'zod'
import {NativeError} from '../auth/native-tokens'
import {createUlid} from '@/core/shared/ulid'
import {compilePattern,defaultRules,kinds,redact,type Rules} from './engine'
export const rulesInput=z.object({enabled:z.boolean(),kinds:z.array(z.enum(kinds)).max(5),patterns:z.array(z.string().min(1).max(160)).max(10)}).strict()
export function validateRules(value:unknown):Rules{
 const result=rulesInput.safeParse(value)
 if(!result.success)throw new NativeError('redaction_rules_invalid',422,'Choose supported kinds and at most ten bounded custom patterns.')
 if(new Set(result.data.kinds).size!==result.data.kinds.length)throw new NativeError('redaction_rules_invalid',422)
 try{result.data.patterns.forEach(compilePattern)}catch(error){throw new NativeError('redaction_pattern_unsafe',422,error instanceof Error?error.message:'Unsafe pattern.')}
 return result.data
}
export async function redactionSettings(db:D1Database){
 const row=await db.prepare('SELECT enabled,kinds_json,patterns_json,revision FROM penny_redaction_settings WHERE singleton=1').first<{enabled:number;kinds_json:string;patterns_json:string;revision:number}>()
 if(!row)return {...defaultRules,revision:0}
 try{return {...validateRules({enabled:row.enabled===1,kinds:JSON.parse(row.kinds_json),patterns:JSON.parse(row.patterns_json)}),revision:row.revision}}catch{throw new NativeError('redaction_configuration_invalid',503)}
}
export async function redactCaptured<T extends Record<string,unknown>>(db:D1Database,input:T,fields:readonly string[]):Promise<{input:T;revision:number}>{
 const settings=await redactionSettings(db),result={...input}
 try{for(const field of fields)if(typeof input[field]==='string')(result as Record<string,unknown>)[field]=redact(input[field] as string,settings)}catch{throw new NativeError('redaction_limit',413,'This excerpt or custom pattern exceeds the redaction work limit; nothing was stored.')}
 return {input:result,revision:settings.revision}
}
export function redactionFence(db:D1Database,revision:number){
 const id=createUlid()
 return {before:db.prepare('INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN COALESCE((SELECT revision FROM penny_redaction_settings WHERE singleton=1),0)=? THEN 1 ELSE 0 END)').bind(id,revision),after:db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(id)}
}
