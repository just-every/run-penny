import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {validateFrameOrigins} from '@/core/platform/configuration'
import {integrationOperator} from '../integrations/destinations'
import {hostFrameOrigins} from '../auth/host-frames'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {z} from 'zod'
import {createUlid} from '@/core/shared/ulid'

export function registerFrameSettings(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/frames',async c=>{
  await integrationOperator(c.get('runtime'),c.req.raw)
  c.header('Cache-Control','no-store')
  return c.json({publicOriginAllowlist:await hostFrameOrigins(c.get('runtime'))})
 })
 app.put('/api/operator/settings/frames',async c=>{
  const runtime=c.get('runtime'),{db,actor}=await integrationOperator(runtime,c.req.raw)
  const input=await parseInput(c.req.raw,z.object({publicOriginAllowlist:z.array(z.string()).max(10)}).strict())
  let origins:string[]
  try{origins=validateFrameOrigins(input.publicOriginAllowlist,runtime.configuration.environment)}catch{throw new NativeError('invalid_frame_origins',400)}
  const now=new Date().toISOString()
  await db.batch([
   db.prepare('INSERT INTO penny_frame_settings(singleton,public_origin_allowlist,updated_at) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET public_origin_allowlist=excluded.public_origin_allowlist,updated_at=excluded.updated_at').bind(JSON.stringify(origins),now),
   db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'portal.frame_policy_replaced','settings','publicOriginAllowlist',?,?,?)").bind(createUlid(),actor.id,now,now,now),
  ])
  return c.json({publicOriginAllowlist:origins})
 })
}
