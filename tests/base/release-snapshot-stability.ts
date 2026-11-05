import {exports} from 'cloudflare:workers'
import {expect,vi} from 'vitest'
import {call,env} from './support'
import {releaseGraph} from './release-fixture'
import {provider,rows,time} from './notification-regression-fixture'

type Graph=Awaited<ReturnType<typeof releaseGraph>>
type Unchanged=(change:string)=>Promise<void>
async function accepted(response:Response,status=200){
 expect(response.status,await response.clone().text()).toBe(status)
 return response
}
async function snapshots(){
 const read=async(table:string)=>(await rows(table)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return {
  targets:await read('release_target_snapshots'),
  recipients:await read('release_recipient_snapshots'),
  contexts:await read('release_recipient_contexts'),
 }
}
export async function captureReleaseSnapshots(g:Graph):Promise<Unchanged>{
 const sealed=await snapshots(),at=new Date().toISOString()
 expect(sealed.targets).toEqual(g.requests.map(request=>({
  version_id:g.draft.versionId,roadmap_item_id:'release-item',decision_id:'release-decision',request_id:request.id,created_at:at,updated_at:at,
 })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))
 const recipient=sealed.recipients.find(row=>row.requester_id===g.recipient.requesterId)!
 const address=await env.DB.prepare('SELECT verification_epoch FROM requester_addresses WHERE id=?').bind(g.recipient.addressId).first<{verification_epoch:number}>()
 expect(recipient.id).toEqual(expect.any(String))
 expect(recipient).toEqual({
  id:recipient.id,release_version_id:g.draft.versionId,requester_id:g.recipient.requesterId,requester_address_id:g.recipient.addressId,
  request_id:g.requests.map(request=>request.id).sort()[0],evidence_id:null,recipient_email:g.recipient.email,verification_epoch:address!.verification_epoch,created_at:at,updated_at:at,
 })
 expect(sealed.recipients).toHaveLength(2)
 expect(new Set(sealed.recipients.map(row=>row.id)).size).toBe(2)
 expect(sealed.contexts).toEqual(g.requests.map((request,index)=>({
  snapshot_id:recipient.id,request_id:request.id,roadmap_item_id:'release-item',title:'Public request '+index,slug:request.slug,created_at:at,updated_at:at,
 })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))
 return async change=>{
  const current=await snapshots()
  expect(current.targets,change).toEqual(sealed.targets)
  expect(current.recipients,change).toEqual(sealed.recipients)
  expect(current.contexts,change).toEqual(sealed.contexts)
 }
}
export async function changeSnapshotSources(g:Graph,unchanged:Unchanged){
 // A distinct canonical request keeps the merge separate from the relink below.
 const submitted=await accepted(await call('/api/public/requests',{title:'synthetic-penny-1 canonical',description:'synthetic-penny-2 wording',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},g.person),201)
 const canonical=await submitted.json() as {slug:string}
 await accepted(await call('/api/operator/moderation/'+canonical.slug,{verdict:'approved',title:'synthetic-penny-3 canonical',description:'synthetic-penny-4 public wording',boardSlug:'regression',displayName:'Requester'},g.operator))
 const target=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(canonical.slug).first<{id:string}>()
 const outbox=await rows('notification_outbox')
 vi.setSystemTime(Date.now()+60_000)
 await accepted(await call('/api/operator/requests/'+g.requests[0].slug+'/merge',{targetSlug:canonical.slug,notifySubscribers:false},g.operator))
 expect(await env.DB.prepare('SELECT merged_into_request_id FROM requests WHERE id=?').bind(g.requests[0].id).first()).toEqual({merged_into_request_id:target!.id})
 expect(await env.DB.prepare('SELECT canonical_id FROM request_canonical_roots WHERE origin_id=?').bind(g.requests[0].id).first()).toEqual({canonical_id:target!.id})
 expect(await rows('notification_outbox')).toEqual(outbox)
 await unchanged('mapped request merged without subscriber mail')

 // The replacement is fixture infrastructure; withdrawal and approval use native doors.
 await env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,title,summary,status,created_at,updated_at) VALUES('snapshot-replacement','snapshot-replacement','release-decision','synthetic-penny-5 item','synthetic-penny-6 summary','shipped',?,?)").bind(time(),time()).run()
 vi.setSystemTime(Date.now()+60_000)
 await accepted(await call('/api/operator/roadmap/release-item/withdraw',{},g.operator))
 const withdrawn=await (await accepted(await call('/api/operator/roadmap/release-item/context',undefined,g.operator))).json() as {publication:{withdrawnAt:string};mappings:{withdrawn_at:string}[]}
 expect(withdrawn.publication.withdrawnAt).toBe(new Date().toISOString())
 expect(withdrawn.mappings).toHaveLength(g.requests.length)
 for(const mapping of withdrawn.mappings)expect(mapping.withdrawn_at).toBe(new Date().toISOString())
 await unchanged('original roadmap mapping withdrawn')
 vi.setSystemTime(Date.now()+60_000)
 await accepted(await call('/api/operator/roadmap/snapshot-replacement/approve',{publicTitle:'synthetic-penny-7 replacement',publicSummary:'synthetic-penny-8 approved summary',boardSlug:'regression',requestIds:[g.requests[1].id]},g.operator))
 const relinked=await (await accepted(await call('/api/operator/roadmap/snapshot-replacement/context',undefined,g.operator))).json() as {publication:{publicTitle:string;withdrawnAt:string|null};mappings:{roadmap_item_id:string;request_id:string;approved_at:string;withdrawn_at:string|null}[]}
 expect(relinked.publication).toMatchObject({publicTitle:'synthetic-penny-7 replacement',withdrawnAt:null})
 expect(relinked.mappings).toEqual([expect.objectContaining({roadmap_item_id:'snapshot-replacement',request_id:g.requests[1].id,approved_at:new Date().toISOString(),withdrawn_at:null})])
 await unchanged('request reapproved onto another roadmap item')
}
export async function provePendingPreferenceWithdrawal(g:Graph,subscriber:Record<string,string>,withdrawnId:string,controlId:string,unchanged:Unchanged){
 // The independent subscriber explicitly opts back in; the original requester stays muted.
 vi.setSystemTime(Date.now()+60_000)
 await accepted(await call('/api/public/updates/subscription',{subscribed:true},subscriber,'PATCH'))
 expect(await (await accepted(await call('/api/public/updates/subscription',undefined,subscriber))).json()).toMatchObject({subscribed:true})
 await unchanged('independent subscriber opted back in')
 vi.mocked(fetch).mockClear()
 const sent=provider()
 const worker=exports.default as typeof exports.default&{scheduled(options:{scheduledTime:number;cron:string}):Promise<void>}
 const cron=()=>worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'})
 await cron()
 expect(sent).toHaveLength(1)
 const mail=sent[0].body as {personalizations:{to:{email:string}[]}[];custom_args:{rer_delivery_id:string}}
 expect(mail.custom_args.rer_delivery_id).toBe(controlId)
 const control=(await rows('notification_outbox')).find(row=>row.id===controlId)!
 const controlSnapshot=(await rows('release_recipient_snapshots')).find(row=>row.id===control.release_snapshot_id)!
 expect(mail.personalizations[0].to).toEqual([{email:controlSnapshot.recipient_email}])
 expect(controlSnapshot.recipient_email).not.toBe(g.recipient.email)
 const deliveries=await rows('notification_outbox'),attempts=await rows('notification_outbox_attempts')
 expect(deliveries.find(row=>row.id===withdrawnId)).toMatchObject({delivery_state:'suppressed',failure_reason:'recipient_no_longer_eligible',attempt_count:1})
 expect(deliveries.find(row=>row.id===controlId)).toMatchObject({delivery_state:'accepted',attempt_count:1})
 expect(attempts.find(row=>row.outbox_id===withdrawnId)).toMatchObject({state:'suppressed',recipient_email:null,provider_message_id:null})
 await cron();await cron()
 expect(sent).toHaveLength(1)
 expect(fetch).toHaveBeenCalledTimes(1)
 expect(await rows('notification_outbox')).toEqual(deliveries)
 expect(await rows('notification_outbox_attempts')).toEqual(attempts)
 await unchanged('scheduled delivery respected current withdrawal without replay')
}
