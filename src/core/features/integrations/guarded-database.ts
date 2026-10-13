import {NativeError} from '../auth/native-tokens'
export interface AuthorityGuard {sql:string;params:(string|number|null)[]}

/** The same D1 transaction checks current authority before every service batch.
 * Native product services keep their validation and publication transactions. */
export function guardedDatabase(db:D1Database,guard:AuthorityGuard,extra:()=>D1PreparedStatement[]=()=>[]):D1Database {
 const statements=new WeakMap<object,D1PreparedStatement>()
 async function batch(input:D1PreparedStatement[]) {
  const id=crypto.randomUUID(),prefix=extra()
  try{
   const result=await db.batch([
    db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES (?,(${guard.sql}))`).bind(id,...guard.params),
    ...prefix,...input.map(statement=>statements.get(statement)??statement),
    db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(id),
   ])
   return result.slice(1+prefix.length,-1)
  }catch(error){
   if(error instanceof Error&&error.message.includes('penny_integration_authority'))throw new NativeError('integration_authority_changed',401)
   throw error
  }
 }
 function wrap(native:D1PreparedStatement):D1PreparedStatement {
  const result={
   bind:(...values:unknown[])=>wrap(native.bind(...values)),
   all:async()=> (await batch([native]))[0],
   run:async()=> (await batch([native]))[0],
   first:async(column?:string)=>{const row=(await batch([native]))[0]?.results[0]??null;return column&&row?(row as Record<string,unknown>)[column]:row},
   raw:async()=>{throw new NativeError('integration_operation_unavailable',403)},
  } as D1PreparedStatement
  statements.set(result,native);return result
 }
 return new Proxy(db,{get(target,key){if(key==='prepare')return (sql:string)=>wrap(target.prepare(sql));if(key==='batch')return batch;if(key==='exec'||key==='dump')return ()=>{throw new NativeError('integration_operation_unavailable',403)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
}
