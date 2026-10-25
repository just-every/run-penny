import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {hasOperatorSession} from '../auth/operator'
import {integrationOperator} from '../integrations/destinations'
import {readPerson} from './read'
export function registerPeopleRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/people/:id',async c=>{
  c.header('Cache-Control','private, no-store')
  if(!await hasOperatorSession(c.get('runtime'),c.req.raw))return c.json({error:'not_found'},404)
  const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/).safeParse(c.req.param('id'))
  if(!id.success)return c.json({error:'not_found'},404)
  const {db}=await integrationOperator(c.get('runtime'),c.req.raw)
  const exists=await db.prepare('SELECT 1 FROM requesters WHERE id=?').bind(id.data).first()
  if(!exists)return c.json({error:'not_found'},404)
  return c.json(await readPerson(db,id.data))
 })
}
