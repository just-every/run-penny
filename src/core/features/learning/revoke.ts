import {canonical,hash} from '../data/archive'
import {portabilityErasureStatements} from '../../../../scripts/portability/cleanup.mjs'
import type {Investigation} from './schema'
import {GRANT_REVOCATION_CHECKPOINT} from './journal'

/** Withdraw one purpose grant without erasing reusable source evidence. The
 * journal checkpoint prevents an older export from restoring its deleted work. */
export async function revokeInvestigation(db:D1Database,i:Investigation){
 const state=(await db.prepare('SELECT origin,epoch FROM data_state WHERE singleton=1').first<{origin:string;epoch:number}>())!,epoch=state.epoch+1,guard=crypto.randomUUID()
 // This marks the revoked grant version, not the retained investigation row.
 const marker=await hash([state.origin,GRANT_REVOCATION_CHECKPOINT,canonical([i.id,i.version])])
 await db.batch([
  db.prepare("INSERT INTO penny_integration_guards(id,allowed) VALUES(?,EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND epoch=? AND phase='idle') AND EXISTS(SELECT 1 FROM learning_investigations WHERE id=? AND version=?))").bind(guard,state.epoch,i.id,i.version),
  ...await portabilityErasureStatements(db),
  db.prepare("UPDATE learning_investigations SET state='revoked',question='Revoked investigation',purpose='Revoked purpose',native_evidence_ids_json='[]',native_request_ids_json='[]',version=version+1,last_reason='grant_revoked' WHERE id=?").bind(i.id),
  db.prepare('DELETE FROM learning_artifacts WHERE investigation_id=?').bind(i.id),
  db.prepare('DELETE FROM learning_observations WHERE investigation_id=?').bind(i.id),
  db.prepare('DELETE FROM learning_runs WHERE investigation_id=?').bind(i.id),
  db.prepare('INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(?,?,?)').bind(epoch,GRANT_REVOCATION_CHECKPOINT,marker),
  db.prepare('UPDATE data_state SET epoch=? WHERE singleton=1').bind(epoch),
  db.prepare('DELETE FROM penny_integration_guards WHERE id=?').bind(guard),
 ])
}
