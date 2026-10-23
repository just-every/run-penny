import type {Hono} from 'hono'
import {z} from 'zod'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {hasOperatorSession} from '../auth/operator'
import {decisionDatabase} from '../decisions/authority'
import {readPerson} from './repository'
const identifier=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
export function registerPeopleRoutes(app:Hono<OperatorMutationEnvironment>){
 // Conceal the document before the general app sign-in redirect handles it.
 app.use('/app/people/*',async(c,next)=>{if(!await hasOperatorSession(c.get('runtime'),c.req.raw))return c.json({error:'not_found'},404);c.header('Cache-Control','private, no-store');await next()})
 app.get('/api/operator/people/:id',async c=>{
  c.header('Cache-Control','private, no-store')
  if(!await hasOperatorSession(c.get('runtime'),c.req.raw))return c.json({error:'not_found'},404)
  const id=identifier.safeParse(c.req.param('id')),query=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().safeParse(c.req.query())
  if(!id.success||!query.success)return c.json({error:'validation_failed'},400)
  const person=await readPerson(await decisionDatabase(c.get('runtime'),c.req.raw),id.data,query.data.page)
  return person?c.json(person):c.json({error:'not_found'},404)
 })
}
