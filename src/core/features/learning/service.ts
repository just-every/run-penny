import {guardedDatabase} from '../integrations/guarded-database'
import {assertSourceTargets} from './erasure-fences'
import {learningConfiguration} from './configuration'
import type {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {sourceInput,investigationInput,commitInput,type Artifact} from './schema'
import {context,assertScope,scopedDatabase} from './authority'
import {configuration} from './ports'
import {learningAudit} from './audit'
import {artifactPresentation} from './presentation'
import type {Observation} from './schema'
import {redactionSettings,redactionFence} from '../redaction/settings'
import {redactLearningValue} from './redaction'
import {canonical} from '../data/archive'
import {observationOriginal} from './source-content'
export async function createSource(runtime:PennyRuntime,request:Request,input:z.infer<typeof sourceInput>){
 const {db:operatorDb,actor}=await integrationOperator(runtime,request),db=await configurationDatabase(operatorDb),id=crypto.randomUUID()
 const rules=await redactionSettings(db),fence=redactionFence(db,rules.revision)
 input={...input,...redactLearningValue({name:input.name,useBasis:input.useBasis},rules)}
 await assertSourceTargets(db,input.provider,learningConfiguration(runtime).orbit?.installationId??null,input.resourceIds)
 await db.batch([fence.before,db.prepare("INSERT INTO learning_sources(id,name,provider,installation_id,resource_ids_json,use_basis,state,created_at) VALUES(?,?,?,?,?,?,'active',?)").bind(id,input.name,input.provider,learningConfiguration(runtime).orbit?.installationId??null,JSON.stringify([...new Set(input.resourceIds)]),input.useBasis,new Date().toISOString()),learningAudit(db,{operatorId:actor.id},'learning_source',id,'learning.source_created',{provider:input.provider,resourceCount:new Set(input.resourceIds).size}),fence.after])
 return {id}
}
export async function createInvestigation(runtime:PennyRuntime,request:Request,input:z.infer<typeof investigationInput>){
 const {db,session,actor}=await integrationOperator(runtime,request)
 return createNativeInvestigation({db,nativeId:session.operatorId,version:session.operator.version,actorId:actor.id},input)
}
export async function createNativeInvestigation(who:{db:D1Database;nativeId:string;version:number;actorId:string},input:z.infer<typeof investigationInput>){
 const db=await configurationDatabase(who.db),id=crypto.randomUUID(),now=new Date().toISOString(),sourceId=input.sourceId??crypto.randomUUID(),actor={id:who.actorId}

 const rules=await redactionSettings(db),fence=redactionFence(db,rules.revision)
 input={...input,...redactLearningValue({question:input.question,purpose:input.purpose},rules)}
 if(input.expiresAt<=now||input.maxRunCostMicros>input.budgetMicros||(!input.sourceId&&!input.nativeEvidenceIds.length&&!input.nativeRequestIds.length))throw new NativeError('learning_scope_invalid',400)
 const statements:D1PreparedStatement[]=[]
 if(!input.sourceId)statements.push(db.prepare("INSERT INTO learning_sources(id,name,provider,installation_id,resource_ids_json,use_basis,state,created_at) VALUES(?,'Native feedback','native','native','[]',?,'active',?)").bind(sourceId,input.purpose,now),learningAudit(db,{operatorId:actor.id},'learning_source',sourceId,'learning.source_created',{provider:'native'}))
 else if(!await db.prepare("SELECT 1 FROM learning_sources WHERE id=? AND state='active'").bind(sourceId).first())throw new NativeError('learning_source_unavailable',409)
 for(const [table,ids] of [['evidence_items',input.nativeEvidenceIds],['requests',input.nativeRequestIds]] as const){if(ids.length){const rows=await db.prepare(`SELECT id FROM ${table} WHERE id IN(SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all();if(rows.results.length!==new Set(ids).size)throw new NativeError('learning_native_evidence_missing',409)}}
 statements.push(db.prepare(`INSERT INTO learning_investigations(id,source_id,question,purpose,native_evidence_ids_json,native_request_ids_json,state,native_operator_id,operator_version,actor_id,expires_at,budget_micros,max_run_cost_micros,interval_minutes,next_run_at,created_at) VALUES(?,?,?,?,?,?,'active',?,?,?,?,?,?,?,?,?)`).bind(id,sourceId,input.question,input.purpose,JSON.stringify([...new Set(input.nativeEvidenceIds)]),JSON.stringify([...new Set(input.nativeRequestIds)]),who.nativeId,who.version,actor.id,input.expiresAt,input.budgetMicros,input.maxRunCostMicros,input.intervalMinutes,now,now))
 statements.push(learningAudit(db,{operatorId:actor.id},'learning_investigation',id,'learning.grant_created',{sourceId,evidenceCount:new Set(input.nativeEvidenceIds).size,requestCount:new Set(input.nativeRequestIds).size}))
 await db.batch([fence.before,...statements,fence.after]);return {id}
}
export async function commit(runtime:PennyRuntime,request:Request,id:string,input:z.infer<typeof commitInput>){
 const {db:operatorDb,actor}=await integrationOperator(runtime,request),{i,s}=await context(operatorDb,id),db=scopedDatabase(operatorDb,i,s)
 const rules=await redactionSettings(db),fence=redactionFence(db,rules.revision)
 input={...input,...redactLearningValue({rationale:input.rationale,...(input.protocol?{protocol:input.protocol}:{})},rules)}
 await assertScope(db,i,s)
 const artifact=await db.prepare("SELECT * FROM learning_artifacts WHERE id=? AND investigation_id=? AND state='current'").bind(input.interpretationId,id).first<Artifact>()
 if(!artifact)throw new NativeError('learning_interpretation_stale',409)
 const body=JSON.parse(artifact.body_json);if(input.protocol)body.protocol=input.protocol;const option=body.options.find((o:{id:string})=>o.id===input.optionId)
 if(!option||input.reviewAt<=new Date().toISOString()||Object.values(body.protocol).some(value=>value===null)||body.protocol.denominator<1||body.protocol.budgetMicros>i.budget_micros)throw new NativeError('learning_commitment_incomplete',409)
 const observations=(await db.prepare('SELECT o.* FROM learning_observations o JOIN learning_contributions c ON c.observation_id=o.id WHERE c.artifact_id=?').bind(artifact.id).all<Observation>()).results
 // Never manufacture a redacted snapshot that disagrees with its immutable
 // originals. Refresh under current rules before making another copied record.
 if(rules.enabled&&(canonical(redactLearningValue(body,rules))!==canonical(body)||observations.some(o=>{const original=JSON.parse(o.original_json);return (observationOriginal(o)?.redactionRevision??original.pennyRetained?.redactionRevision)!==rules.revision})))throw new NativeError('learning_redaction_refresh_required',409)
 const snapshot={interpretationId:artifact.id,interpretationVersion:artifact.version,selectedOption:option,declinedOptions:body.options.filter((o:{id:string})=>o.id!==input.optionId),protocol:body.protocol,rationale:input.rationale,confidence:input.confidence,reviewAt:input.reviewAt,ownerOperatorId:actor.id,interpretation:body,observations,status:'committed; outcome not yet observed'}
 const commitmentId=crypto.randomUUID(),guardId=crypto.randomUUID()
 await db.batch([fence.before,db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM learning_artifacts a JOIN learning_investigations i ON i.id=a.investigation_id JOIN learning_sources s ON s.id=i.source_id WHERE a.id=? AND a.state='current' AND i.version=? AND i.state='active' AND i.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND s.state='active'))").bind(guardId,artifact.id,i.version),db.prepare('INSERT INTO learning_commitments(id,investigation_id,artifact_id,snapshot_json,actor_id,created_at) VALUES(?,?,?,?,?,?)').bind(commitmentId,id,artifact.id,JSON.stringify(snapshot),actor.id,new Date().toISOString()),db.prepare('UPDATE learning_artifacts SET deferred=1 WHERE id=?').bind(artifact.id),learningAudit(db,{operatorId:actor.id},'learning_investigation',id,'learning.committed',{commitmentId,interpretationId:artifact.id}),db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guardId),fence.after])
 return {id:commitmentId}
}
export const investigationDto=(row:Record<string,unknown>)=>({id:row.id,sourceId:row.source_id,question:row.question,purpose:row.purpose,state:row.state,expiresAt:row.expires_at,budgetMicros:row.budget_micros,spentMicros:row.spent_micros,actualCostMicros:row.actual_cost_micros??0,reservedCostMicros:row.reserved_cost_micros??0,maxRunCostMicros:row.max_run_cost_micros,intervalMinutes:row.interval_minutes,nextRunAt:row.next_run_at,lastReason:row.last_reason,version:row.version})
export function artifactDto(row:Record<string,unknown>,observations:Observation[]=[],configured?:ReturnType<typeof learningConfiguration>['orbit']){const body=JSON.parse(String(row.body_json));return {id:row.id,investigationId:row.investigation_id,version:row.version,kind:'interpretation',state:row.state,createdAt:row.created_at,body,presentation:artifactPresentation(body,observations,configured)}}
function commitmentDto(row:Record<string,unknown>,configured?:ReturnType<typeof learningConfiguration>['orbit']){
 const body=JSON.parse(String(row.snapshot_json)),shown=artifactPresentation(body.interpretation,body.observations as Observation[],configured)
 return {id:row.id,investigationId:row.investigation_id,createdAt:row.created_at,body,ownerLabel:row.owner_label??'Former operator',citations:shown.citations,contradictions:shown.contradictions,kind:'commitment',invalidated:!!row.invalidation_reason,invalidationReason:row.invalidation_reason}
}
export async function overview(runtime:PennyRuntime,request:Request){
 const {db}=await integrationOperator(runtime,request)
 const result=await db.batch<Record<string,unknown>>([db.prepare('SELECT * FROM learning_sources ORDER BY created_at DESC LIMIT 101'),db.prepare("SELECT i.*,COALESCE((SELECT SUM(actual_micros) FROM learning_runs r WHERE r.investigation_id=i.id),0) actual_cost_micros,COALESCE((SELECT SUM(reserved_micros) FROM learning_runs r WHERE r.investigation_id=i.id AND r.state IN('running','uncertain')),0) reserved_cost_micros FROM learning_investigations i ORDER BY i.created_at DESC LIMIT 101"),db.prepare("SELECT * FROM learning_artifacts WHERE state='current' ORDER BY created_at DESC LIMIT 101"),db.prepare('SELECT c.*,o.display_name owner_label,x.reason invalidation_reason FROM learning_commitments c LEFT JOIN operators o ON o.id=c.actor_id LEFT JOIN learning_invalidations x ON x.commitment_id=c.id ORDER BY c.created_at DESC LIMIT 101')])
 if(result.some(r=>r.results.length>100))throw new NativeError('learning_list_limit',413)
 const artifacts=result[2].results,configured=learningConfiguration(runtime).orbit
 const observations=(await db.prepare('SELECT DISTINCT o.* FROM learning_observations o JOIN learning_contributions c ON c.observation_id=o.id WHERE c.artifact_id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(artifacts.map(a=>a.id))).all<Observation>()).results
 const dto=(a:Record<string,unknown>)=>artifactDto(a,observations,configured),needsYou=artifacts.filter(a=>!a.deferred).map(dto)
 return {configuration:configuration(runtime),sources:result[0].results.map(r=>({id:r.id,name:r.name,provider:r.provider,resourceIds:JSON.parse(String(r.resource_ids_json)),useBasis:r.use_basis,state:r.state,createdAt:r.created_at})),investigations:result[1].results.map(investigationDto),results:result[3].results.map(r=>commitmentDto(r,configured)),learning:artifacts.filter(a=>a.deferred).map(dto),needsYou}
}

async function configurationDatabase(db:D1Database){
 const epoch=await db.prepare('SELECT epoch FROM data_state WHERE singleton=1').first<number>('epoch')
 return guardedDatabase(db,{sql:"EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=? AND phase='idle')",params:[epoch!]})
}
