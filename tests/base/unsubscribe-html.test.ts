import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, afterEach, expect, inject, it, vi } from 'vitest'
import { call, env } from './support'
import { unsubscribeUrl } from '@/core/features/notifications/unsubscribe'
import { graph, rows, runtime } from './notification-regression-fixture'
import { exports } from 'cloudflare:workers'
const endpoint='/api/public/notifications/unsubscribe'
const invalidCopy='This email preference link is invalid or expired.'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
async function html(response:Response,status:number){
 expect(response.status).toBe(status)
 expect(response.headers.get('Content-Type')).toContain('text/html')
 expect(response.headers.get('Cache-Control')).toBe('no-store')
 expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
 expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
 expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
 expect(response.headers.get('Content-Security-Policy')).toContain("form-action 'self'")
 const body=await response.text()
 expect(body).toContain('<main>');expect(body).toContain('width=device-width')
 expect(body).not.toContain('invalid_unsubscribe_link');expect(body).not.toContain('AUTH_SECRET');expect(body).not.toContain('data_maintenance');expect(body).not.toContain('D1_ERROR')
 return body
}
it('[NOTIFY-002] malformed, missing, tampered and stale preference links render safe native HTML without mutation',async()=>{
 const g=await graph(),link=await unsubscribeUrl(runtime(),g.recipient,'all'),valid=new URL(link)
 const old=await rows('request_follows')
 for(const token of ['', 'raw-private-token', '<script>alert(1)</script>', 'a.b', valid.searchParams.get('token')!.slice(0,-4)+'AAAA']){
  for(const method of ['GET','POST']){
   const body=await html(await call(`${endpoint}?token=${encodeURIComponent(token)}`,method==='POST'?{}:undefined,{},method),400)
   expect(body).toContain(invalidCopy)
   if(token)expect(body).not.toContain(token)
  }
 }
 await env.DB.prepare("UPDATE requester_addresses SET email='replaced@example.test' WHERE id=?").bind(g.recipient.addressId).run()
 for(const method of ['GET','POST'])expect(await html(await call(valid.pathname+valid.search,method==='POST'?{}:undefined,{},method),400)).toContain(invalidCopy)
 expect(await rows('requester_notification_preferences')).toHaveLength(0)
 expect(await rows('request_notification_mutes')).toHaveLength(0)
 expect(await rows('request_follows')).toEqual(old)
 const json=await call('/api/public/requester/notifications')
 expect(json.status).toBe(401);expect(json.headers.get('Content-Type')).toContain('application/json')
})
it('[NOTIFY-002] valid GET remains scanner-safe and repeated one-click POST renders responsive preference confirmation',async()=>{
 const g=await graph(),link=new URL(await unsubscribeUrl(runtime(),g.recipient,'all')),path=link.pathname+link.search
 expect(await html(await call(path),200)).toContain('<form method="post"')
 expect(await rows('requester_notification_preferences')).toHaveLength(0)
 for(let index=0;index<2;index++){
  const response=await exports.default.fetch(new Request(link,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}))
  expect(await html(response,200)).toContain('All requester email is muted.')
 }
 expect(await rows('requester_notification_preferences')).toHaveLength(1)
 expect(await rows('request_follows')).toHaveLength(1)
 expect((await call('/api/public/requester/activity',undefined,g.person)).status).toBe(200)
})
it('[NOTIFY-002 BASE-DATA-001] maintenance and D1 failure render truthful unavailable HTML rather than invalid-link copy',async()=>{
 const g=await graph(),link=new URL(await unsubscribeUrl(runtime(),g.recipient,'all')),path=link.pathname+link.search
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='preference-test' WHERE singleton=1").run()
 for(const method of ['GET','POST']){
  const body=await html(await call(path,method==='POST'?{}:undefined,{},method),503)
  expect(body).toContain('temporarily unavailable');expect(body).not.toContain(invalidCopy)
 }
 expect(await rows('requester_notification_preferences')).toHaveLength(0)
 await env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1").run()
 // Native D1 deliberately loses a required table, without mocking application code.
 await env.DB.exec('DROP TABLE data_state')
 for(const method of ['GET','POST']){
  const body=await html(await call(path,method==='POST'?{}:undefined,{},method),503)
  expect(body).toContain('temporarily unavailable');expect(body).not.toContain(invalidCopy)
 }
})
