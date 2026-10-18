import type {Hono} from 'hono'
import {z} from 'zod'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {workspaceClock} from '../settings/workspace-clock'
import {readPlanning,savePlan,setDependency} from './repository'
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v)
const plan=z.object({name:z.string().trim().min(1).max(160),releaseDate:date,itemIds:z.array(id).max(200),revision:z.number().int().positive().optional()}).strict()
export function registerPlanningRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/release-planning',c=>evidenceMutation(c,async(_actor,now,db)=>{
  const clock=await workspaceClock(c.get('runtime'))
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:clock.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now))
  const part=(type:string)=>parts.find(p=>p.type===type)!.value
  return c.json(await readPlanning(db,`${part('year')}-${part('month')}-${part('day')}`))
 }))
 app.post('/api/operator/release-planning',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,plan);if(!input)return c.json({error:'validation_failed'},400);return c.json(await savePlan(db,null,input,actor,now),201)}))
 app.put('/api/operator/release-planning/:id',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,plan),key=id.safeParse(c.req.param('id'));if(!input||!key.success)return c.json({error:'validation_failed'},400);return c.json(await savePlan(db,key.data,input,actor,now))}))
 app.put('/api/operator/roadmap-dependency',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,z.object({blockerId:id,dependentId:id,linked:z.boolean()}).strict());if(!input)return c.json({error:'validation_failed'},400);await setDependency(db,input.blockerId,input.dependentId,input.linked,actor,now);return c.json({ok:true})}))
}
