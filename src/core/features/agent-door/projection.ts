import {detect,redact} from '../redaction/engine'
import type {ClassAndFacts} from '../../../../base/modules/agent-door/types.ts'

/** Credential-looking source text is never an ordinary resource field. */
export function safeProjection(value:unknown):unknown {
 if(typeof value==='string')return redact(value,{enabled:true,kinds:['credential'],patterns:[]}).replace(/\bBearer\s+[A-Za-z0-9_.-]{16,}/gi,'Bearer [REDACTED:credential]').replace(/\b(?:gh[pousr]_|github_pat_|sk_(?:live|test)_|sk-(?:proj-)?|xox[baprs]-|int_)[A-Za-z0-9_-]{16,}/gi,'[REDACTED:credential]')
 if(Array.isArray(value))return value.map(safeProjection)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,safeProjection(v)]))
 return value
}
export function recordClasses(record:unknown):ClassAndFacts[]{
 const matches:ReturnType<typeof detect>=[]
 const walk=(value:unknown)=>{if(typeof value==='string')matches.push(...detect(value,{enabled:true,kinds:['ssn','card'],patterns:[]}));else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk)}
 walk(record)
 return [{class:'standard',facts:{measure:1}},...(matches.length?[{class:'sensitive' as const,facts:{measure:matches.length,kind:[...new Set(matches.map(m=>m.kind))].join(',')}}]:[])]
}
