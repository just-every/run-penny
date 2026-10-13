import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,requester } from './support'
import { graph,runtime,rows,provider,start,time } from './notification-regression-fixture'
import { RequestWriteRepository } from '@/core/features/requests/write-repository'
import { unsubscribeUrl, globalMuteStatement } from '@/core/features/notifications/unsubscribe'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
const path=(url:string)=>{const u=new URL(url);return u.pathname+u.search}
it.each(['all','request'])('[NOTIFY-002] %s re-subscription fences old links even at an identical timestamp',async scope=>{
 const g=await graph(),target=scope==='all'?'all':g.requests[0].id,link=path(await unsubscribeUrl(runtime(),g.recipient,target))
 expect((await call(link,{})).status).toBe(200)
 const resume=()=>scope==='all'?globalMuteStatement(env.DB,g.recipient.requesterId,false,time()).run():new RequestWriteRepository(runtime().database).setFollowMute({requesterId:g.recipient.requesterId,verifiedEmail:g.recipient.email,displayName:'Requester'},g.requests[0].slug,false,time())
 await resume()
 expect((await call(link,{})).status).toBe(400)
 const fresh=path(await unsubscribeUrl(runtime(),g.recipient,target));expect((await call(fresh,{})).status).toBe(200)
 await resume();expect((await call(fresh,{})).status).toBe(400)
 expect(scope==='all'?(await rows('requester_notification_preferences'))[0].muted_at:(await rows('request_notification_mutes')).length).toBe(scope==='all'?null:0)
})
it('[BASE-SECRET-001 NOTIFY-002] URL address binding cannot confirm a guessed email without the secret',async()=>{
 const g=await graph(),token=new URL(await unsubscribeUrl(runtime(),g.recipient,'all')).searchParams.get('token')!
 const claims=JSON.parse(atob(token.split('.')[0].replaceAll('-','+').replaceAll('_','/')))
 const digest=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(g.recipient.email))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 expect(claims.emailHash).not.toBe(digest)
 expect((await call(path(await unsubscribeUrl(runtime(),g.recipient,'all')))).status).toBe(200)
})
it('[REQ-024 NOTIFY-002] multi-hop identity merges preserve old links and queued batches without replaying terminal mail',async()=>{
 const g=await graph();await g.publish(0,'Before merge');await prepareBatches(env.DB,time())
 const link=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[0].id))
 const ids=[g.recipient.requesterId]
 for(let n=0;n<2;n++){await requester();ids.push((await env.DB.prepare('SELECT id FROM requesters WHERE id NOT IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).first<{id:string}>())!.id)}
 const operator=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 const merge=new RequestOperatorRepository(runtime().database)
 await merge.mergeRequesters(ids[0],ids[1],operator.id,time(10));await merge.mergeRequesters(ids[1],ids[2],operator.id,time(20))
 expect((await call(link)).status).toBe(200)
 expect((await rows('notification_batches'))[0].requester_id).toBe(ids[2])
 expect((await rows('notification_intents'))[0].requester_id).toBe(ids[2])
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 expect((await call(link,{})).status).toBe(200)
 expect((await rows('request_notification_mutes'))[0].requester_id).toBe(ids[2])
 await drainNotifications(runtime(),()=>start+7200000);expect(sent).toHaveLength(1)
})
it('[BASE-PUBLIC-003] unknown non-API paths return a real accessible HTML 404 while APIs stay JSON',async()=>{
 const response=await call('/no-such-page');expect(response.status).toBe(404);expect(response.headers.get('Content-Type')).toContain('text/html')
 const body=await response.text();expect(body).toMatch(/<html[^>]+lang="en"/);expect(body).toMatch(/<title>[^<]+<\/title>/);expect(body).toContain('<main')
 const api=await call('/api/no-such-route');expect(api.status).toBe(404);expect(api.headers.get('Content-Type')).toContain('application/json')
})
it('[REQ-024 NOTIFY-005] identity collision retains terminal delivery and does not resend its event from the moved queue',async()=>{
 const g=await graph(),targetSession=await requester()
 const target=(await env.DB.prepare('SELECT id FROM requesters WHERE id!=?').bind(g.recipient.requesterId).first<{id:string}>())!
 expect((await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},targetSession)).status).toBe(204)
 await g.publish(0,'One event for two identities');await prepareBatches(env.DB,time())
 await env.DB.prepare('UPDATE notification_batches SET next_attempt_at=? WHERE requester_id=?').bind(time(7200000),g.recipient.requesterId).run()
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 const terminal=(await rows('notification_batches')).find(row=>row.requester_id===target.id)!
 const operator=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 await new RequestOperatorRepository(runtime().database).mergeRequesters(g.recipient.requesterId,target.id,operator.id,time(3700000))
 await drainNotifications(runtime(),()=>start+7200000)
 expect(sent).toHaveLength(1)
 expect((await rows('notification_batches')).find(row=>row.id===terminal.id)).toEqual(terminal)
 expect((await rows('notification_batches')).find(row=>row.id!==terminal.id)).toMatchObject({state:'suppressed'})
})
it('[NOTIFY-002 REQ-024] already mailed version-one links survive merge but expire on the survivor re-subscription',async()=>{
 const g=await graph(),encode=(data:Uint8Array)=>btoa(String.fromCharCode(...data)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(`penny-unsubscribe-v1:${runtime().configuration.authSecret}`),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 const claims={v:1,requesterId:g.recipient.requesterId,addressId:g.recipient.addressId,scope:'all',emailHash:encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(g.recipient.email))))}
 const payload=encode(new TextEncoder().encode(JSON.stringify(claims))),signature=encode(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))))
 const link='/api/public/notifications/unsubscribe?token='+payload+'.'+signature
 await requester();const target=(await env.DB.prepare('SELECT id FROM requesters WHERE id!=?').bind(g.recipient.requesterId).first<{id:string}>())!
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 await new RequestOperatorRepository(runtime().database).mergeRequesters(g.recipient.requesterId,target.id,actor.id,time())
 expect((await call(link,{})).status).toBe(200)
 await globalMuteStatement(env.DB,target.id,false,time()).run()
 expect((await call(link,{})).status).toBe(400)
})
