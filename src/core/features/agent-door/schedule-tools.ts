import {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {tool,id,external} from './tool'
import {workspaceClock} from '../settings/workspace-clock'
import {publicationInstant} from '../releases/schedule-clock'
import {publishRelease} from '../releases/publication'
import {publishRoadmapUpdate} from '../roadmap/update-publication'
import {ToolRefusal} from '../../../../base/modules/agent-door/errors.ts'

export function scheduleTools(runtime:PennyRuntime){return [
 tool(runtime,{name:'publications.schedule',title:'Schedule or cancel a native release or roadmap update',scope:'publication:write',clauses:['REL-014','ROAD-007','ROAD-008'],classes:['external'],schema:z.object({kind:z.enum(['release','roadmap-update']),id,localTime:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),cancel:z.boolean().default(false)}),classify:async()=>external(),run:async(a,n)=>{
 const release=a.kind==='release',column=release?'release_id':'roadmap_update_id',table=release?'releases':'roadmap_update_versions'
 if(a.cancel){await n.db.batch([n.db.prepare(`UPDATE penny_publication_schedules SET state='cancelled',completed_at=?,updated_at=? WHERE ${column}=? AND state='scheduled'`).bind(n.now,n.now,a.id),n.db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'publication.unscheduled','publication_schedule',?,?,?,?)").bind(crypto.randomUUID(),n.actor,a.id,n.now,n.now,n.now)]);return {ok:true}}
 const timeZone=(await workspaceClock(runtime)).timezone,scheduledAt=publicationInstant(z.string().parse(a.localTime),timeZone)
 if(Date.parse(scheduledAt)<=Date.now())throw new ToolRefusal('publication_time_past')
 const key=crypto.randomUUID(),eligible=release?"state='draft'":'published_at IS NULL AND discarded_at IS NULL'
 const [saved]=await n.db.batch([
 n.db.prepare(`INSERT INTO penny_publication_schedules(id,${column},author_operator_id,scheduled_by_operator_id,scheduled_at,time_zone,state,created_at,updated_at)
 SELECT ?,id,author_operator_id,?,?,?,'scheduled',?,? FROM ${table} WHERE id=? AND ${eligible}
 ON CONFLICT(${column}) DO UPDATE SET id=excluded.id,author_operator_id=excluded.author_operator_id,scheduled_by_operator_id=excluded.scheduled_by_operator_id,scheduled_at=excluded.scheduled_at,time_zone=excluded.time_zone,state='scheduled',last_error=NULL,dismissed_at=NULL,completed_at=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at`).bind(key,n.actor,scheduledAt,timeZone,n.now,n.now,a.id),
 n.db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) SELECT ?,'operator',?,'publication.scheduled','publication_schedule',id,?,?,? FROM penny_publication_schedules WHERE id=?").bind(crypto.randomUUID(),n.actor,n.now,n.now,n.now,key)])
 if(!saved.meta.changes)throw new ToolRefusal('publication_not_schedulable')
 return {id:key,scheduledAt,timeZone}
 }}),
 tool(runtime,{name:'publications.execute',title:'Admit one due scheduled native publication under current policy',scope:'publication:write',clauses:['REL-014'],classes:['external'],schema:z.object({id}),classify:async()=>external(),run:async(a,n)=>{
 const row=await n.db.prepare("SELECT s.release_id,s.roadmap_update_id,r.slug FROM penny_publication_schedules s LEFT JOIN releases r ON r.id=s.release_id WHERE s.id=? AND s.state='scheduled' AND s.scheduled_at<=?").bind(a.id,n.now).first<{release_id:string|null;roadmap_update_id:string|null;slug:string|null}>()
 if(!row)throw new ToolRefusal('publication_not_due')
 const result=row.release_id?await publishRelease(n.db,row.slug!,n.now,n.actor):await publishRoadmapUpdate(n.db,row.roadmap_update_id!,n.now,n.actor)
 await n.db.prepare("UPDATE penny_publication_schedules SET state='published',completed_at=?,updated_at=? WHERE id=? AND state='scheduled'").bind(n.now,n.now,a.id).run()
 return result
 }}),
]}
