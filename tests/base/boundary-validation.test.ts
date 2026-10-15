import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,expect,inject,it } from 'vitest'
import { call,env,owner } from './support'
import { createPennyApi } from '@/core/app/api'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})

async function snapshot(){
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name<>'penny_public_admission' ORDER BY name").all<{name:string}>()).results
 const rows:Record<string,unknown[]>={}
 for(const {name} of tables)rows[name]=(await env.DB.prepare(`SELECT * FROM "${name}"`).all()).results
 return rows
}

it('[BASE-INPUT-001] refuses a malformed path parameter on every API route with the standard 400 before any service runs',async()=>{
 const operator=await owner()
 const routes=[...new Map(createPennyApi().routes.filter(route=>route.path.startsWith('/api/')&&route.path.includes('/:')).map(route=>[route.method+' '+route.path,route])).values()]
 expect(routes.length).toBeGreaterThan(0)
 const before=await snapshot()
 for(const route of routes)for(const value of ['two%20words','%3Cscript%3E','x'.repeat(161),'%E0%A4%A'])
  for(const method of route.method==='ALL'?['GET','POST']:[route.method]){
   const path=route.path.replace(/:[A-Za-z]+/g,value)
   const response=await call(path,method==='GET'||method==='HEAD'?undefined:{},operator,method)
   expect(response.status,method+' '+path).toBe(400)
   expect(await response.json(),method+' '+path).toEqual({error:'validation_failed'})
  }
 expect(await snapshot()).toEqual(before)
},120000)
