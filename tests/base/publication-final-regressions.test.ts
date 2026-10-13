import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { call, env, requester } from './support'
import { releaseGraph } from './release-fixture'
import { rows, time } from './notification-regression-fixture'
import { publishRelease } from '@/core/features/releases/publication'
import { publishRoadmapUpdate } from '@/core/features/roadmap/update-publication'
import { ReleasesReadRepository } from '@/core/features/releases/read-repository'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')) })
afterEach(() => vi.restoreAllMocks())

it.each(['reapproval','withdrawal'] as const)('[ROAD-007/008 BASE-ACCESS-002/004 BASE-OPS-005] %s leaves stale drafts refused, removes Needs you and offers deliberate discard', async change => {
 const g = await releaseGraph(), id = await g.transition('in_progress')
 const approval={publicTitle:'New approved wording',publicSummary:'Current approved problem',boardSlug:'regression',requestIds:g.requests.map(request=>request.id)}
 if(change==='reapproval')expect((await call('/api/operator/roadmap/release-item/approve',approval,g.operator)).status).toBe(200)
 else expect((await call('/api/operator/roadmap/release-item/withdraw',{},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/roadmap-updates/${id}/publish`, {}, g.operator)).status).toBe(409)
 const overview = await (await call('/api/operator/overview', undefined, g.operator)).json() as { unpublishedStatusUpdates: { id: string }[] }
 expect(overview.unpublishedStatusUpdates.map(v => v.id)).not.toContain(id)
 const list = (await (await call('/api/operator/roadmap-updates', undefined, g.operator)).json() as {items:{ id: string; publicationState: string }[]}).items
 expect(list.find(v => v.id === id)?.publicationState).toBe('stale')
 expect((await call(`/api/operator/roadmap-updates/${id}/discard`, {})).status).toBe(401)
 expect((await call(`/api/operator/roadmap-updates/${id}/discard`, {}, await requester('Outside operator authority'))).status).toBe(401)
 expect((await call(`/api/operator/roadmap-updates/${id}/discard`, {}, {...g.operator,Origin:'https://foreign.example'})).status).toBe(403)
 expect((await call(`/api/operator/roadmap-updates/${id}/discard`, {}, g.operator)).status).toBe(200)
 expect((await rows('audit_entries')).filter(row=>row.action==='roadmap.update_discarded')).toHaveLength(1)
 expect((await call(`/api/operator/roadmap-updates/${id}/publish`, {}, g.operator)).status).toBe(409)
 if(change==='withdrawal')expect((await call('/api/operator/roadmap/release-item/approve',approval,g.operator)).status).toBe(200)
 const fresh = await g.transition('shipped')
 expect((await call(`/api/operator/roadmap-updates/${fresh}/publish`, {}, g.operator)).status).toBe(200)
 expect((await rows('roadmap_update_versions')).find(v => v.id === id)?.published_at).toBeNull()
})

it('[REL-003] operator published author and tag wording survives later directory edits', async () => {
 const g = await releaseGraph(), read = new ReleasesReadRepository({ binding: env.DB })
 await publishRelease(env.DB, g.draft.slug, time())
 const before = await read.find(g.draft.slug)
 await env.DB.prepare("UPDATE operators SET display_name='Changed operator name' WHERE id=?").bind(g.actor).run()
 await env.DB.exec("UPDATE tags SET name='Changed tag name' WHERE id='release-tag'")
 const after = await read.find(g.draft.slug)
 expect(after?.author).toEqual(before?.author)
 expect(after?.tagNames).toEqual(before?.tagNames)
 expect(after?.title).toBe(before?.title)
 expect(after?.body).toBe(before?.body)
})

it('[REL-003/004 ROAD-008] completed publication seals snapshot membership as well as existing rows', async () => {
 const g = await releaseGraph(), update = await g.transition('shipped')
 await publishRoadmapUpdate(env.DB, update, time())
 await publishRelease(env.DB, g.draft.slug, time())
 const header = (await rows('release_recipient_snapshots'))[0]
 await env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('late-person','Later person',?,?)").bind(time(),time()).run()
 await env.DB.prepare("INSERT INTO requester_addresses(id,requester_id,email,created_at,updated_at) VALUES('late-address','late-person','late@example.test',?,?)").bind(time(),time()).run()
 await expect(env.DB.prepare(`INSERT INTO release_recipient_snapshots(id,release_version_id,requester_id,requester_address_id,request_id,recipient_email,verification_epoch,created_at,updated_at)
 VALUES('late-header',?,?,?,?,?,?,?,?)`).bind(header.release_version_id, 'late-person', 'late-address', header.request_id, 'late@example.test', 0, time(), time()).run()).rejects.toThrow('immutable')
 // Even INSERT OR IGNORE must be refused: it must not reopen a sealed membership set.
 for (const table of ['release_target_snapshots', 'release_recipient_contexts', 'roadmap_update_targets', 'roadmap_update_contexts', 'roadmap_update_histories']) {
   await expect(env.DB.exec(`INSERT OR IGNORE INTO ${table} SELECT * FROM ${table}`)).rejects.toThrow('immutable')
 }
 expect(await rows('release_recipient_snapshots')).toHaveLength(1)
 expect(await rows('release_recipient_contexts')).toHaveLength(2)
 expect(await rows('roadmap_update_contexts')).toHaveLength(2)
})

it('[REL-004 ROAD-008] every target, recipient and context is sealed before the first delivery intent', async () => {
 const g=await releaseGraph(), second=await requester('Another follower')
 for(const request of g.requests)expect((await call(`/api/public/requests/${request.slug}/follow`,{},second)).status).toBe(204)
 await env.DB.exec(`CREATE TRIGGER require_complete_release_snapshot BEFORE INSERT ON notification_outbox WHEN NEW.release_snapshot_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'snapshot incomplete before first outbox command') WHERE
 (SELECT COUNT(*) FROM release_target_snapshots)!=2 OR (SELECT COUNT(*) FROM release_recipient_snapshots)!=2 OR
 (SELECT COUNT(*) FROM release_recipient_contexts)!=4 OR NOT EXISTS(SELECT 1 FROM release_versions WHERE id=NEW.subject_id AND snapshot_sealed_at IS NOT NULL); END;`.replaceAll('\n',' '))
 await publishRelease(env.DB,g.draft.slug,time())
 expect((await rows('notification_outbox')).filter(row=>row.release_snapshot_id)).toHaveLength(2)
 const id=await g.transition('shipped')
 await env.DB.exec(`CREATE TRIGGER require_complete_status_snapshot BEFORE INSERT ON notification_intents BEGIN
 SELECT RAISE(ABORT,'snapshot incomplete before first status intent') WHERE
 (SELECT COUNT(*) FROM roadmap_update_targets)!=2 OR (SELECT COUNT(*) FROM roadmap_update_histories)!=2 OR
 (SELECT COUNT(*) FROM roadmap_update_contexts)!=4 OR NOT EXISTS(SELECT 1 FROM roadmap_update_versions WHERE snapshot_sealed_at IS NOT NULL); END;`.replaceAll('\n',' '))
 await publishRoadmapUpdate(env.DB,id,time())
 expect(await rows('notification_intents')).toHaveLength(2)
})
