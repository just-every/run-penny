import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,vi,expect,inject,it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { env } from './support'
// @ts-expect-error The deployment controller is maintained plain ESM.
import { pennyPlan } from '../../scripts/deployment/plan.mjs'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it.each(['sendgrid','resend'] as const)('[REQ-023 BASE-ACCESS-003] %s is shared by operator and requester links with no other key',async provider=>{
 const bindings={...env,MAIL_PROVIDER:provider,SENDGRID_API_KEY:provider==='sendgrid'?'fixture-sendgrid':undefined,RESEND_API_KEY:provider==='resend'?'fixture-resend':undefined}
 const bodies:Record<string,unknown>[]=[]
 vi.spyOn(globalThis,'fetch').mockImplementation(async (url,init)=>{
  expect(String(url)).toBe(provider==='sendgrid'?'https://api.sendgrid.com/v3/mail/send':'https://api.resend.com/emails')
  expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer fixture-${provider}`)
  bodies.push(JSON.parse(String(init?.body)))
  return new Response(provider==='resend'?JSON.stringify({id:'provider-fixture-id'}):null,{status:provider==='resend'?200:202})
 })
 const app=createPennyApi(),request=(path:string,body:unknown)=>app.fetch(new Request('https://penny.test'+path,{method:'POST',headers:{Origin:'https://penny.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.40'},body:JSON.stringify(body)}),bindings)
 expect((await request('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'})).status).toBe(303)
 expect((await request('/api/auth/magic-link',{email:'owner@penny.invalid',returnTo:'/app'})).status).toBe(202)
 expect((await request('/api/public/identity/email',{email:'requester@example.test',displayName:'Requester'})).status).toBe(202)
 expect(bodies).toHaveLength(2)
 expect(JSON.stringify(bodies[0])).toContain('/auth/confirm')
 expect(JSON.stringify(bodies[1])).toContain('/portal/verify')
})
it('[NOTIFY-002] actual deploy plan selects exactly one provider secret and schedules every minute',()=>{
 const artifact={migrations:[]},options={origin:'https://rer-seedproof-penny.test.workers.dev',mailFrom:'Penny <no-reply@example.test>'}
 for(const provider of ['sendgrid','resend']){
  const plan=pennyPlan(artifact,{...options,mailProvider:provider})
  expect(plan.crons).toEqual(['* * * * *'])
  expect(plan.vars.MAIL_PROVIDER).toBe(provider)
  expect(plan.secrets.map((s:{binding:string})=>s.binding)).toEqual(['AUTH_SECRET','SETUP_TOKEN',provider==='sendgrid'?'SENDGRID_API_KEY':'RESEND_API_KEY'])
 }
 expect(()=>pennyPlan(artifact,{...options,mailProvider:'development'})).toThrow('MAIL_PROVIDER-must-be-sendgrid-or-resend')
})
