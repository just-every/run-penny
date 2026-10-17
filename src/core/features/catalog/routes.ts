import {integrationOperator} from '../integrations/destinations'
import type { Hono } from 'hono'
import { z } from 'zod'
import { mutationFailure, parseMutationBody, requireOperator, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { catalogWriteService } from './write-service'
export function registerCatalogMutationRoutes(app:Hono<OperatorMutationEnvironment>) {
  app.use('/api/operator/catalog/*',async(c,next)=>{if(!await requireOperator(c))return c.json({authenticated:false},401);c.header('Cache-Control','no-store');await next()})
  app.get('/api/operator/catalog/settings',async c=>{const db=c.get('runtime').database.binding;const [boards,tags,fields,categories]=await Promise.all([db.prepare('SELECT * FROM boards ORDER BY position,name').all(),db.prepare('SELECT * FROM tags ORDER BY name').all(),db.prepare('SELECT * FROM custom_field_definitions ORDER BY name').all(),db.prepare('SELECT * FROM request_categories ORDER BY position,name,id').all()]);return c.json({boards:boards.results,tags:tags.results,fields:fields.results,categories:categories.results})})
  app.post('/api/operator/catalog/tags',async c=>{const input=await parseMutationBody(c,z.object({name:z.string().trim().min(1).max(160)}).strict());if(!input)return c.json({error:'validation_failed'},400);try{return c.json(await (await catalogService(c)).createTag(input.name),201)}catch(e){return mutationFailure(c,e)}})
  app.patch('/api/operator/catalog/tags/:id',async c=>{const input=await parseMutationBody(c,z.object({name:z.string().trim().min(1).max(160)}).strict());if(!input)return c.json({error:'validation_failed'},400);try{await (await catalogService(c)).renameTag(c.req.param('id'),input.name);return c.json({ok:true})}catch(e){return mutationFailure(c,e)}})
  app.delete('/api/operator/catalog/tags/:id',async c=>{try{await (await catalogService(c)).deleteTag(c.req.param('id'));return c.body(null,204)}catch(e){return mutationFailure(c,e)}})
  app.post('/api/operator/catalog/tags/:id/merge',async c=>{const input=await parseMutationBody(c,z.object({targetId:z.string().min(1)}).strict());if(!input)return c.json({error:'validation_failed'},400);try{await (await catalogService(c)).mergeTags(c.req.param('id'),input.targetId);return c.json({ok:true})}catch(e){return mutationFailure(c,e)}})
  app.put('/api/operator/catalog/requests/:id/tags/:tag',async c=>{try{await (await catalogService(c)).applyRequestTag(c.req.param('id'),c.req.param('tag'));return c.json({ok:true})}catch(e){return mutationFailure(c,e)}})
  app.delete('/api/operator/catalog/requests/:id/tags/:tag',async c=>{try{await (await catalogService(c)).removeRequestTag(c.req.param('id'),c.req.param('tag'));return c.body(null,204)}catch(e){return mutationFailure(c,e)}})
  for(const method of ['put','delete'] as const) app[method]('/api/operator/evidence/:id/tag',async c=>{
    if(!await requireOperator(c))return c.json({authenticated:false},401)
    c.header('Cache-Control','no-store')
    const input=await parseMutationBody(c,z.object({tagId:z.string().trim().min(1).max(128)}).strict())
    if(!input)return c.json({error:'validation_failed'},400)
    try {
      const service=(await catalogService(c))
      if(method==='put')await service.applyEvidenceTag(c.req.param('id'),input.tagId)
      else await service.removeEvidenceTag(c.req.param('id'),input.tagId)
      return c.json({ok:true})
    }catch(error){return mutationFailure(c,error)}
  })

}

async function catalogService(c: Parameters<typeof requireOperator>[0]) {
 const {db,actor}=await integrationOperator(c.get('runtime'),c.req.raw)
 return catalogWriteService({binding:db},actor.id)
}
