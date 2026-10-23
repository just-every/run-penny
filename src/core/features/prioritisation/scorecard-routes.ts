import type {Hono} from 'hono'
import {z} from 'zod'
import {MutationError,parseMutationBody,type OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {evidenceMutation} from '../evidence/admission'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {NativeError} from '../auth/native-tokens'
import {scorecardId,scorecardInput,scoreInput} from './scorecard-model'
import {listScorecards,readScorecard,saveScorecard,saveScores} from './scorecard-repository'
function key(value:string){const parsed=scorecardId.safeParse(value);if(!parsed.success)throw new MutationError(400,'Invalid scorecard identifier.');return parsed.data}
export function registerScorecardRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/scorecards',c=>evidenceMutation(c,async(_actor,_now,db)=>{const {session}=await integrationOperator(c.get('runtime'),c.req.raw);return c.json({cards:await listScorecards(db),canDefine:['owner','admin'].includes(session.operator.role)})}))
 app.get('/api/operator/scorecards/:id',c=>evidenceMutation(c,async(actor,_now,db)=>{const {session}=await integrationOperator(c.get('runtime'),c.req.raw);return c.json(await readScorecard(db,key(c.req.param('id')),actor,['owner','admin'].includes(session.operator.role)))}))
 for(const method of ['post','put'] as const)app[method](`/api/operator/scorecards${method==='put'?'/:id':''}`,c=>evidenceMutation(c,async(actor,now)=>{
  const input=await parseMutationBody(c,method==='put'?scorecardInput.extend({revision:z.number().int().positive()}):scorecardInput)
  if(!input)return c.json({error:'validation_failed'},400)
  const runtime=c.get('runtime'),{session}=await integrationOperator(runtime,c.req.raw)
  if(!['owner','admin'].includes(session.operator.role))throw new NativeError('scorecard_definition_forbidden',403)
  const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role IN('owner','admin'))";guard.params.push(session.operatorId)
  const {revision,...definition}=input as z.infer<typeof scorecardInput>&{revision?:number}
  const saved=await saveScorecard(guardedDatabase(runtime.database.binding,guard),method==='put'?key(c.req.param('id')):null,definition,actor,now,revision)
  return c.json(saved,method==='post'?201:200)
 }))
 app.put('/api/operator/scorecards/:id/ideas/:idea',c=>evidenceMutation(c,async(actor,now,db)=>{const input=await parseMutationBody(c,scoreInput);if(!input)return c.json({error:'validation_failed'},400);return c.json(await saveScores(db,key(c.req.param('id')),key(c.req.param('idea')),input.versionId,input.values,actor,now))}))
}
