import type { Hono } from 'hono'
import { z } from 'zod'
import { loopMutation } from '@/core/app/loop-mutation'
import { MutationError,parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { decisionDatabase } from '../decisions/authority'
import { workspaceClock } from '../settings/workspace-clock'
import { publicationInstant } from './schedule-clock'

const input=z.object({localTime:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)}).strict()
export function registerPublicationScheduleRoutes(app:Hono<OperatorMutationEnvironment>){
 for(const release of [true,false]){
  const path=release?'/api/operator/releases/:slug/schedule':'/api/operator/roadmap-updates/:id/schedule'
  const column=release?'release_id':'roadmap_update_id'
  const target=release?'SELECT id,author_operator_id FROM releases WHERE slug=?':"SELECT id,author_operator_id FROM roadmap_update_versions WHERE id=?"
  const eligible=release?"state='draft'":'published_at IS NULL AND discarded_at IS NULL'
  app.get(path,c=>loopMutation(c,async()=>{
   const db=await decisionDatabase(c.get('runtime'),c.req.raw),key=c.req.param(release?'slug':'id')
   const item=await db.prepare(target).bind(key).first<{id:string}>()
   if(!item)throw new MutationError(404,'Publication not found.')
   const schedule=await db.prepare(`SELECT id,scheduled_at AS scheduledAt,time_zone AS timeZone,state,last_error AS lastError FROM penny_publication_schedules WHERE ${column}=?`).bind(item.id).first()
   return c.json({timezone:(await workspaceClock(c.get('runtime'))).timezone,schedule})
  }))
  app.post(path,c=>loopMutation(c,async(actor,now)=>{
   const value=await parseMutationBody(c,input);if(!value)return c.json({message:'Choose a local publication date and time.'},400)
   const db=c.get('runtime').database.binding,key=c.req.param(release?'slug':'id')
   const timeZone=(await workspaceClock(c.get('runtime'))).timezone,scheduledAt=publicationInstant(value.localTime,timeZone)
   if(Date.parse(scheduledAt)<=Date.now())throw new MutationError(422,'Choose a publication time in the future.')
   const id=crypto.randomUUID()
   const result=await db.batch([
    db.prepare(`INSERT INTO penny_publication_schedules(id,${column},author_operator_id,scheduled_by_operator_id,scheduled_at,time_zone,state,created_at,updated_at)
     SELECT ?,id,author_operator_id,?,?,?,'scheduled',?,? FROM (${target} AND ${eligible}) WHERE true
     ON CONFLICT(${column}) DO UPDATE SET id=excluded.id,author_operator_id=excluded.author_operator_id,scheduled_by_operator_id=excluded.scheduled_by_operator_id,
     scheduled_at=excluded.scheduled_at,time_zone=excluded.time_zone,state='scheduled',last_error=NULL,dismissed_at=NULL,completed_at=NULL,created_at=excluded.created_at,updated_at=excluded.updated_at`).bind(id,actor,scheduledAt,timeZone,now,now,key),
    db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
     SELECT ?,'operator',?,'publication.scheduled','publication_schedule',id,?,?,? FROM penny_publication_schedules WHERE id=?`).bind(crypto.randomUUID(),actor,now,now,now,id),
   ])
   if(!result[0].meta.changes)throw new MutationError(409,'Only an unpublished draft can be scheduled.')
   return c.json({id,scheduledAt,timeZone,state:'scheduled'})
  }))
  app.post(path+'/cancel',c=>loopMutation(c,async(actor,now)=>{
   const db=c.get('runtime').database.binding,key=c.req.param(release?'slug':'id')
   await db.batch([
    db.prepare(`UPDATE penny_publication_schedules SET state='cancelled',completed_at=?,updated_at=? WHERE ${column}=(SELECT id FROM (${target})) AND state='scheduled'`).bind(now,now,key),
    db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at)
     SELECT ?,'operator',?,'publication.unscheduled','publication_schedule',id,?,?,? FROM penny_publication_schedules WHERE ${column}=(SELECT id FROM (${target})) AND changes()>0`).bind(crypto.randomUUID(),actor,now,now,now,key),
   ])
   return c.json({ok:true})
  }))
 }
}
