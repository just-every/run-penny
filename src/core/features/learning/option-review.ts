import type {z} from 'zod'
import type {PennyRuntime} from '@/core/app/runtime'
import {integrationOperator} from '../integrations/destinations'
import {NativeError} from '../auth/native-tokens'
import {context,assertScope,scopedDatabase} from './authority'
import {optionReviewInput,type Artifact} from './schema'
import {learningAudit} from './audit'
import {redactionSettings,redactionFence} from '../redaction/settings'
import {redactLearningValue} from './redaction'

/** An operator review is separate from the model's immutable explanation and
 * from a commitment. Rejecting one option preserves every original and link. */
export async function rejectOption(runtime:PennyRuntime,request:Request,investigationId:string,input:z.infer<typeof optionReviewInput>){
 const {db:operatorDb,actor}=await integrationOperator(runtime,request)
 const {i,s}=await context(operatorDb,investigationId),db=scopedDatabase(operatorDb,i,s)
 await assertScope(operatorDb,i,s)
 const artifact=await db.prepare("SELECT * FROM learning_artifacts WHERE id=? AND investigation_id=? AND version=? AND state='current'").bind(input.interpretationId,i.id,input.interpretationVersion).first<Artifact>()
 if(!artifact)throw new NativeError('learning_interpretation_stale',409)
 const body=JSON.parse(artifact.body_json)
 if(!body.options.some((option:{id:string})=>option.id===input.optionId))throw new NativeError('learning_option_unknown',409)
 if(await db.prepare('SELECT id FROM learning_option_reviews WHERE artifact_id=? AND option_id=?').bind(artifact.id,input.optionId).first())throw new NativeError('learning_option_already_rejected',409)
 const rules=await redactionSettings(db),fence=redactionFence(db,rules.revision)
 const reason=redactLearningValue({reason:input.reason},rules).reason
 const id=crypto.randomUUID(),guard=crypto.randomUUID(),now=new Date().toISOString()
 await db.batch([
  fence.before,
  db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(
   SELECT 1 FROM learning_artifacts a,json_each(a.body_json,'$.options') o
   WHERE a.id=? AND a.investigation_id=? AND a.version=? AND a.state='current'
    AND json_extract(o.value,'$.id')=?
    AND NOT EXISTS(SELECT 1 FROM learning_option_reviews r WHERE r.artifact_id=a.id AND r.option_id=?)
  ))`).bind(guard,artifact.id,i.id,input.interpretationVersion,input.optionId,input.optionId),
  db.prepare('INSERT INTO learning_option_reviews(id,investigation_id,artifact_id,artifact_version,option_id,reason,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,i.id,artifact.id,artifact.version,input.optionId,reason,actor.id,now),
  learningAudit(db,{operatorId:actor.id},'learning_investigation',i.id,'learning.option_rejected',{reviewId:id,interpretationId:artifact.id,interpretationVersion:artifact.version,optionId:input.optionId}),
  db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard),
  fence.after,
 ])
 return {id}
}
