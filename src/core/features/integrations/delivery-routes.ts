import {revokeConfiguration} from './revocation'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {z} from 'zod'
import {parseInput} from '../auth/native-routes'
import {createDestination,destinationInput,integrationOperator} from './destinations'
import {receiveWebhook} from './receiver'
import {deliveryNamespace} from './delivery'
import {IntegrationsRepository} from '../../../../base/modules/integrations/core/repository.ts'
import {D1SqlDatabase} from '../../../../base/modules/integrations/core/database.ts'
export function registerDeliveryRoutes(app:Hono<OperatorMutationEnvironment>) {
 app.get('/api/operator/integrations/destinations',async c=>{
  const runtime=c.get('runtime'),{db}=await integrationOperator(runtime,c.req.raw)
  const {results:destinations}=await db.prepare('SELECT id,name,kind,events_json,created_at,revoked_at FROM penny_integration_destinations ORDER BY created_at,id').all()
  const {results:deliveries}=await db.prepare('SELECT id,state,attempts,next_at FROM integration_deliveries WHERE namespace=? ORDER BY created_at DESC LIMIT 100').bind(deliveryNamespace).all()
  const {results:attempts}=await db.prepare('SELECT delivery_id,number,started_at,finished_at,outcome FROM integration_attempts WHERE namespace=? ORDER BY started_at DESC LIMIT 100').bind(deliveryNamespace).all()
  return c.json({destinations,deliveries,attempts,transport:runtime.bindings.PENNY_EGRESS?'configured':'configuration-disabled'})
 })
 app.post('/api/operator/integrations/destinations',async c=>c.json(await createDestination(c.get('runtime'),c.req.raw,await parseInput(c.req.raw,destinationInput)),201))
 app.delete('/api/operator/integrations/destinations/:id',async c=>{await revokeConfiguration(c.get('runtime'),c.req.raw,c.req.param('id'),'destination');return c.json({revoked:true})})
 app.post('/api/operator/integrations/deliveries/:id/reconcile',async c=>{
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw),input=await parseInput(c.req.raw,z.object({outcome:z.enum(['accepted','rejected']),evidenceCode:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)}).strict())
  await new IntegrationsRepository(new D1SqlDatabase(db),deliveryNamespace).resolve(c.req.param('id'),{kind:input.outcome,code:input.evidenceCode},Date.now())
  return c.json({reconciled:true})
 })
 app.post('/api/integrations/webhooks/:id',async c=>c.json(await receiveWebhook(c.get('runtime'),c.req.raw,c.req.param('id'))))
}
