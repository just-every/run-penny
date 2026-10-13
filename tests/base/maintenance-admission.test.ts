import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
const app=createPennyApi(),origin='https://penny.test'
const bindings=()=>({...env,PENNY_ENVIRONMENT:'production'})
function call(path:string,body?:unknown,cookie?:string){
 return app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.64',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings())
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it.each(['revoked','expired'])('[BASE-ACCESS-002 BASE-ACCESS-003 DATA-001] production owner regains Base admission during locked maintenance after a %s cookie',async state=>{
 let delivered=''
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{
  expect(String(url)).toBe('https://api.sendgrid.com/v3/mail/send')
  const message=JSON.parse(String(options?.body));delivered=message.content.find((part:{type:string})=>part.type==='text/plain').value
  return new Response(null,{status:202})
 })
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 expect(bootstrap.status).toBe(303)
 const oldCookie=bootstrap.headers.get('Set-Cookie')!.split(';')[0]
 await env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('interrupted-export','export','pending','{}','stamp','stamp')").run()
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='interrupted-export' WHERE singleton=1").run()
 const attribution=(await env.DB.prepare('SELECT * FROM operators').all()).results
 if(state==='revoked'){
  expect((await call('/api/auth/sign-out',{},oldCookie)).status).toBe(204)
  expect(await env.DB.prepare('SELECT revoked_at FROM oa_sessions').first('revoked_at')).not.toBeNull()
 }else await env.DB.prepare('UPDATE oa_sessions SET expires_at=1').run()
 expect((await call('/api/operator/data/overview',undefined,oldCookie)).status).toBe(401)
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
 const token=new URL(delivered.match(/https:\/\/[^\s]+/)![0]).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token})
 expect(confirmed.status).toBe(303)
 const freshCookie=confirmed.headers.get('Set-Cookie')!.split(';')[0]
 expect((await call('/auth/session',undefined,freshCookie)).status).toBe(200)
 // Fresh native authority can inspect hosted maintenance; ordinary writes stay
 // fenced and recovery still requires same-origin admission and confirmation.
 const data=await call('/api/operator/data/overview',undefined,freshCookie)
 expect(data.status).toBe(200)
 expect(await data.json()).toMatchObject({hosted:true,operation:{id:'interrupted-export',kind:'export',status:'pending'}})
 const operation=await call('/api/operator/data/operations/interrupted-export',undefined,freshCookie)
 expect(operation.status).toBe(200)
 expect(await operation.json()).toEqual({operationId:'interrupted-export',kind:'export',status:'pending'})
 expect((await call('/api/operator/boards',{name:'Held board',slug:'held-board',visibility:'internal'},freshCookie)).status).toBe(503)
 expect(await env.DB.prepare("SELECT count(*) n FROM boards WHERE slug='held-board'").first('n')).toBe(0)
 const recoveryPath='/api/operator/data/operations/interrupted-export/abort-export'
 expect((await call(recoveryPath,{},freshCookie)).status).toBe(400)
 const foreignRecovery=await app.fetch(new Request(origin+recoveryPath,{method:'POST',headers:{Origin:'https://foreign.test',Cookie:freshCookie,'Content-Type':'application/json'},body:JSON.stringify({confirmPriorRunnerStopped:true})}),bindings())
 expect(foreignRecovery.status).toBe(403)
 expect((await call(recoveryPath,{confirmPriorRunnerStopped:true},oldCookie)).status).toBe(401)
 expect((await env.DB.prepare('SELECT * FROM operators').all()).results).toEqual(attribution)
 expect(await env.DB.prepare('SELECT phase FROM data_state').first('phase')).toBe('locked')
 expect((await call('/api/auth/sign-out',{},freshCookie)).status).toBe(204)
 expect((await call(recoveryPath,{confirmPriorRunnerStopped:true},freshCookie)).status).toBe(401)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'locked',lock_id:'interrupted-export'})
 expect((await call('/api/operator/data/overview',undefined,oldCookie)).status).toBe(401)
})
