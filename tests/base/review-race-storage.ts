/** Instrument only the storage boundary; every query and transaction runs on real D1. */
export function observeD1(db:D1Database, hooks:{
 before?:(sql:readonly string[])=>Promise<void>
 after?:(sql:readonly string[],result:unknown)=>Promise<void>
}) {
 const statements=new WeakMap<D1PreparedStatement,{sql:string;statement:D1PreparedStatement}>()
 const wrap=(statement:D1PreparedStatement,sql:string):D1PreparedStatement=>{
  const proxy=new Proxy(statement,{get(target,key){
   if(key==='bind')return(...values:unknown[])=>wrap(target.bind(...values),sql)
   if(key==='first'||key==='all'||key==='run'||key==='raw')return async(...args:unknown[])=>{
    await hooks.before?.([sql])
    const result=await Reflect.apply(Reflect.get(target,key),target,args)
    await hooks.after?.([sql],result)
    return result
   }
   const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
  }})
  statements.set(proxy,{sql,statement});return proxy
 }
 return new Proxy(db,{get(target,key){
  if(key==='prepare')return(sql:string)=>wrap(target.prepare(sql),sql)
  if(key==='batch')return async(items:D1PreparedStatement[])=>{
   const actual=items.map(item=>statements.get(item)!)
   await hooks.before?.(actual.map(item=>item.sql))
   const result=await target.batch(actual.map(item=>item.statement))
   await hooks.after?.(actual.map(item=>item.sql),result)
   return result
  }
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
}
export function barrier(){
 let release!:()=>void
 const promise=new Promise<void>(resolve=>{release=resolve})
 return {promise,release}
}
