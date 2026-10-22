import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {integrationOperator} from '../integrations/destinations'
import {guardedDatabase} from '../integrations/guarded-database'
import {sessionGuard} from '../integrations/keys'
import {audit} from '../decisions/write-support'
import {parseInput} from '../auth/native-routes'
import {NativeError,digest} from '../auth/native-tokens'
import {createUlid} from '@/core/shared/ulid'
import {redact} from './engine'
import {redactionSettings,redactionFence,rulesInput,validateRules} from './settings'
async function owner(runtime:Parameters<typeof integrationOperator>[0],request:Request){
 const {session,actor}=await integrationOperator(runtime,request)
 if(session.operator.role!=='owner')throw new NativeError('owner_required',403)
 const guard=sessionGuard(session);guard.sql+=" AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')";guard.params.push(session.operatorId)
 return {db:guardedDatabase(runtime.database.binding,guard),actor}
}
async function preview(db:D1Database){
 const settings=await redactionSettings(db)
 if(!settings.enabled)throw new NativeError('redaction_disabled',409,'Enable redaction before requesting a stored-evidence preview.')
 const rows=(await db.prepare('SELECT id,wording FROM evidence_versions ORDER BY id LIMIT 201').all<{id:string;wording:string}>()).results
 if(rows.length>200)throw new NativeError('redaction_reapply_limit',413,'This bounded reapplication supports up to 200 evidence versions. Larger stores need the pending paged reapplication flow.')
 let changes:{id:string;before:string;after:string}[]
 try{changes=rows.map(row=>({id:row.id,before:row.wording,after:redact(row.wording,settings)})).filter(row=>row.before!==row.after)}catch{throw new NativeError('redaction_limit',413)}
 return {settings,changes,records:rows.length,planHash:await digest(JSON.stringify({settings,rows}))}
}
export function registerRedactionRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/operator/settings/redaction',async c=>{const {db,session}=await integrationOperator(c.get('runtime'),c.req.raw);if(session.operator.role!=='owner')return c.json({canConfigure:false});return c.json({canConfigure:true,...await redactionSettings(db)})})
 app.put('/api/operator/settings/redaction',async c=>{
  const {db,actor}=await owner(c.get('runtime'),c.req.raw),input=validateRules(await parseInput(c.req.raw,rulesInput)),now=new Date().toISOString()
  await db.batch([db.prepare('INSERT INTO penny_redaction_settings(singleton,enabled,kinds_json,patterns_json,revision) VALUES(1,?,?,?,1) ON CONFLICT(singleton) DO UPDATE SET enabled=excluded.enabled,kinds_json=excluded.kinds_json,patterns_json=excluded.patterns_json,revision=revision+1').bind(input.enabled?1:0,JSON.stringify(input.kinds),JSON.stringify(input.patterns)),audit(db,actor.id,'settings','redaction','redaction.rules_changed',now)])
  return c.json({saved:true})
 })
 app.post('/api/operator/settings/redaction/preview',async c=>{const {db}=await owner(c.get('runtime'),c.req.raw);await parseInput(c.req.raw,z.object({}).strict());const plan=await preview(db);return c.json({records:plan.records,changes:plan.changes.length,planHash:plan.planHash,irreversible:true})})
 app.post('/api/operator/settings/redaction/reapply',async c=>{
  const {db,actor}=await owner(c.get('runtime'),c.req.raw),input=await parseInput(c.req.raw,z.object({planHash:z.string().regex(/^[a-f0-9]{64}$/),confirmIrreversible:z.literal(true)}).strict()),plan=await preview(db)
  if(plan.planHash!==input.planHash)throw new NativeError('redaction_preview_stale',409,'Evidence or rules changed. Preview the counts again before confirming.')
  const fence=redactionFence(db,plan.settings.revision),now=new Date().toISOString()
  const statements=plan.changes.flatMap(row=>{const guard=createUlid();return [db.prepare('INSERT INTO requester_write_guards(id,permitted) VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM evidence_versions WHERE id=? AND wording=?) THEN 1 ELSE 0 END)').bind(guard,row.id,row.before),db.prepare('UPDATE evidence_versions SET wording=?,updated_at=? WHERE id=?').bind(row.after,now,row.id),db.prepare('DELETE FROM requester_write_guards WHERE id=?').bind(guard)]})
  await db.batch([fence.before,...statements,audit(db,actor.id,'settings','redaction','redaction.reapplied',now,{versions:plan.changes.length}),fence.after])
  return c.json({changed:plan.changes.length,irreversible:true})
 })
}
