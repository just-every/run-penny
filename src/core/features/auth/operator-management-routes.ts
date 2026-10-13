import type { Hono } from 'hono'
import { z } from 'zod'
import { AuthError } from '../../../../base/modules/operator-auth/index.mjs'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { parseInput } from './native-routes'
import { inviteOperator, listManagedOperators, managementActor, removeOperator } from './operator-management'

export function registerOperatorManagementRoutes(app:Hono<OperatorMutationEnvironment>) {
  app.use('/api/operator/settings/operators*',async(c,next)=>{c.header('Cache-Control','no-store');await next()})
  app.get('/api/operator/settings/operators',async c=>{
    const runtime=c.get('runtime'),{session}=await managementActor(runtime,c.req.raw)
    return c.json({operators:await listManagedOperators(runtime,session)})
  })
  app.post('/api/operator/settings/operators',async c=>{
    const runtime=c.get('runtime'),{session}=await managementActor(runtime,c.req.raw)
    const input=await parseInput(c.req.raw,z.object({email:z.string().trim().toLowerCase().email().max(254)}).strict())
    try {await inviteOperator(runtime,c.req.raw,input,session);return c.json({status:'accepted'},202)}
    catch(error){if(error instanceof AuthError)return c.json({error:error.code},error.status as 400|401|403|409|429|503);throw error}
  })
  app.delete('/api/operator/settings/operators/:id',async c=>{
    const runtime=c.get('runtime'),{session}=await managementActor(runtime,c.req.raw)
    const id=z.string().uuid().safeParse(c.req.param('id'))
    if(!id.success)return c.json({error:'validation_failed'},400)
    await parseInput(c.req.raw,z.object({}).strict())
    return c.json(await removeOperator(runtime,session,id.data))
  })
}
