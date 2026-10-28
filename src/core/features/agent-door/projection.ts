import {detect,redact} from '../redaction/engine'
import type {ClassAndFacts} from '../../../../base/modules/agent-door/types.ts'

/** Credential-looking source text is never an ordinary resource field. */
export function safeProjection(value:unknown):unknown {
 if(typeof value==='string')return redact(value,{enabled:true,kinds:['credential'],patterns:[]}).replace(/\bBearer\s+[A-Za-z0-9_.-]{16,}/gi,'Bearer [REDACTED:credential]')
 if(Array.isArray(value))return value.map(safeProjection)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,safeProjection(v)]))
 return value
}
export function recordClasses(record:unknown):ClassAndFacts[]{
 const text=JSON.stringify(record)??'',matches=detect(text.slice(0,200000),{enabled:true,kinds:['ssn','card'],patterns:[]})
 return [{class:'standard',facts:{measure:1}},...(matches.length?[{class:'sensitive' as const,facts:{measure:matches.length,kind:[...new Set(matches.map(m=>m.kind))].join(',')}}]:[])]
}
