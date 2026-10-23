import {applyD1Migrations,reset,createScheduledController} from 'cloudflare:test'
import {expect,inject} from 'vitest'
import {call,env,owner,requester,messages,mockMail} from './support'
import {erasurePreview} from './feedback-import-fixture'
import type {Archive,ErasureJournal} from '@/core/features/data/archive'
import {completedWeek} from '@/core/features/notifications/weekly-schedule'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
export async function weeklyPortability(operator:Record<string,string>){
 mockMail()
 const probe=await requester('Restored weekly reader'),subject=(await env.DB.prepare('SELECT slug FROM requests WHERE published_at IS NOT NULL LIMIT 1').first<{slug:string}>())!
 expect((await call('/api/public/requester/weekly-summary',{subscribed:true},probe,'PATCH')).status).toBe(200)
 expect((await call(`/api/public/requests/${subject.slug}/follow`,{},probe)).status).toBe(204)
 expect((await call(`/api/operator/requests/${subject.slug}/status-updates`,{status:'under_review',body:'Restored weekly public change',idempotencyKey:crypto.randomUUID()},operator)).status).toBe(200)
 const period=Date.parse(completedWeek(Date.now()).end)+42*86400000
 await env.DB.prepare("UPDATE notification_events SET created_at=?,updated_at=? WHERE body='Restored weekly public change'").bind(new Date(period-86400000).toISOString(),new Date(period-86400000).toISOString()).run()
 const exported=await call('/api/operator/data/export',undefined,operator)
 expect(exported.status).toBe(200)
 const bundle=await exported.json() as {archive:Archive;journal:ErasureJournal}
 expect(bundle.archive.tables.penny_weekly_choices.length).toBeGreaterThan(0)
 expect(bundle.archive.tables.penny_weekly_choices.every(row=>row.subscribed===0&&row.revoked_at)).toBe(true)
 expect(bundle.archive.tables.penny_weekly_summary.every(row=>row.enabled===0)).toBe(true)
 await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail();operator=await owner({timezone:'UTC'})
 const restored=await call('/api/operator/data/import',bundle,operator)
 expect(restored.status,await restored.clone().text()).toBe(200)
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_weekly_choices WHERE subscribed=1').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT enabled FROM penny_weekly_summary').first('enabled')).toBe(0)
 const sent=messages.length
 await runNotificationSchedule(createScheduledController({cron:'* * * * *',scheduledTime:period+9*3600000}),{...env,WORKSPACE_TIMEZONE:'UTC'})
 expect(messages).toHaveLength(sent)
 const person=await requester('Weekly preference erasure'),address=(await env.DB.prepare('SELECT requester_id AS id FROM requester_addresses WHERE email=?').bind(messages.at(-1)!.to).first<{id:string}>())!
 expect((await call('/api/operator/settings/weekly-summary',{enabled:true},operator,'PUT')).status).toBe(200)
 expect((await call('/api/public/requester/weekly-summary',{subscribed:true},person,'PATCH')).status).toBe(200)
 const preview=await erasurePreview('requesters',address.id,operator),plan=await preview.json() as {planHash:string;blockedCopies:unknown[]}
 expect(preview.status).toBe(200);expect(plan.blockedCopies).toEqual([])
 let response=await call('/api/operator/data/erasure',{table:'requesters',id:address.id,planHash:plan.planHash},operator)
 while(response.status===202){const job=await response.json() as {operationId:string};response=await call(`/api/operator/data/operations/${job.operationId}/resume`,{},operator)}
 expect(response.status,await response.clone().text()).toBe(200)
 expect(await env.DB.prepare('SELECT 1 FROM penny_weekly_choices WHERE requester_id=?').bind(address.id).first()).toBeNull()
 expect(await env.DB.prepare('SELECT 1 FROM requesters WHERE id=?').bind(address.id).first()).toBeNull()
}
