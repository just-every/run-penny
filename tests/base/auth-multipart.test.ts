import { applyD1Migrations,reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { operatorAuth } from '@/core/features/auth/operator'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it.each(['sendgrid','resend'] as const)('[BASE-ACCESS-003 OPS-002] %s serializes operator sign-in and invitation text and HTML',async provider=>{
 const bindings={...env,MAIL_PROVIDER:provider,SENDGRID_API_KEY:'synthetic-key',RESEND_API_KEY:'synthetic-key'}
 const bodies:{content:{type:string;value:string}[];text:string;html:string}[]=[]
 vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{
  expect(String(url)).toBe(provider==='sendgrid'?'https://api.sendgrid.com/v3/mail/send':'https://api.resend.com/emails')
  bodies.push(JSON.parse(String(options?.body)))
  return new Response(provider==='resend'?JSON.stringify({id:'fixture-message'}):null,{status:provider==='sendgrid'?202:200})
 })
 const app=createPennyApi(),origin='https://penny.test'
 const call=(path:string,body:unknown)=>app.fetch(new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.22'},body:JSON.stringify(body)}),bindings)
 const bootstrap=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})
 expect(bootstrap.status).toBe(303)
 expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
 const runtime=createPennyRuntime(bindings,{operatorAllowlist:['owner@penny.invalid','invitee@example.test'],workspaceTimezone:'UTC',publicOriginAllowlist:[origin]})
 await operatorAuth(runtime).invite(new Request(origin+'/auth/invite',{method:'POST',headers:{Origin:origin,Cookie:bootstrap.headers.get('set-cookie')!.split(';')[0],'CF-Connecting-IP':'192.0.2.22'}}),{email:'invitee@example.test',displayName:'Invitee'})
 expect(bodies).toHaveLength(2)
 for(const body of bodies){
  const parts=provider==='sendgrid'?Object.fromEntries(body.content.map((part:{type:string;value:string})=>[part.type,part.value])):{'text/plain':body.text,'text/html':body.html}
  expect(parts['text/plain']).toContain('Penny');expect(parts['text/plain']).toContain('/auth/confirm?token=')
  expect(parts['text/html']).toContain('Penny');expect(parts['text/html']).toContain('/auth/confirm?token=')
 }
})
