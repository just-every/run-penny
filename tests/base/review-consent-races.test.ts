import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env } from './support'
import { graph,runtime,rows,provider,start,time } from './notification-regression-fixture'
import { observeD1 } from './review-race-storage'
import { RequestWriteRepository } from '@/core/features/requests/write-repository'
import { RequestMergeRepository } from '@/core/features/requests/merge-repository'
import { unsubscribeUrl,globalMuteStatement } from '@/core/features/notifications/unsubscribe'
import { drainNotifications } from '@/core/features/notifications/delivery'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
const path=(url:string)=>{const u=new URL(url);return u.pathname+u.search}

it('[NOTIFY-002 REQ-009] a canonical merge between discovery and resubscription commit fences every current origin link',async()=>{
 const g=await graph(2),identity={...g.recipient,verifiedEmail:g.recipient.email,displayName:'Requester'}
 const old=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[1].id))
 expect((await call(old,{})).status).toBe(200)
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 const merge=new RequestMergeRepository(runtime().database)
 let merged=false
 const db=observeD1(env.DB,{before:async sql=>{
  if(!merged&&sql.some(s=>s.includes('UPDATE request_follow_contributions SET muted_at='))){
   merged=true;await merge.merge(g.requests[1].slug,g.requests[0].slug,actor.id,time())
  }
 }})
 await new RequestWriteRepository({binding:db}).setFollowMute(identity,g.requests[0].slug,false,time())
 expect(merged).toBe(true)
 expect(await rows('request_notification_mutes')).toHaveLength(0)
 expect((await call(old,{})).status).toBe(400)
 expect(await rows('request_notification_mutes')).toHaveLength(0)
 await merge.unmerge(g.requests[1].slug,actor.id,time())
 expect((await call(old,{})).status).toBe(400)
 const fresh=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[1].id))
 expect((await call(fresh,{})).status).toBe(200)
 expect((await rows('request_notification_mutes')).map(row=>row.request_id)).toEqual([g.requests[1].id])
})

it.each(['follow','vote'] as const)('[NOTIFY-002 REQ-010] renewed %s consent at the identical timestamp invalidates previous request links and retains permission history',async action=>{
 const g=await graph(),repository=new RequestWriteRepository(runtime().database)
 const identity={...g.recipient,verifiedEmail:g.recipient.email,displayName:'Requester'},slug=g.requests[0].slug
 await repository.unfollow(identity,slug)
 const resume=()=>action==='follow'?repository.follow(identity,slug,time()):repository.vote(identity,slug,true,time())
 await resume()
 const old=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[0].id))
 const permissions=await rows('requester_update_permissions')
 await repository.unfollow(identity,slug);await resume()
 expect((await call(old,{})).status).toBe(400)
 expect(await rows('request_notification_mutes')).toHaveLength(0)
 const current=await rows('requester_update_permissions')
 expect(current.filter(row=>row.revoked_at===null)).toHaveLength(1)
 for(const permission of permissions)expect(current.find(row=>row.id===permission.id)?.revoked_at).not.toBeNull()
 expect(current.find(row=>row.revoked_at===null)).toMatchObject({source:action,granted_at:time()})
 const fresh=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[0].id))
 expect((await call(fresh,{})).status).toBe(200)
})

it('[NOTIFY-002 REL-011] global mute immediately before durable recipient admission prevents the provider HTTP call',async()=>{
 const g=await graph();await g.publish(0,'Revoked at final storage boundary')
 let revoked=false
 const db=observeD1(env.DB,{before:async sql=>{
  if(!revoked&&sql.some(s=>/UPDATE notification_attempts SET recipient_email/.test(s))){
   revoked=true;await globalMuteStatement(env.DB,g.recipient.requesterId,true,time()).run()
  }
 }})
 const sent=provider(),r=runtime()
 await drainNotifications({...r,database:{binding:db}},()=>start+3600000)
 expect(revoked).toBe(true);expect(sent).toHaveLength(0)
 expect((await rows('notification_batches'))[0]).toMatchObject({state:'suppressed'})
 expect((await rows('notification_attempts'))[0]).toMatchObject({state:'suppressed',recipient_email:null,recipient_verification_epoch:null})
})

it('[NOTIFY-002 REQ-010] resuming a muted follow fences old links without replacing its retained permission',async()=>{
 const g=await graph(),repository=new RequestWriteRepository(runtime().database)
 const identity={...g.recipient,verifiedEmail:g.recipient.email,displayName:'Requester'},slug=g.requests[0].slug
 const old=path(await unsubscribeUrl(runtime(),g.recipient,g.requests[0].id)),permissions=await rows('requester_update_permissions')
 await repository.setFollowMute(identity,slug,true,time())
 await repository.follow(identity,slug,time())
 expect(await rows('requester_update_permissions')).toEqual(permissions)
 expect((await call(old,{})).status).toBe(400)
 expect(await rows('request_notification_mutes')).toHaveLength(0)
 expect((await rows('request_follows'))[0].muted_at).toBeNull()
})
