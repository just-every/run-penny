import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { env,call } from './support'
import { releaseGraph } from './release-fixture'
import { rows,time,start,runtime,provider } from './notification-regression-fixture'
import { publishRoadmapUpdate } from '@/core/features/roadmap/update-publication'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { requestVersionDeliveryCounts } from '@/core/features/releases/counts'
import { PublicRequestsReadRepository } from '@/core/features/requests/public-read-repository'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it.each(['planned','in_progress','shipped','dropped'] as const)('[ROAD-007/008 NOTIFY-001/002] %s draft is private; grouped publish creates two histories and one fixed-window recipient',async status=>{
 const g=await releaseGraph(),id=await g.transition(status),publicRead=new PublicRequestsReadRepository({binding:env.DB})
 expect((await publicRead.find(g.requests[0].slug))!.statusUpdates).toHaveLength(0)
 const draft=(await rows('roadmap_update_versions'))[0]
 expect(draft.body).toContain(status==='dropped'?'Withdrawn':status==='in_progress'?'In progress':status==='planned'?'Planned':'Shipped')
 expect(JSON.stringify(draft)).not.toContain('Private')
 await Promise.all([publishRoadmapUpdate(env.DB,id,time()),publishRoadmapUpdate(env.DB,id,time())])
 expect(await rows('roadmap_update_histories')).toHaveLength(2);expect(await rows('notification_intents')).toHaveLength(1)
 const histories=(await publicRead.find(g.requests[0].slug))!.statusUpdates
 expect(histories).toHaveLength(1);expect(histories[0].status).toBe(status==='dropped'?'withdrawn':status)
 const sent=provider();await drainNotifications(runtime(),()=>start+3599999);expect(sent).toHaveLength(0)
 await drainNotifications(runtime(),()=>start+3600000);expect(sent).toHaveLength(1)
 const body=JSON.stringify(sent[0].body);expect(body).toContain('Public request 0');expect(body).toContain('Public request 1');expect(body).not.toContain('Private')
 await publishRoadmapUpdate(env.DB,id,time());await drainNotifications(runtime(),()=>start+7200000);expect(sent).toHaveLength(1)
 for(const request of g.requests)expect((await requestVersionDeliveryCounts(env.DB,request.id))[0].counts).toMatchObject({sent:1,queued:0})
})
it('[ROAD-008 NOTIFY-002 REL-005] muting the anchor retains only other eligible own context and one accurate version count',async()=>{
 const g=await releaseGraph(),id=await g.transition('in_progress');await publishRoadmapUpdate(env.DB,id,time())
 const intent=(await rows('notification_intents'))[0],event=(await env.DB.prepare('SELECT request_id FROM notification_events WHERE id=?').bind(intent.event_id).first<{request_id:string}>())!
 const muted=g.requests.find(r=>r.id===event.request_id)!,other=g.requests.find(r=>r.id!==event.request_id)!
 expect((await call(`/api/public/requests/${muted.slug}/follow`,{muted:true},g.person,'PATCH')).status).toBe(204)
 const sent=provider();await drainNotifications(runtime(),()=>start+3600000)
 expect(sent).toHaveLength(1);const body=JSON.stringify(sent[0].body)
 expect(body).toContain(other.slug);expect(body).not.toContain(`/portal/feedback/${muted.slug}`)
 expect((await requestVersionDeliveryCounts(env.DB,muted.id))[0].counts.sent).toBe(1)
})
it('[ROAD-007/008 DATA-001] draft insertion and publication fail atomically at the final write',async()=>{
 const g=await releaseGraph()
 await env.DB.exec("CREATE TRIGGER fail_status_draft BEFORE INSERT ON roadmap_update_targets BEGIN SELECT RAISE(ABORT,'draft failed'); END;")
 await expect(g.transition('planned')).rejects.toThrow('draft failed');expect(await rows('roadmap_transitions')).toHaveLength(0)
 expect((await rows('roadmap_items'))[0].status).toBe('shipped')
 await env.DB.exec('DROP TRIGGER fail_status_draft');const id=await g.transition('planned')
 await env.DB.exec("CREATE TRIGGER fail_status_intent BEFORE INSERT ON notification_intents BEGIN SELECT RAISE(ABORT,'intent failed'); END;")
 await expect(publishRoadmapUpdate(env.DB,id,time())).rejects.toThrow('intent failed')
 expect(await rows('roadmap_update_histories')).toHaveLength(0);expect(await rows('roadmap_update_contexts')).toHaveLength(0)
 expect((await rows('roadmap_update_versions'))[0].published_at).toBeNull()
})
it.each(['withdraw','reapprove','mapping','wording','visibility'] as const)('[ROAD-004/008] status publish refuses stale %s authority',async change=>{
 const g=await releaseGraph(),id=await g.transition('dropped')
 if(change==='withdraw')await env.DB.exec("UPDATE roadmap_publications SET withdrawn_at='later'")
 if(change==='reapprove')await env.DB.exec("UPDATE roadmap_publications SET approved_at='later'")
 if(change==='mapping')await env.DB.exec("UPDATE roadmap_request_mappings SET updated_at='later'")
 if(change==='wording')await env.DB.exec("UPDATE roadmap_publications SET public_summary='Changed'")
 if(change==='visibility')await env.DB.exec("UPDATE boards SET visibility='internal'")
 await expect(publishRoadmapUpdate(env.DB,id,time())).rejects.toThrow('changed');expect(await rows('roadmap_update_histories')).toHaveLength(0)
})
it('[NOTIFY-005 REL-013] ordinary request counts reflect signed provider facts without changing native status publication',async()=>{
 const g=await releaseGraph(1);await g.publish(0,'Ordinary status');provider();await drainNotifications(runtime(),()=>start+3600000)
 const batch=(await rows('notification_batches'))[0],{signingIdentity}=await import('./review-mail-fixture'),{createPennyApp}=await import('@/core/app/worker'),{requestDeliveryCounts}=await import('@/core/features/releases/counts'),identity=await signingIdentity()
 const event={event:'delivered',sg_event_id:'ordinary-delivered',sg_message_id:'ordinary-message',email:g.recipient.email,timestamp:Math.floor(Date.now()/1000),rer_delivery_id:batch.id,rer_penny_attempt:batch.claim_id,rer_product:'penny'}
 expect((await createPennyApp().fetch(await identity.request([event]),{...env,SENDGRID_EVENT_PUBLIC_KEY:identity.key})).status).toBe(200)
 expect(await requestDeliveryCounts(env.DB,g.requests[0].id)).toMatchObject({sent:1,delivered:1})
})
