import {dataBatch,type DataAuthority} from '../authority'
type Options={
 /** 'direct' lets plain SELECTs (and batches of only them) through unfenced: a
  * stale reader changes nothing. */
 reads:'direct'|'fenced'
 /** Error prefix for anything else. `strict` refuses every other member; otherwise
  * members that execute no SQL pass through, and `exec` (unfenced SQL) is refused. */
 unsupported:string
 strict:boolean
 /** Each write also re-checks this operator's current authority. */
 authority?:DataAuthority
}
/** A database whose every write first proves `guard` in the same transaction.
 * The guard statement inserts a row that a CHECK constraint refuses when the
 * holder lost its claim, so the whole batch rolls back. */
export function fencedDatabase(db:D1Database,guard:(id:string)=>{insert:D1PreparedStatement;remove:D1PreparedStatement},options:Options):D1Database {
 const statements=new WeakMap<object,{statement:D1PreparedStatement;sql:string}>()
 async function batch(queries:D1PreparedStatement[]) {
  const known=queries.map(query=>statements.get(query))
  if(queries.length&&known.every(item=>item&&read(item.sql)))return db.batch(known.map(item=>item!.statement))
  const id=crypto.randomUUID(),{insert,remove}=guard(id)
  const result=await dataBatch(db,[insert,...queries.map(query=>statements.get(query)?.statement??query),remove],options.authority)
  return result.slice(1,-1)
 }
 const read=(sql:string)=>options.reads==='direct'&&/^\s*SELECT\b/i.test(sql)
 const other=(target:object,property:string|symbol,kind:string)=>{
  // Never a thenable: statements pass through Promise.all and awaited values.
  if(property==='then')return undefined
  if(options.strict||property==='exec'||property==='raw')throw new Error(options.unsupported+'_'+kind)
  const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value
 }
 function prepare(statement:D1PreparedStatement,sql:string):D1PreparedStatement {
  const wrapped=new Proxy(statement,{get(target,property){
   if(property==='bind')return (...values:unknown[])=>prepare(target.bind(...values),sql)
   if(property==='run'||property==='all')return async()=>read(sql)?target[property]():(await batch([target]))[0]
   if(property==='first')return async(column?:string)=>{
    if(read(sql))return column?target.first(column):target.first()
    const row=(await batch([target]))[0].results[0] as Record<string,unknown>|undefined
    return row?column?row[column]:row:null
   }
   if(property==='raw'&&read(sql))return target.raw.bind(target)
   return other(target,property,'statement')
  }})
  statements.set(wrapped,{statement,sql})
  return wrapped
 }
 return new Proxy(db,{get(target,property){
  if(property==='prepare')return (sql:string)=>prepare(db.prepare(sql),sql)
  if(property==='batch')return batch
  return other(target,property,'database')
 }}) as D1Database
}
