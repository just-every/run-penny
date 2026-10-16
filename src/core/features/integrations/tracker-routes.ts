import {integrationAvailable} from './transport'
import {revokeConfiguration} from './revocation'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {parseInput} from '../auth/native-routes'
import {integrationOperator} from './destinations'
import {createTrackerConnection,trackerConnectionInput} from './tracker-configuration'
import {createTracker,linkTracker,trackerCreateInput,trackerLinkInput} from './tracker-service'
import {receiveTracker} from './tracker-receiver'
import {trackerNamespace} from './tracker-delivery'
import {linearTeams} from './tracker-linear'
import {z} from 'zod'
export function registerTrackerRoutes(app:Hono<OperatorMutationEnvironment>) {
 app.get('/api/operator/integrations/trackers',async c=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw)
  const {results:connections}=await db.prepare('SELECT id,name,provider,project_identity,site_origin,created_at,revoked_at FROM penny_tracker_connections ORDER BY created_at,id').all()
  const {results:links}=await db.prepare('SELECT * FROM penny_tracker_links ORDER BY created_at DESC LIMIT 100').all()
  const {results:commands}=await db.prepare('SELECT c.id,c.request_id,c.decision_id,c.connection_id,c.link_id,c.held,d.state,d.attempts FROM penny_tracker_commands c LEFT JOIN integration_deliveries d ON d.namespace=? AND d.id=c.id ORDER BY c.created_at DESC LIMIT 100').bind(trackerNamespace).all()
  return c.json({connections,links,commands,transport:integrationAvailable(c.get('runtime'))?'configured':'configuration-disabled'})
 })
 app.get('/api/operator/integrations/trackers/request/:id',async c=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw)
  const {results:links}=await db.prepare('SELECT id,provider,issue_url,state,source_updated_at FROM penny_tracker_links WHERE request_id=? ORDER BY created_at,id').bind(c.req.param('id')).all()
  return c.json({links})
 })
 // Setup asks only for the personal API key; Penny lists the teams by name.
 app.post('/api/operator/integrations/trackers/linear/teams',async c=>{await integrationOperator(c.get('runtime'),c.req.raw);const input=await parseInput(c.req.raw,z.object({apiKey:z.string().trim().min(1).max(4096).regex(/^[^\r\n\0]+$/)}).strict());return c.json(await linearTeams(input.apiKey))})
 app.post('/api/operator/integrations/trackers/connections',async c=>c.json(await createTrackerConnection(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,trackerConnectionInput)),201))
 app.delete('/api/operator/integrations/trackers/connections/:id',async c=>{await revokeConfiguration(c.get('runtime'),c.req.raw,c.req.param('id'),'tracker');return c.json({revoked:true})})
 app.post('/api/operator/integrations/trackers/links',async c=>c.json(await linkTracker(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,trackerLinkInput)),201))
 app.post('/api/operator/integrations/trackers/create',async c=>c.json(await createTracker(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,trackerCreateInput)),202))
 app.post('/api/operator/integrations/trackers/commands/:id/reconcile',async c=>c.json(await linkTracker(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,trackerLinkInput),c.req.param('id'))))
 app.post('/api/integrations/trackers/:id',async c=>c.json(await receiveTracker(c.get('runtime'),c.req.raw,c.req.param('id'))))
}
