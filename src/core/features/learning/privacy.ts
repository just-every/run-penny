import {digest,NativeError} from '../auth/native-tokens'
import type {Row} from '../data/archive'
import {hash,canonical} from '../data/archive'
import {portabilityErasureStatements} from '../../../../scripts/portability/cleanup.mjs'
/** Native erasure writes replay fences in the same transaction as the complete
 * contribution closure. A source refresh cannot reintroduce an erased event. */
export async function learningErasureStatements(db:D1Database,selected:Record<string,Row[]>){
 const statements:D1PreparedStatement[]=[]
 for(const row of selected.learning_observations??[]){statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_events(source_id,event_hash) VALUES(?,?)').bind(row.source_id,await digest(String(row.event_key))))}
 const affected=new Set((selected.learning_observations??[]).map(row=>String(row.investigation_id)))
 for(const id of affected)statements.push(db.prepare("UPDATE learning_investigations SET version=version+1,state='paused',last_reason='contribution_erased',native_evidence_ids_json=(SELECT COALESCE(json_group_array(value),'[]') FROM json_each(native_evidence_ids_json) WHERE value NOT IN(SELECT value FROM json_each(?))),native_request_ids_json=(SELECT COALESCE(json_group_array(value),'[]') FROM json_each(native_request_ids_json) WHERE value NOT IN(SELECT value FROM json_each(?))) WHERE id=?").bind(JSON.stringify((selected.learning_observations??[]).map(row=>row.evidence_id).filter(Boolean)),JSON.stringify((selected.learning_observations??[]).map(row=>row.request_id).filter(Boolean)),id))
 return statements
}
/** Purpose revocation or external-subject erasure removes copies and all derived
 * contributions, advances the archive journal and preserves only opaque fences. */
export async function purge(db:D1Database,sourceId:string,personId?:string,investigationId?:string){
 const source=await db.prepare('SELECT provider,installation_id FROM learning_sources WHERE id=?').bind(sourceId).first<{provider:string;installation_id:string}>()
 if(!source)throw new NativeError('learning_not_found',404)
 const query=personId?`SELECT o.* FROM learning_observations o JOIN learning_sources s ON s.id=o.source_id WHERE s.provider=? AND s.installation_id IS ? AND EXISTS(SELECT 1 FROM learning_source_people p WHERE p.observation_id=o.id AND p.source_person_id=?)`:`SELECT o.* FROM learning_observations o WHERE o.event_key IN(SELECT event_key FROM learning_observations WHERE source_id=? ${investigationId?'AND investigation_id=?':''})`
 const observations=(await db.prepare(query).bind(...(personId?[source.provider,source.installation_id,personId]:[sourceId,...(investigationId?[investigationId]:[])])).all<Row>()).results
 const ids=JSON.stringify(observations.map(o=>o.id)),affected=JSON.stringify([...new Set(observations.map(o=>o.investigation_id))])
 if(observations.length>500)throw new NativeError('learning_erasure_limit',413)
 const state=(await db.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first<{origin:string;epoch:number}>())!,epoch=state.epoch+1,marker=await hash([state.origin,'learning_observations',canonical(['revoked',crypto.randomUUID()])])
 const statements=[...await portabilityErasureStatements(db),...await learningErasureStatements(db,{learning_observations:observations}),db.prepare('INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(epoch,'learning_observations',marker)]
 if(personId){statements.push(db.prepare('INSERT OR IGNORE INTO learning_erased_people(source_id,person_hash) VALUES(?,?)').bind(sourceId,await digest(`${source.provider}:${source.installation_id}:person:${personId}`)))}
 statements.push(db.prepare('DELETE FROM learning_artifacts WHERE id IN(SELECT artifact_id FROM learning_contributions WHERE observation_id IN(SELECT value FROM json_each(?)))').bind(ids),db.prepare('DELETE FROM learning_observations WHERE id IN(SELECT value FROM json_each(?))').bind(ids),db.prepare("UPDATE learning_runs SET cursor_json='{}',state=CASE WHEN state='running' THEN 'uncertain' ELSE state END,reason='source_data_removed' WHERE investigation_id IN(SELECT value FROM json_each(?))").bind(affected))
 if(!personId){
  const condition=investigationId?'id=?':'source_id=?',key=investigationId??sourceId
  // Corrections and snapshots may quote source data without a visible identity.
  statements.push(db.prepare(`DELETE FROM learning_artifacts WHERE investigation_id IN(SELECT id FROM learning_investigations WHERE ${condition})`).bind(key),db.prepare(`UPDATE learning_investigations SET state='revoked',question='Revoked investigation',purpose='Revoked purpose',native_evidence_ids_json='[]',native_request_ids_json='[]',version=version+1,last_reason='source_revoked' WHERE ${condition}`).bind(key))
  if(!investigationId)statements.push(db.prepare("UPDATE learning_sources SET state='disconnected',version=version+1,resource_ids_json='[]',use_basis='Revoked source use' WHERE id=?").bind(sourceId))
 }
 statements.push(db.prepare("UPDATE data_state SET epoch=? WHERE singleton=1 AND epoch=? AND phase='idle'").bind(epoch,state.epoch))
 const guard=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=? AND phase='idle'))").bind(guard,state.epoch),...statements,db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard)])
}
