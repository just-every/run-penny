import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {audit} from '../decisions/write-support'
import {parseInput} from '../auth/native-routes'
import {NativeError} from '../auth/native-tokens'
import {redactionSettings,rulesInput,validateRules} from './settings'
import {confirmRun,dto,latestRun,readRun,resumeRun,startPreview} from './runs'
import {wakeRedaction} from './background'
async function owner(runtime:Parameters<typeof integrationOperator>[0],request:Request){
 const {session,actor}=await integrationOperator(runtime,request)
 if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
 const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
 return {db:guardedDatabase(runtime.database.binding,guard),actor,authority:{operatorId:session.operatorId,version:session.operator.version,actorId:actor.id}}
}
export function registerRedactionRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/redaction',async c=>{const {db,session}=await integrationOperator(c.get('runtime'),c.req.raw);if(session.operator.role!=='owner')return c.json({canConfigure:false});const run=await latestRun(db);return c.json({canConfigure:true,...await redactionSettings(db),latestRun:run?dto(run):null})})
 app.put('/api/operator/settings/redaction',async c=>{
  const {db,actor}=await owner(c.get('runtime'),c.req.raw),input=validateRules(await parseInput(c.req.raw,rulesInput)),now=new Date().toISOString()
  await db.batch([db.prepare('INSERT INTO penny_redaction_settings(singleton,enabled,kinds_json,patterns_json,revision) VALUES(1,?,?,?,1) ON CONFLICT(singleton) DO UPDATE SET enabled=excluded.enabled,kinds_json=excluded.kinds_json,patterns_json=excluded.patterns_json,revision=revision+1').bind(input.enabled?1:0,JSON.stringify(input.kinds),JSON.stringify(input.patterns)),audit(db,actor.id,'settings','redaction','redaction.rules_changed',now)])
  return c.json({saved:true})
 })
 app.post('/api/operator/settings/redaction/preview',async c=>{
  const runtime=c.get('runtime'),{db,authority}=await owner(runtime,c.req.raw);await parseInput(c.req.raw,z.object({}).strict())
  const run=await startPreview(db,authority);await wakeRedaction(runtime.bindings.JOBS);return c.json(dto(run),202)
 })
 app.get('/api/operator/settings/redaction/runs/:id',async c=>{const {db}=await owner(c.get('runtime'),c.req.raw),run=await readRun(db,c.req.param('id'));if(!run)throw new NativeError('redaction_run_not_found',404);return c.json(dto(run))})
 app.post('/api/operator/settings/redaction/reapply',async c=>{
  const runtime=c.get('runtime'),{db,authority}=await owner(runtime,c.req.raw),input=await parseInput(c.req.raw,z.object({planHash:z.string().regex(/^[a-f0-9]{64}$/),confirmIrreversible:z.literal(true)}).strict()),run=await confirmRun(db,input.planHash,authority)
  await wakeRedaction(runtime.bindings.JOBS);return c.json(dto(run),202)
 })
 app.post('/api/operator/settings/redaction/runs/:id/resume',async c=>{
  const runtime=c.get('runtime'),{db,authority}=await owner(runtime,c.req.raw);await parseInput(c.req.raw,z.object({}).strict())
  const run=await resumeRun(db,c.req.param('id'),authority);await wakeRedaction(runtime.bindings.JOBS);return c.json(dto(run),202)
 })
}
