import type {Hono} from 'hono'
import {z} from 'zod'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {readHierarchy,saveHierarchy,linkFeature} from './repository'
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
const input=z.object({name:z.string().trim().min(1).max(160),parentId:id.optional()}).strict()
export function registerHierarchyRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/hierarchy',c=>evidenceMutation(c,async(_actor,_now,db)=>c.json(await readHierarchy(db))))
 for(const kind of ['product','component','feature'] as const){
  app.post(`/api/operator/hierarchy/${kind}`,c=>evidenceMutation(c,async(actor,now,db)=>{const value=await parseMutationBody(c,input);if(!value)return c.json({error:'validation_failed'},400);return c.json(await saveHierarchy(db,kind,null,value,actor,now),201)}))
  app.patch(`/api/operator/hierarchy/${kind}/:id`,c=>evidenceMutation(c,async(actor,now,db)=>{const value=await parseMutationBody(c,input),key=id.safeParse(c.req.param('id'));if(!value||!key.success)return c.json({error:'validation_failed'},400);return c.json(await saveHierarchy(db,kind,key.data,value,actor,now))}))
 }
 app.put('/api/operator/hierarchy/feature/:id/link',c=>evidenceMutation(c,async(actor,now,db)=>{const value=await parseMutationBody(c,z.object({kind:z.enum(['request','roadmap']),targetId:id,linked:z.boolean()}).strict()),key=id.safeParse(c.req.param('id'));if(!value||!key.success)return c.json({error:'validation_failed'},400);await linkFeature(db,key.data,value.kind,value.targetId,value.linked,actor,now);return c.json({ok:true})}))
}
