/** Import history commits its native writes and a transaction-local effect fence
 * together. No imported publication can enter the live delivery queue. */
export function withoutLiveEffects(db:D1Database):D1Database {
 return new Proxy(db,{get(target,key){
  if(key==='batch')return async(statements:D1PreparedStatement[])=>{
   const result=await target.batch([target.prepare('INSERT INTO penny_effect_suppression(singleton) VALUES(1)'),...statements,target.prepare('DELETE FROM penny_effect_suppression WHERE singleton=1')])
   return result.slice(1,-1)
  }
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
}
