import type {Hono} from 'hono'
import {parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {definitionInput,scorecardId,scoreInput,versionInput} from './input'
import {listScorecards,readScorecard,saveDefinition,saveScores} from './repository'
export function registerScorecardRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/scorecards',c=>evidenceMutation(c,async(_actor,_now,db)=>c.json(await listScorecards(db))))
 app.get('/api/operator/scorecards/:id',c=>evidenceMutation(c,async(_actor,_now,db)=>{
  const id=scorecardId.safeParse(c.req.param('id')),version=scorecardId.optional().safeParse(c.req.query('versionId'))
  if(!id.success||!version.success)return c.json({error:'validation_failed'},400)
  return c.json(await readScorecard(db,id.data,version.data))
 }))
 app.post('/api/operator/scorecards',c=>evidenceMutation(c,async(actor,now,db)=>{
  const input=await parseMutationBody(c,definitionInput);if(!input)return c.json({error:'validation_failed'},400)
  return c.json(await saveDefinition(db,null,input,actor,now),201)
 }))
 app.post('/api/operator/scorecards/:id/versions',c=>evidenceMutation(c,async(actor,now,db)=>{
  const id=scorecardId.safeParse(c.req.param('id')),input=await parseMutationBody(c,versionInput)
  if(!id.success||!input)return c.json({error:'validation_failed'},400)
  return c.json(await saveDefinition(db,id.data,input.definition,actor,now,input.previousVersionId),201)
 }))
 app.put('/api/operator/scorecards/:id/requests/:requestId/scores',c=>evidenceMutation(c,async(actor,now,db)=>{
  const id=scorecardId.safeParse(c.req.param('id')),requestId=scorecardId.safeParse(c.req.param('requestId')),input=await parseMutationBody(c,scoreInput)
  if(!id.success||!requestId.success||!input)return c.json({error:'validation_failed'},400)
  await saveScores(db,id.data,requestId.data,input.versionId,input.inputs,actor,now)
  return c.body(null,204)
 }))
}
