import { applyD1Migrations,reset } from 'cloudflare:test'
import { afterEach,beforeEach,expect,inject,it,vi } from 'vitest'
import { call,env } from './support'
import { releaseGraph } from './release-fixture'
import { provider,runtime,start,time } from './notification-regression-fixture'
import { erasurePreview } from './feedback-import-fixture'
import { publishRelease } from '@/core/features/releases/publication'
import { drainReleaseDeliveries } from '@/core/features/releases/delivery'
import { drainNotifications } from '@/core/features/notifications/delivery'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())

it('[BASE-OPS-005][DATA-003] automated requester and release mail record the feature that acted and the time, and outlive the requester they reached',async()=>{
 const g=await releaseGraph();await g.publish(0,'Status reaching the follower')
 await publishRelease(env.DB,g.draft.slug,time())
 const sent=provider()
 await drainReleaseDeliveries(runtime(),()=>start+59000)
 await drainNotifications(runtime(),()=>start+3600000+60000)
 expect(sent).toHaveLength(2)
 const audits=async()=>(await env.DB.prepare("SELECT actor_type,actor_id,action,entity_id,details_json,occurred_at FROM audit_entries WHERE action IN ('notification.delivery_attempted','release.delivery_attempted') ORDER BY action").all<Record<string,string|null>>()).results
 const recorded=await audits()
 expect(recorded.map(row=>[row.actor_type,row.actor_id,row.action])).toEqual([['system','notifications.requester','notification.delivery_attempted'],['system','releases.delivery','release.delivery_attempted']])
 for(const row of recorded){expect(JSON.parse(row.details_json!)).toEqual({state:'accepted',reason:null});expect(Date.parse(row.occurred_at!)).not.toBeNaN();expect(row.details_json).not.toContain(g.recipient.email)}
 // Erasing the requester removes what the rows describe; the rows stay, anonymised.
 const plan=await(await erasurePreview('requesters',g.recipient.requesterId,g.operator)).json() as {planHash:string}
 let result=await(await call('/api/operator/data/erasure',{table:'requesters',id:g.recipient.requesterId,planHash:plan.planHash},g.operator)).json() as {operationId:string;status:string}
 for(let step=0;step<20&&result.status!=='complete';step++)result=await(await call('/api/operator/data/operations/'+result.operationId+'/resume',{},g.operator)).json() as typeof result
 expect(result.status).toBe('complete')
 const kept=await audits()
 expect(kept.map(row=>[row.actor_type,row.actor_id,row.action,row.occurred_at])).toEqual(recorded.map(row=>[row.actor_type,row.actor_id,row.action,row.occurred_at]))
 for(const row of kept){expect(row.entity_id).toMatch(/^erased:/);expect(row.details_json).toBeNull()}
})
