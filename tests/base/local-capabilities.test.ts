import { applyD1Migrations, reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach, expect, inject, it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { authMail } from '@/core/features/auth/mail'
const app=createPennyApi()
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
it('[BASE-ACCESS-001 REQ-023] deployed modes refuse development capture and report absent mail',async()=>{
 for(const mode of ['preview','production']){
 const deployed={...env,PENNY_ENVIRONMENT:mode,MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined}
 const rt=createPennyRuntime(deployed)
 const forced={...rt,configuration:{...rt.configuration,mailProvider:'development'}}
 expect(authMail(forced)).toBeUndefined()
 for(const path of ['/__dev/outbox','/__dev/outbox?message=anything']) expect((await app.fetch(new Request('https://penny.test'+path),deployed)).status).toBe(404)
 expect(()=>createPennyRuntime({...deployed,MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test'})).toThrow('MAIL_PROVIDER')
 expect(await env.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first('n')).toBe(0)
 const capabilities=await app.fetch(new Request('https://penny.test/api/auth/capabilities'),deployed);expect(capabilities.status).toBe(200);expect(await capabilities.json()).toMatchObject({transport:'unavailable'})
 }
})

it('[BASE-ACCESS-001 BASE-SECRET-002] existing operator authority remains usable without a mail provider',async()=>{
 const bindings={...env,PENNY_ENVIRONMENT:'production',MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined}
 const bootstrap=await app.fetch(new Request('https://penny.test/auth/bootstrap',{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.27'},body:JSON.stringify({token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})}),bindings)
 expect(bootstrap.status).toBe(303)
 const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0]
 const session=await app.fetch(new Request('https://penny.test/api/auth/session',{headers:{Cookie:cookie}}),bindings)
 expect(session.status).toBe(200);expect(await session.json()).toMatchObject({authenticated:true})
 expect((await app.fetch(new Request('https://penny.test/api/operator/moderation',{headers:{Cookie:cookie}}),bindings)).status).toBe(200)
})
