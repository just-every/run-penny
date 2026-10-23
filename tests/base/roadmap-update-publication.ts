import {expect,vi} from 'vitest'
import {call,env,requester} from './support'
import {releaseGraph} from './release-fixture'
import {createScheduledController} from 'cloudflare:test'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import {createPennyRuntime} from '@/core/app/runtime'
import {providerMessages} from './provider-messages'

/** The real publication route fans out history and one coalesced follower email. */
export async function proveRoadmapPublication(){
 vi.setSystemTime(new Date('2026-10-23T09:00:00Z'))
 try{
 const g=await releaseGraph(4),mapped=g.requests.slice(0,2),controls=g.requests.slice(2)
 await env.DB.prepare("UPDATE roadmap_request_mappings SET approved_at=NULL WHERE roadmap_item_id='release-item' AND request_id=?").bind(controls[0].id).run()
 await env.DB.prepare("DELETE FROM roadmap_request_mappings WHERE roadmap_item_id='release-item' AND request_id=?").bind(controls[1].id).run()
 const muted=await requester('synthetic-penny-muted-follower')
 for(const r of mapped)expect((await call(`/api/public/requests/${r.slug}/follow`,{},muted)).status).toBe(204)
 expect((await call('/api/public/requester/notifications',{muted:true},muted,'PATCH')).status).toBe(200)
 const histories=async()=>Promise.all(g.requests.map(async r=>(await (await call(`/api/public/requests/${r.slug}`)).json() as {statusUpdates:unknown[]}).statusUpdates))
 expect(await histories()).toEqual([[],[],[],[]])
 async function publishMove(status:string){
  expect((await call('/api/operator/roadmap/release-item/move',{status,reason:'synthetic-penny-publication',idempotencyKey:crypto.randomUUID()},g.operator)).status).toBe(200)
  const draft=await env.DB.prepare('SELECT id,body FROM roadmap_update_versions WHERE published_at IS NULL AND discarded_at IS NULL ORDER BY version_number DESC LIMIT 1').first<{id:string;body:string}>()
  expect(draft).not.toBeNull()
  const path=`/api/operator/roadmap-updates/${draft!.id}/publish`
  expect((await call(path,{},g.operator)).status).toBe(200)
  return {...draft!,path}
 }
 const first=await publishMove('in_progress')
 const firstHistories=await histories()
 expect(firstHistories).toEqual([[expect.objectContaining({body:first.body})],[expect.objectContaining({body:first.body})],[],[]])
 const intents=()=>env.DB.prepare('SELECT i.requester_id,i.address_id,e.roadmap_update_version_id FROM notification_intents i JOIN notification_events e ON e.id=i.event_id WHERE e.roadmap_update_version_id IS NOT NULL ORDER BY e.roadmap_update_version_id,i.requester_id').all()
 expect((await intents()).results).toEqual([{requester_id:g.recipient.requesterId,address_id:g.recipient.addressId,roadmap_update_version_id:first.id}])
 const second=await publishMove('planned')
 expect((await intents()).results).toEqual([first.id,second.id].sort().map(id=>({requester_id:g.recipient.requesterId,address_id:g.recipient.addressId,roadmap_update_version_id:id})))
 const bindings={...env,WORKSPACE_TIMEZONE:'UTC'},capture=providerMessages(createPennyRuntime(bindings))!
 const before=(await capture.list()).length
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 await cron()
 expect((await capture.list()).length).toBe(before)
 vi.setSystemTime(Date.now()+60_001)
 await cron()
 const delivered=(await capture.list()).slice(before)
 expect(delivered.map(row=>row.message.to)).toEqual([[g.recipient.email]])
 expect(delivered[0].message.text).toEqual(expect.stringContaining(first.body))
 expect(delivered[0].message.text).toEqual(expect.stringContaining(second.body))
 const beforeRepeat={histories:await histories(),intents:(await intents()).results}
 const repeat=await call(first.path,{},g.operator)
 expect(repeat.status).toBe(409)
 expect(await repeat.json()).toMatchObject({message:expect.any(String)})
 await cron()
 expect({histories:await histories(),intents:(await intents()).results,mail:(await capture.list()).slice(before)}).toEqual({...beforeRepeat,mail:delivered})
 }finally{vi.useRealTimers()}
}
