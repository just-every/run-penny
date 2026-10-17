import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {parseInput} from '../auth/native-routes'
import {createUlid} from '@/core/shared/ulid'
import {queueNotificationWork} from '../notifications/queue'
import {workspaceClock,workspaceClockInput,saveWorkspaceClock} from './workspace-clock'

export function registerWorkspaceClockRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/workspace-clock',async c=>{
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw)
  return c.json({...await workspaceClock(runtime),owner:session.operator.role==='owner',canConfigure:['owner','admin'].includes(session.operator.role)})
 })
 app.put('/api/operator/settings/workspace-clock',async c=>{
  const runtime=c.get('runtime'),input=await parseInput(c.req.raw,workspaceClockInput),{session,actor}=await integrationOperator(runtime,c.req.raw)
  if(!['owner','admin'].includes(session.operator.role))throw new NativeError('workspace_settings_role_required',403)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role IN ('owner','admin'))";guard.params.push(session.operatorId)
  const db=guardedDatabase(runtime.database.binding,guard),now=new Date().toISOString()
  await db.batch([saveWorkspaceClock(db,input,now),db.prepare("INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'workspace.clock_saved','settings','workspace-clock',?,?,?)").bind(createUlid(),actor.id,now,now,now)])
  // Cron remains the backstop if this immediate wakeup cannot be accepted.
  try{await queueNotificationWork(runtime)}catch{console.error('Workspace clock saved; mail wakeup failed')}
  return c.json({saved:true})
 })
}
