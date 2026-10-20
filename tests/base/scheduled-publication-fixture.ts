import { applyD1Migrations,reset } from 'cloudflare:test'
import { expect,inject,type MockInstance } from 'vitest'
import { call,env,owner } from './support'
import { rows } from './notification-regression-fixture'
import type { releaseGraph } from './release-fixture'
import type { providerMessages } from './provider-messages'
import type { Archive,ErasureJournal } from '@/core/features/data/archive'

type Graph=Awaited<ReturnType<typeof releaseGraph>>
type Clock=MockInstance<()=>number>
const clockSettings={timezone:'Australia/Brisbane',quietEnabled:false,quietStart:20,quietEnd:8}
const localTime=(instant:Date)=>new Date(instant.getTime()+10*3600000).toISOString().slice(0,16)
async function json<T=unknown>(response:Response,status=200):Promise<T>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
const schedule=(slug:string)=>`/api/operator/releases/${slug}/schedule`

export async function scheduleOriginalRelease(g:Graph,due:Date,clock:Clock,cron:()=>Promise<void>){
 await json(await call('/api/operator/settings/workspace-clock',clockSettings,g.operator,'PUT'))
 for(const headers of [{},g.person])expect((await call(schedule(g.draft.slug),{localTime:localTime(due)},headers)).status).toBe(401)
 expect((await call(schedule(g.draft.slug),{localTime:localTime(due)},{...g.operator,Origin:'https://foreign.test'})).status).toBe(403)
 expect((await call(schedule(g.draft.slug),{localTime:'2026-02-30T09:00'},g.operator)).status).toBe(422)
 await json(await call(schedule(g.draft.slug),{localTime:localTime(due)},g.operator))
 expect((await rows('penny_publication_schedules'))[0]).toMatchObject({scheduled_at:due.toISOString(),time_zone:'Australia/Brisbane',state:'scheduled',author_operator_id:g.actor})
 // Changing the workspace timezone affects new input, never an existing instant.
 await json(await call('/api/operator/settings/workspace-clock',{...clockSettings,timezone:'America/New_York'},g.operator,'PUT'))
 expect(await json(await call(schedule(g.draft.slug),undefined,g.operator))).toMatchObject({timezone:'America/New_York',schedule:{scheduledAt:due.toISOString(),timeZone:'Australia/Brisbane'}})
 clock.mockReturnValue(due.getTime()-1);await cron()
 expect((await rows('releases'))[0].state).toBe('draft');expect(await rows('notification_outbox')).toEqual([])
 // A database interruption rolls back publication and schedule completion together.
 await env.DB.prepare("CREATE TRIGGER interrupt_schedule BEFORE UPDATE OF state ON penny_publication_schedules WHEN NEW.state='published' BEGIN SELECT RAISE(ABORT,'simulated schedule interruption'); END").run()
 clock.mockReturnValue(due.getTime());await expect(cron()).rejects.toThrow('simulated schedule interruption')
 expect((await rows('releases'))[0].state).toBe('draft');expect(await rows('notification_outbox')).toEqual([])
 expect((await rows('penny_publication_schedules'))[0].state).toBe('scheduled')
 await env.DB.prepare('DROP TRIGGER interrupt_schedule').run()
 await Promise.all([cron(),cron()])
 const outbox=await rows('notification_outbox');expect(outbox).toHaveLength(1)
 await cron();expect(await rows('notification_outbox')).toEqual(outbox)
 expect((await rows('penny_publication_schedules'))[0].state).toBe('published')
 expect((await rows('audit_entries')).filter(row=>row.action==='release.published')).toEqual([expect.objectContaining({actor_type:'system',actor_id:'publication.scheduler'})])
 await json(await call('/api/operator/settings/workspace-clock',clockSettings,g.operator,'PUT'))
}

export async function proveScheduledPublications(g:Graph,instant:Date,clock:Clock,cron:()=>Promise<void>,capture:NonNullable<ReturnType<typeof providerMessages>>){
 const due=new Date(instant.getTime()+3600000)
 const draft=async(title:string)=>json<{id:string;slug:string}>(await call('/api/operator/releases',{...g.input,title},g.operator),201)
 const cancelled=await draft('Cancelled publication'),failed=await draft('Scheduled improvement')
 for(const item of [cancelled,failed])await json(await call(schedule(item.slug),{localTime:localTime(due)},g.operator))
 await json(await call(schedule(cancelled.slug)+'/cancel',{},g.operator))
 const transition=await g.transition('planned')
 const statusPath=`/api/operator/roadmap-updates/${transition}/schedule`
 await json(await call(statusPath,{localTime:localTime(due)},g.operator))
 await cron();expect((await rows('roadmap_update_versions')).find(row=>row.id===transition)).toMatchObject({published_at:null})
 const beforeMail=await capture.list()
 clock.mockReturnValue(due.getTime());await Promise.all([cron(),cron()]);await cron()
 expect((await rows('releases')).find(row=>row.id===cancelled.id)).toMatchObject({state:'draft'})
 expect((await rows('releases')).find(row=>row.id===failed.id)).toMatchObject({state:'draft'})
 expect((await rows('penny_publication_schedules')).find(row=>row.release_id===cancelled.id)).toMatchObject({state:'cancelled'})
 expect((await rows('penny_publication_schedules')).find(row=>row.release_id===failed.id)).toMatchObject({state:'failed',last_error:expect.stringContaining('must be Shipped')})
 const notices=await json<{mentions:{noteId:string;kind:string;body:string}[]}>(await call('/api/operator/discussion/mentions',undefined,g.operator))
 expect(notices.mentions).toEqual([expect.objectContaining({kind:'publication',body:expect.stringContaining('must be Shipped')})])
 expect(await capture.list()).toEqual(beforeMail)
 const failedVersion=(await rows('releases')).find(row=>row.id===failed.id)!.current_version_id
 expect((await rows('release_recipient_snapshots')).filter(row=>row.release_version_id===failedVersion)).toEqual([])
 expect((await rows('notification_outbox')).filter(row=>!['release_version'].includes(String(row.event_type)))).toEqual([])
 expect((await rows('roadmap_update_versions')).find(row=>row.id===transition)).toMatchObject({published_at:due.toISOString()})
 const statusEvents=(await rows('notification_events')).filter(row=>row.roadmap_update_version_id===transition)
 expect(statusEvents).toHaveLength(g.requests.length)
 expect((await rows('audit_entries')).filter(row=>row.action==='roadmap.update_published'&&row.entity_id===transition)).toEqual([expect.objectContaining({actor_type:'system',actor_id:'publication.scheduler'})])
 await cron();expect((await rows('notification_events')).filter(row=>row.roadmap_update_version_id===transition)).toEqual(statusEvents)
 // A status draft whose approved wording changed also fails without customer mail.
 const stale=await g.transition('in_progress'),stalePath=`/api/operator/roadmap-updates/${stale}/schedule`
 const later=new Date(due.getTime()+3600000)
 await json(await call(stalePath,{localTime:localTime(later)},g.operator))
 await env.DB.prepare("UPDATE roadmap_publications SET public_summary='New approved wording',updated_at=? WHERE roadmap_item_id='release-item'").bind(later.toISOString()).run()
 clock.mockReturnValue(later.getTime());await cron();await cron()
 expect((await rows('roadmap_update_versions')).find(row=>row.id===stale)).toMatchObject({published_at:null})
 expect((await rows('penny_publication_schedules')).find(row=>row.roadmap_update_id===stale)).toMatchObject({state:'failed',last_error:expect.stringContaining('changed')})
 expect(await capture.list()).toEqual(beforeMail)
 await json(await call(`/api/operator/discussion/mentions/${notices.mentions[0].noteId}/dismiss`,{},g.operator))
 await cron()
 expect((await json<{mentions:unknown[]}>(await call('/api/operator/discussion/mentions',undefined,g.operator))).mentions).toHaveLength(1)
 // Carry terminal rows, dismissal and one pending row across the public archive
 // door. Pending publication is restored held until explicitly rescheduled.
 const pending=await draft('Review this restored schedule')
 await json(await call(schedule(pending.slug),{localTime:localTime(new Date(later.getTime()+3600000))},g.operator))
 const saved=await json<{archive:Archive;journal:ErasureJournal}>(await call('/api/operator/data/export',undefined,g.operator))
 expect(saved.archive.tables.penny_publication_schedules).toHaveLength(6)
 expect(saved.archive.tables.penny_publication_schedules.find(row=>row.release_id===pending.id)).toMatchObject({state:'held',time_zone:'Australia/Brisbane'})
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const destination=await owner()
 await json(await call('/api/operator/data/import',saved,destination))
 expect((await rows('penny_publication_schedules')).sort((a,b)=>String(a.id).localeCompare(String(b.id)))).toEqual([...saved.archive.tables.penny_publication_schedules].sort((a,b)=>String(a.id).localeCompare(String(b.id))))
 clock.mockReturnValue(later.getTime()+7200000);await cron()
 expect((await rows('releases')).find(row=>row.id===pending.id)).toMatchObject({state:'draft'})
 expect(await env.DB.prepare('PRAGMA foreign_key_check').all()).toMatchObject({results:[]})
}
