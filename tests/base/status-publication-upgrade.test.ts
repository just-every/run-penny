import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, expect, inject, it, vi } from 'vitest'
import { call, env } from './support'
import { createUlid } from '@/core/shared/ulid'
import { graph, rows, time } from './notification-regression-fixture'

afterEach(()=>vi.restoreAllMocks())
it('[REQ-015 NOTIFY-001 BASE-OPS-002] 0010 retains historical status records without replay and gives new actions durable versions',async()=>{
 await reset()
 const migrations=inject('migrations')
 await applyD1Migrations(env.DB,migrations.filter(migration=>migration.name<'0010'))
 const g=await graph(),id=createUlid(),operator=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO request_status_updates(id,request_id,public_status,body,pinned,operator_id,published_at,created_at,updated_at)
   VALUES(?,?,'under_review','Historical public wording',1,?,?,?,?)`).bind(id,g.requests[0].id,operator.id,time(),time(),time()),
  env.DB.prepare("UPDATE requests SET public_state='under_review' WHERE id=?").bind(g.requests[0].id),
 ])
 const before=(await rows('request_status_updates'))[0]
 await applyD1Migrations(env.DB,migrations)
 const {action_key,publication_version,...retained}=(await rows('request_status_updates'))[0]
 expect(retained).toEqual(before);expect(action_key).toBeNull();expect(publication_version).toBeNull()
 expect(await rows('notification_events')).toHaveLength(0)
 const path=`/api/operator/requests/${g.requests[0].slug}/status-updates`
 expect((await call(path,{status:'under_review',body:'Historical public wording',pinned:true},g.operator)).status).toBe(200)
 expect(await rows('request_status_updates')).toHaveLength(1);expect(await rows('notification_events')).toHaveLength(0)
 const action={status:'open',body:'New public wording',pinned:false,idempotencyKey:crypto.randomUUID()}
 expect((await call(path,action,g.operator)).status).toBe(200)
 expect((await call(path,action,g.operator)).status).toBe(200)
 const updated=await rows('request_status_updates')
 expect(updated).toHaveLength(2)
 expect(updated.find(row=>row.action_key===action.idempotencyKey)).toMatchObject({publication_version:1})
 expect(await rows('notification_events')).toHaveLength(1)
 expect(await rows('notification_intents')).toHaveLength(1)
 await applyD1Migrations(env.DB,migrations)
 expect(await rows('request_status_updates')).toEqual(updated)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
