import type {Hono} from 'hono'
import {z} from 'zod'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {comparisonRows} from './rows'
import {viewInput} from './formulas'
import {listViews,readView,saveView} from './repository'
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
export function registerPrioritisationRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/prioritisation/rows',c=>evidenceMutation(c,async(_actor,_now,db)=>{const entity=z.enum(['requests','features']).safeParse(c.req.query('entity'));if(!entity.success)return c.json({error:'validation_failed'},400);return c.json(await comparisonRows(db,entity.data))}))
 app.get('/api/operator/prioritisation',c=>evidenceMutation(c,async(actor,_now,db)=>c.json(await listViews(db,actor))))
 app.get('/api/operator/prioritisation/:id',c=>evidenceMutation(c,async(actor,_now,db)=>{const key=id.safeParse(c.req.param('id'));if(!key.success)return c.json({error:'validation_failed'},400);return c.json(await readView(db,key.data,actor))}))
 app.post('/api/operator/prioritisation',c=>evidenceMutation(c,async(actor,now,db)=>{const value=await parseMutationBody(c,viewInput);if(!value)return c.json({error:'validation_failed'},400);return c.json(await saveView(db,null,value,actor,now),201)}))
 app.put('/api/operator/prioritisation/:id',c=>evidenceMutation(c,async(actor,now,db)=>{const value=await parseMutationBody(c,viewInput.extend({revision:z.number().int().positive()})),key=id.safeParse(c.req.param('id'));if(!value||!key.success)return c.json({error:'validation_failed'},400);const {revision,...view}=value;return c.json(await saveView(db,key.data,view,actor,now,revision))}))
}
