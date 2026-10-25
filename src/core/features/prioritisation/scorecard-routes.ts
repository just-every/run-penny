import type {Hono} from 'hono'
import {z} from 'zod'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {listScorecards,readScorecard,saveScorecard,scoreIdea,scorecardInput,scoreInput} from './scorecards'
const id=z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)
export function registerScorecardRoutes(app:Hono<OperatorMutationEnvironment>){
 const configure=async(c:Parameters<typeof integrationOperator>[1],runtime:Parameters<typeof integrationOperator>[0])=>{
  const authority=await integrationOperator(runtime,c)
  if(!['owner','admin'].includes(authority.session.operator.role))throw new NativeError('forbidden',403)
 }
 app.get('/api/operator/scorecards',c=>evidenceMutation(c,async(actor,_now,db)=>{
  const {session}=await integrationOperator(c.get('runtime'),c.req.raw)
  return c.json({cards:await listScorecards(db),scorerId:actor,canConfigure:['owner','admin'].includes(session.operator.role)})
 }))
 app.get('/api/operator/scorecards/:id',c=>evidenceMutation(c,async(actor,_now,db)=>{const key=id.safeParse(c.req.param('id'));if(!key.success)return c.json({error:'validation_failed'},400);return c.json(await readScorecard(db,key.data,actor))}))
 app.post('/api/operator/scorecards',c=>evidenceMutation(c,async(actor,now,db)=>{
  await configure(c.req.raw,c.get('runtime'));const input=await parseMutationBody(c,scorecardInput);if(!input)return c.json({error:'validation_failed'},400)
  return c.json(await saveScorecard(db,null,input,actor,now),201)
 }))
 app.put('/api/operator/scorecards/:id',c=>evidenceMutation(c,async(actor,now,db)=>{
  await configure(c.req.raw,c.get('runtime'));const input=await parseMutationBody(c,scorecardInput.extend({revision:z.number().int().positive()})),key=id.safeParse(c.req.param('id'));if(!input||!key.success)return c.json({error:'validation_failed'},400)
  const {revision,...definition}=input;return c.json(await saveScorecard(db,key.data,definition,actor,now,revision))
 }))
 app.put('/api/operator/scorecards/:id/scores/:scorer',c=>evidenceMutation(c,async(actor,now,db)=>{
  if(c.req.param('scorer')!==actor)return c.json({error:'forbidden'},403)
  const input=await parseMutationBody(c,scoreInput),key=id.safeParse(c.req.param('id'));if(!input||!key.success)return c.json({error:'validation_failed'},400)
  return c.json(await scoreIdea(db,key.data,input,actor,now))
 }))
}
