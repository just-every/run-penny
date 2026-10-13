import type { Hono } from 'hono'
import { z } from 'zod'
import { parseMutationBody,type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { evidenceMutation } from '../evidence/admission'
import { saveAccount } from './write-service'
const accountInput=z.object({name:z.string().trim().min(1).max(200),internalOwnerId:z.string().trim().min(1),revenueCents:z.number().int().min(0).nullable().optional(),renewalDate:z.string().nullable().optional(),health:z.string().trim().max(200).nullable().optional()}).strict()
export function registerAccountMutationRoutes(app:Hono<OperatorMutationEnvironment>){
 app.post('/api/operator/accounts',c=>evidenceMutation(c,async(actor,now,db)=>{
 const input=await parseMutationBody(c,accountInput);if(!input)return c.json({error:'validation_failed'},400)
 return c.json(await saveAccount(db,null,input,actor,now),201)
 }))
 app.patch('/api/operator/accounts/:id',c=>evidenceMutation(c,async(actor,now,db)=>{
 const input=await parseMutationBody(c,accountInput);if(!input)return c.json({error:'validation_failed'},400)
 return c.json(await saveAccount(db,c.req.param('id'),input,actor,now))
 }))
}
