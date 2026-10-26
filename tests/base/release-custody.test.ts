import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { env } from './support'
import { releaseGraph } from './release-fixture'
import { rows,time,start,runtime,provider } from './notification-regression-fixture'
import { publishRelease } from '@/core/features/releases/publication'
import { publishRoadmapUpdate } from '@/core/features/roadmap/update-publication'
import { drainReleaseDeliveries } from '@/core/features/releases/delivery'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { exportArchive,planErasure } from '@/core/features/data/archive'
import { restoreArchive,eraseEntity } from '@/core/features/data/operations'
import { signingIdentity } from './review-mail-fixture'
import { createPennyApp } from '@/core/app/worker'
const tables=['roadmap_update_versions','roadmap_update_targets','roadmap_update_histories','roadmap_update_contexts','release_draft_mappings','release_target_snapshots','release_recipient_snapshots','release_recipient_contexts','notification_outbox_attempts','notification_delivery_facts','mail_event_records']
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
async function populated(){
 const g=await releaseGraph(),transition=await g.transition('shipped');await publishRoadmapUpdate(env.DB,transition,time());await publishRelease(env.DB,g.draft.slug,time())
 const sent=provider()
 // Even a separately invoked release drain cannot overtake a pending status.
 await drainReleaseDeliveries(runtime(),()=>start);expect(sent).toHaveLength(0)
 await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 await drainReleaseDeliveries(runtime(),()=>start+3600000);expect(sent).toHaveLength(2)
 const identity=await signingIdentity(),app=createPennyApp(),outbox=(await rows('notification_outbox')).find(r=>r.release_snapshot_id)!,batch=(await rows('notification_batches'))[0]
 for(const [id,attempt] of [[outbox.id,outbox.claim_id],[batch.id,batch.claim_id]]){
  const event={event:'delivered',sg_event_id:`custody-${id}`,sg_message_id:`message-${id}`,email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:id,rer_product:'penny',rer_penny_attempt:attempt}
  expect((await app.fetch(await identity.request([event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(200)
 }
 return g
}
it('[DATA-001 REL-004/007 BASE-DATA-003] schema-discovered export restores every populated new ownership table exactly',async()=>{
 const g=await populated();const snapshot=await exportArchive(env.DB,env.FILES)
 for(const table of tables)expect(snapshot.archive.tables[table].length,table).toBeGreaterThan(0)
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete')
 for(const table of tables)expect(await rows(table),table).toEqual([...snapshot.archive.tables[table]].sort((a,b)=>String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0]))))
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start+7200000);expect(sent).toHaveLength(0)
 // [DATA-003 REL-004/005] Erase the same requester after its exact archive round trip.
 const release=await rows('release_versions'),status=await rows('roadmap_update_versions')
 await env.DB.prepare("INSERT INTO notification_link_epochs(address_id,scope,epoch,created_at,updated_at) VALUES(?,'all',3,?,?)").bind(g.recipient.addressId,time(),time()).run()
 const plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 expect(plan.blockedCopies).toEqual([])
 expect(plan.counts.notification_outbox_attempts).toBe(1);expect(plan.counts.mail_event_records).toBe(4)
 expect((await eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)).status).toBe('complete')
 for(const table of ['release_recipient_snapshots','release_recipient_contexts','notification_outbox_attempts','notification_delivery_facts','mail_event_records','roadmap_update_contexts','notification_link_epochs'])expect(await rows(table),table).toHaveLength(0)
 expect(await rows('release_versions')).toEqual(release);expect(await rows('roadmap_update_versions')).toEqual(status)
 const after=await exportArchive(env.DB,env.FILES),json=JSON.stringify(after)
 expect(json).not.toContain(g.recipient.email);expect(json).not.toContain(g.recipient.requesterId);expect(json).not.toContain(g.recipient.addressId)
})
it('[DATA-001/003 REL-007 REQ-023] in-flight release claim fences archive, erasure and identity merge until provider settles',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time())
 await env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('merge-target','Target',?,?)").bind(time(),time()).run()
 const plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 vi.mocked(fetch).mockImplementation(async()=>{
  await expect(exportArchive(env.DB,env.FILES)).rejects.toMatchObject({code:'notification_writer_active'})
  await expect(eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)).rejects.toMatchObject({code:'notification_writer_active'})
  await expect(env.DB.prepare("INSERT INTO requester_identity_merges(id,source_requester_id,target_requester_id,actor_operator_id,created_at,updated_at) VALUES('blocked-merge',?,'merge-target',?,?,?)").bind(g.recipient.requesterId,g.actor,time(),time()).run()).rejects.toThrow('identity_merge_notification_active')
  return new Response(null,{status:202})
 })
 await drainReleaseDeliveries(runtime(),()=>start);expect((await exportArchive(env.DB,env.FILES)).archive).toBeDefined()
})
it('[DATA-001 REL-006/007] restored queued release is explicitly unknown and inert',async()=>{
 const g=await releaseGraph();await publishRelease(env.DB,g.draft.slug,time());const snapshot=await exportArchive(env.DB,env.FILES)
 const releaseRow=snapshot.archive.tables.notification_outbox.find(r=>r.release_snapshot_id)!
 expect(releaseRow.delivery_state).toBe('unknown');expect(releaseRow.failure_reason).toBe('restored_delivery_review_required')
 await reset();await applyD1Migrations(env.DB,inject('migrations'));await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)
 const sent=provider();await drainReleaseDeliveries(runtime(),()=>start+60000);expect(sent).toHaveLength(0)
})
it('[DATA-003 REL-003/005] approved public phrase survives requester erasure while private copied wording still refuses',async()=>{
 const g=await releaseGraph(1)
 const {saveReleaseDraft}=await import('@/core/features/releases/drafts')
 await saveReleaseDraft(env.DB,{...g.input,body:'Public request 0 is now easier.'},g.draft.slug,time());await publishRelease(env.DB,g.draft.slug,time())
 const before=await rows('release_versions'),plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 expect(plan.blockedCopies).toEqual([])
 await eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)
 expect(await rows('release_versions')).toEqual(before)
})
it('[DATA-003 BASE-DATA-003] independently published wording never exempts private email or unapproved copied phrases',async()=>{
 const g=await releaseGraph(1)
 const {saveReleaseDraft}=await import('@/core/features/releases/drafts')
 await saveReleaseDraft(env.DB,{...g.input,body:`Contact ${g.recipient.email}; Requester wording`},g.draft.slug,time())
 await publishRelease(env.DB,g.draft.slug,time())
 const plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 expect(plan.blockedCopies).toEqual(expect.arrayContaining([expect.objectContaining({table:'release_versions',columns:expect.arrayContaining(['body'])})]))
 await expect(eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)).rejects.toMatchObject({code:'erasure_ambiguous_copies'})
})
it('[DATA-003 REL-004] follower erasure does not mistake another author’s approved public request context for private recipient wording',async()=>{
 const g=await releaseGraph(1,true)
 await publishRelease(env.DB,g.draft.slug,time())
 const plan=await planErasure(env.DB,'requesters',g.recipient.requesterId)
 expect(plan.blockedCopies).toEqual([]);expect(plan.counts.requests??0).toBe(0)
 await eraseEntity(env.DB,env.FILES,'requesters',g.recipient.requesterId,plan.planHash)
 expect(await rows('release_recipient_contexts')).toHaveLength(0)
 expect((await rows('requests')).some(r=>r.id===g.requests[0].id)).toBe(true)
})
