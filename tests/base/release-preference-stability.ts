import {exports} from 'cloudflare:workers'
import {applyD1Migrations,reset} from 'cloudflare:test'
import {expect,inject,vi} from 'vitest'
import {call,env,requester} from './support'
import {releaseGraph} from './release-fixture'
import {provider,rows} from './notification-regression-fixture'
import {captureReleaseSnapshots} from './release-snapshot-stability'

async function json<T>(response:Response,status=200):Promise<T>{
 expect(response.status,await response.clone().text()).toBe(status)
 return response.json() as Promise<T>
}

/** Keep the request and roadmap eligible: only the recipient preference changes. */
export async function proveNativePreferenceWithdrawal(){
 for(const preference of ['mute','subscription'] as const){
  await reset();await applyD1Migrations(env.DB,inject('migrations'))
  vi.restoreAllMocks();vi.setSystemTime('2026-11-05T14:00:00.000Z')
  const g=await releaseGraph(2),subscriber=await requester('synthetic-penny-9 subscriber')
  const endpoint='/api/public/updates/subscription',preferences='/api/public/requester/notifications'
  const subscription=await json<{subscribed:boolean;grantedAt:string}>(await call(endpoint,{subscribed:true},subscriber,'PATCH'))
  expect(subscription).toEqual({subscribed:true,grantedAt:new Date().toISOString()})
  const subscriberId=String((await rows('requester_update_permissions')).find(row=>row.source==='subscription')!.requester_id)
  await json(await call('/api/operator/releases/'+g.draft.slug+'/publish',{},g.operator))
  const unchanged=await captureReleaseSnapshots(g,subscriberId)
  const live=await Promise.all(['requests','request_follows','roadmap_publications','roadmap_request_mappings'].map(rows))
  for(const records of live)expect(records.length).toBeGreaterThan(0)
  const deliveries=await rows('notification_outbox')
  expect(deliveries).toHaveLength(2)
  for(const delivery of deliveries)expect(delivery).toMatchObject({delivery_state:'queued',attempt_count:0})
  const withdrawnId=preference==='mute'?g.recipient.requesterId:subscriberId
  const controlId=preference==='mute'?subscriberId:g.recipient.requesterId
  const refused=deliveries.find(row=>row.requester_id===withdrawnId)!,control=deliveries.find(row=>row.requester_id===controlId)!

  vi.setSystemTime(Date.now()+60_000)
  if(preference==='mute'){
   expect(await json(await call(preferences,{muted:true},g.person,'PATCH'))).toEqual({muted:true})
   expect(await json(await call(preferences,undefined,g.person))).toEqual({muted:true})
  }else{
   expect(await json(await call(endpoint,{subscribed:false},subscriber,'PATCH'))).toEqual({subscribed:false,grantedAt:null})
   expect(await json(await call(endpoint,undefined,subscriber))).toEqual({subscribed:false,grantedAt:null})
  }
  await unchanged('native '+preference+' preference withdrawn before delivery')
  vi.mocked(fetch).mockClear();const sent=provider()
  const worker=exports.default as typeof exports.default&{scheduled(options:{scheduledTime:number;cron:string}):Promise<void>}
  const cron=()=>worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'})
  await cron()
  expect(sent).toHaveLength(1)
  const envelope=sent[0].body as {custom_args:{rer_delivery_id:string};personalizations:{to:{email:string}[]}[]}
  expect(envelope.custom_args.rer_delivery_id).toBe(control.id)
  const controlSnapshot=(await rows('release_recipient_snapshots')).find(row=>row.id===control.release_snapshot_id)!
  expect(envelope.personalizations[0].to).toEqual([{email:controlSnapshot.recipient_email}])
  const after=await rows('notification_outbox'),attempts=await rows('notification_outbox_attempts')
  expect(attempts).toHaveLength(2)
  expect(after.find(row=>row.id===refused.id)).toMatchObject({delivery_state:'suppressed',failure_reason:'recipient_no_longer_eligible',attempt_count:1,provider_message_id:null})
  expect(after.find(row=>row.id===control.id)).toMatchObject({delivery_state:'accepted',attempt_count:1,provider_message_id:expect.any(String)})
  expect(attempts.find(row=>row.outbox_id===refused.id)).toMatchObject({state:'suppressed',recipient_email:null,provider_message_id:null})
  expect(attempts.find(row=>row.outbox_id===control.id)).toMatchObject({state:'accepted',recipient_email:controlSnapshot.recipient_email})
  await unchanged('native '+preference+' preference refused at mail edge')

  vi.setSystemTime(Date.now()+60_000)
  if(preference==='mute'){
   expect(await json(await call(preferences,{muted:false},g.person,'PATCH'))).toEqual({muted:false})
   expect(await json(await call(preferences,undefined,g.person))).toEqual({muted:false})
  }else{
   expect(await json<{subscribed:boolean}>(await call(endpoint,{subscribed:true},subscriber,'PATCH'))).toMatchObject({subscribed:true})
   expect(await json<{subscribed:boolean}>(await call(endpoint,undefined,subscriber))).toMatchObject({subscribed:true})
  }
  await cron();await cron()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(sent).toHaveLength(1)
  expect(await rows('notification_outbox')).toEqual(after)
  expect(await rows('notification_outbox_attempts')).toEqual(attempts)
  expect(await Promise.all(['requests','request_follows','roadmap_publications','roadmap_request_mappings'].map(rows))).toEqual(live)
  await unchanged('native '+preference+' preference restoration cannot replay suppressed delivery')
 }
}
