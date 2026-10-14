import {digest,NativeError} from '../auth/native-tokens'
import type {Row} from '../data/archive'
import {hash,canonical} from '../data/archive'
import {portabilityErasureStatements} from '../../../../scripts/portability/cleanup.mjs'
import {sourceEvent,sourcePerson} from './erasure-fences'
import {learningAudit,type LearningActor} from './audit'

/** Free text and downstream interpretations can quote a contribution without a
 * citation. Clear the affected scope, retaining independent original evidence. */
function redactScopes(db:D1Database,investigations:string[],sources:string[],evidence:unknown[]=[],requests:unknown[]=[]){
 const ids=JSON.stringify(investigations)
 return [
  db.prepare("UPDATE learning_sources SET name='Redacted source',use_basis='Contribution erased; review source use',version=version+1 WHERE id IN(SELECT value FROM json_each(?))").bind(JSON.stringify(sources)),
  db.prepare("UPDATE learning_investigations SET version=version+1,state='paused',question='',purpose='Contribution erased; review investigation purpose',last_reason='contribution_erased',native_evidence_ids_json=(SELECT COALESCE(json_group_array(value),'[]') FROM json_each(native_evidence_ids_json) WHERE value NOT IN(SELECT value FROM json_each(?))),native_request_ids_json=(SELECT COALESCE(json_group_array(value),'[]') FROM json_each(native_request_ids_json) WHERE value NOT IN(SELECT value FROM json_each(?))) WHERE id IN(SELECT value FROM json_each(?))").bind(JSON.stringify(evidence),JSON.stringify(requests),ids),
  db.prepare('DELETE FROM learning_artifacts WHERE investigation_id IN(SELECT value FROM json_each(?))').bind(ids),
  db.prepare("UPDATE learning_runs SET cursor_json='{}',state=CASE WHEN state='running' THEN 'uncertain' ELSE state END,reason='source_data_removed' WHERE investigation_id IN(SELECT value FROM json_each(?))").bind(ids),
 ]
}
/** Native erasure fences replay in the same transaction as configuration and
 * derived-copy redaction, including grants that have not acquired evidence yet. */
export async function learningErasureStatements(db:D1Database,selected:Record<string,Row[]>){
 const observations=selected.learning_observations??[],evidence=[...(selected.evidence_items??[]).map(row=>row.id),...observations.map(row=>row.evidence_id).filter(Boolean)],requests=[...(selected.requests??[]).map(row=>row.id),...observations.map(row=>row.request_id).filter(Boolean)]
 const scopes=(await db.prepare(`SELECT id,source_id FROM learning_investigations WHERE id IN(SELECT value FROM json_each(?)) OR EXISTS(SELECT 1 FROM json_each(native_evidence_ids_json) WHERE value IN(SELECT value FROM json_each(?))) OR EXISTS(SELECT 1 FROM json_each(native_request_ids_json) WHERE value IN(SELECT value FROM json_each(?)))`).bind(JSON.stringify(observations.map(row=>row.investigation_id)),JSON.stringify(evidence),JSON.stringify(requests)).all<{id:string;source_id:string}>()).results
 const statements=redactScopes(db,scopes.map(row=>row.id),[...new Set(scopes.map(row=>row.source_id))],evidence,requests)
 for(const row of observations)statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_events(source_id,event_hash) VALUES(?,?)').bind(row.source_id,await digest(String(row.event_key))))
 return statements
}
/** Source disconnection or external-subject erasure removes copies and all derived
 * contributions, advances the archive journal and preserves only opaque fences. */
export async function purge(db:D1Database,sourceId:string,{personId,actor,action}:{personId?:string;actor:LearningActor;action:'learning.source_disconnected'|'learning.person_erased'|'learning.provider_revoked'}){
 const source=await db.prepare('SELECT provider,installation_id FROM learning_sources WHERE id=?').bind(sourceId).first<{provider:string;installation_id:string|null}>()
 if(!source)throw new NativeError('learning_not_found',404)
 const query=personId?`SELECT o.* FROM learning_observations o JOIN learning_sources s ON s.id=o.source_id WHERE s.provider=? AND s.installation_id IS ? AND (o.source_person_id=? OR EXISTS(SELECT 1 FROM learning_source_people p WHERE p.observation_id=o.id AND p.source_person_id=?) OR json_extract(CASE WHEN json_valid(o.wording) THEN o.wording ELSE '{}' END,'$.contact_id')=? OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(o.wording) THEN o.wording ELSE '{}' END,'$.contacts') p WHERE json_extract(CASE WHEN p.type='object' THEN p.value ELSE '{}' END,'$.id')=?))`:`SELECT o.* FROM learning_observations o WHERE o.event_key IN(SELECT event_key FROM learning_observations WHERE source_id=?)`
 const queryParameters=personId?[source.provider,source.installation_id,personId,personId,personId,personId]:[sourceId]
 const observations=(await db.prepare(query).bind(...queryParameters).all<Row>()).results
 if(observations.length>500)throw new NativeError('learning_erasure_limit',413)
 const targets=new Set<string>(personId?[`contacts/${personId}`]:[])
 const prefix=sourceEvent(source.provider,source.installation_id,'')
 for(const row of observations)if(String(row.event_key).startsWith(prefix))targets.add(String(row.event_key).slice(prefix.length))
 const connections=(await db.prepare('SELECT id,resource_ids_json FROM learning_sources WHERE provider=? AND installation_id IS ?').bind(source.provider,source.installation_id).all<{id:string;resource_ids_json:string}>()).results
 const contaminated=connections.filter(row=>row.id===sourceId||JSON.parse(row.resource_ids_json).some((target:string)=>targets.has(target)))
 const scopes=(await db.prepare('SELECT id,source_id FROM learning_investigations WHERE source_id IN(SELECT value FROM json_each(?)) OR id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(contaminated.map(row=>row.id)),JSON.stringify(observations.map(row=>row.investigation_id))).all<{id:string;source_id:string}>()).results
 const state=(await db.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first<{origin:string;epoch:number}>())!,epoch=state.epoch+1,marker=await hash([state.origin,'learning_observations',canonical(['revoked',crypto.randomUUID()])])
 const statements=[...await portabilityErasureStatements(db),...redactScopes(db,scopes.map(row=>row.id),[...new Set(scopes.map(row=>row.source_id).concat(contaminated.map(row=>row.id)))],observations.map(row=>row.evidence_id).filter(Boolean),observations.map(row=>row.request_id).filter(Boolean)),db.prepare('INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(epoch,'learning_observations',marker)]
 for(const row of observations)statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_events(source_id,event_hash) VALUES(?,?)').bind(row.source_id,await digest(String(row.event_key))))
 if(personId){
  statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_people(source_id,person_hash) VALUES(?,?)').bind(sourceId,await digest(sourcePerson(source.provider,source.installation_id,personId))))
  for(const target of targets)statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_events(source_id,event_hash) VALUES(?,?)').bind(sourceId,await digest(sourceEvent(source.provider,source.installation_id,target))))
 }
 for(const connection of contaminated){const remaining=(JSON.parse(connection.resource_ids_json) as string[]).filter(target=>!targets.has(target));statements.push(db.prepare("UPDATE learning_sources SET resource_ids_json=?,state=CASE WHEN ?=0 AND provider='orbit' THEN 'disconnected' ELSE state END WHERE id=?").bind(JSON.stringify(remaining),remaining.length,connection.id))}
 statements.push(db.prepare('DELETE FROM learning_observations WHERE id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(observations.map(row=>row.id))))
 if(!personId){
  statements.push(db.prepare("UPDATE learning_investigations SET state='revoked',question='Revoked investigation',purpose='Revoked purpose',native_evidence_ids_json='[]',native_request_ids_json='[]',version=version+1,last_reason='source_revoked' WHERE source_id=?").bind(sourceId))
  statements.push(db.prepare("UPDATE learning_sources SET state='disconnected',version=version+1,name='Revoked source',resource_ids_json='[]',use_basis='Revoked source use' WHERE id=?").bind(sourceId))
 }
 statements.push(db.prepare("UPDATE data_state SET epoch=? WHERE singleton=1 AND epoch=? AND phase='idle'").bind(epoch,state.epoch))
 statements.push(learningAudit(db,actor,'learning_source',sourceId,action,{observationsRemoved:observations.length,investigationsAffected:scopes.length}))
 // A concurrent acquisition or new grant must not escape the read closure.
 // Refuse atomically if its canonical connection/scope/observation was not read.
 const guard=crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=? AND phase='idle') AND NOT EXISTS(SELECT 1 FROM learning_sources WHERE provider=? AND installation_id IS ? AND id NOT IN(SELECT value FROM json_each(?))) AND NOT EXISTS(SELECT 1 FROM learning_investigations WHERE source_id IN(SELECT value FROM json_each(?)) AND id NOT IN(SELECT value FROM json_each(?))) AND NOT EXISTS(SELECT 1 FROM (${query}) WHERE id NOT IN(SELECT value FROM json_each(?))))`).bind(guard,state.epoch,source.provider,source.installation_id,JSON.stringify(connections.map(row=>row.id)),JSON.stringify(contaminated.map(row=>row.id)),JSON.stringify(scopes.map(row=>row.id)),...queryParameters,JSON.stringify(observations.map(row=>row.id))),...statements,db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard)])
}
