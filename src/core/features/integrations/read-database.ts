import {NativeError} from '../auth/native-tokens'
import type {AuthorityGuard} from './guarded-database'

/** Read transactions check current authority without writing a mutation guard
 * or requiring idle data custody. The facade refuses every write door. */
export function readDatabase(db:D1Database,guard:AuthorityGuard):D1Database {
 const statements=new WeakMap<object,D1PreparedStatement>()
 const refused=()=>{throw new NativeError('operator_read_only',403)}
 async function batch(input:D1PreparedStatement[]) {
  const native=input.map(statement=>statements.get(statement)??refused())
  const [authority,...results]=await db.batch<Record<string,unknown>>([
   db.prepare(`SELECT (${guard.sql}) AS allowed`).bind(...guard.params),...native,
  ])
  if(!authority.results[0]?.allowed)throw new NativeError('integration_authority_changed',401)
  return results
 }
 function wrap(native:D1PreparedStatement):D1PreparedStatement {
  const statement={
   bind:(...values:unknown[])=>wrap(native.bind(...values)),
   all:async()=> (await batch([statement]))[0],
   first:async(column?:string)=>{const row=(await batch([statement]))[0]?.results[0]??null;return column&&row?row[column]:row},
   run:refused,raw:refused,
  } as D1PreparedStatement
  statements.set(statement,native);return statement
 }
 return new Proxy(db,{get(target,key){
  if(key==='prepare')return (sql:string)=>{
   // Ignore quoted values/identifiers and comments before checking SQL verbs.
   const tokens=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\//g,' ')
   if(!/^\s*(SELECT|WITH)\b/i.test(tokens)||/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|ATTACH|DETACH|VACUUM)\b/i.test(tokens))return refused()
   return wrap(target.prepare(sql))
  }
  if(key==='batch')return batch
  if(key==='exec'||key==='dump'||key==='withSession')return refused
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value
 }})
}
