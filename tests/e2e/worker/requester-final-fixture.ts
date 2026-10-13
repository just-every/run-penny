import { env } from './requester-board-fixture'
export * from './requester-repair-fixture'
export function pauseBeforeBatch(action:()=>Promise<void>):D1Database {
 let armed=true
 return new Proxy(env.DB,{get(target,key){
  if(key==='batch')return async(statements:D1PreparedStatement[])=>{if(armed){armed=false;await action()}return target.batch(statements)}
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
}
export function latch() {
 let release!:()=>void
 const promise=new Promise<void>(resolve=>{release=resolve})
 return {promise,release}
}
