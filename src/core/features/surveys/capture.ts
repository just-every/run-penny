import type {PennyRuntime} from '@/core/app/runtime'
import {z} from 'zod'
import {createUlid} from '@/core/shared/ulid'
import {digest} from '../auth/native-tokens'
import {guardedDatabase} from '../integrations/guarded-database'
import {recordEvidence} from '../evidence/write-service'
import {redactionFence} from '../redaction/settings'
import {captureGuard,type Form,type SelectedResponse} from './model'
import {safeSelection,responseDigest} from './intake'
export async function captureResponse(runtime:PennyRuntime,form:Form,epoch:number,jobId:string,claim:string,input:SelectedResponse,now:string){
 const guard=captureGuard(form,epoch);guard.sql+=" AND EXISTS(SELECT 1 FROM penny_survey_jobs WHERE id=? AND claim=? AND state='running')";guard.params.push(jobId,claim)
 const db=guardedDatabase(runtime.database.binding,guard),safe=await safeSelection(db,input),value=safe.value,fence=redactionFence(db,safe.revision)
 const fingerprint=await digest(JSON.stringify(value)),receipt=await responseDigest(form,value.id)
 // Existing-source changes retain the original capture and its attributes.
 const existing=await db.prepare('SELECT s.evidence_id,s.source_hash FROM penny_survey_sources s JOIN penny_survey_jobs j ON j.id=s.job_id WHERE j.id=?').bind(jobId).first<{evidence_id:string;source_hash:string}>()
 if(existing){
  await db.batch([db.prepare("UPDATE penny_survey_sources SET source_state=CASE WHEN source_hash<>? THEN 'changed' ELSE source_state END WHERE evidence_id=? AND source_state IN('current','changed')").bind(fingerprint,existing.evidence_id),db.prepare("UPDATE penny_survey_jobs SET state='done',claim=NULL,selected_json=NULL,failure=NULL,updated_at=? WHERE id=?").bind(now,jobId)])
  return
 }
 // Source-stated identity is never sign-in or consent. Only unredacted valid
 // email can create an unverified address; existing authority is never modified.
 const email=value.email&&z.email().max(254).safeParse(value.email).success?value.email.toLowerCase():null
 let requesterId=email?await db.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(email).first<string>('requester_id'):null
 const newRequester=email&&!requesterId?createUlid():null;requesterId??=newRequester
 const accountId=value.account?await db.prepare('SELECT id FROM accounts WHERE id=? OR slug=?').bind(value.account,value.account).first<string>('id'):requesterId?await db.prepare('SELECT account_id FROM requester_account_links WHERE requester_id=? ORDER BY account_id LIMIT 1').bind(requesterId).first<string>('account_id'):null
 const id=await recordEvidence(db,{sourceType:'survey',sourceLabel:form.provider+' survey '+form.form_id,wording:value.wording||'[No mapped open-text answer]',namedSpeaker:value.speaker??value.email,observedAt:value.time,accountId},form.actor_id,now,undefined,undefined,{systemActor:'survey-capture',statements:evidenceId=>[
  fence.before,fence.after,
  ...(newRequester?[db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(newRequester,'Survey respondent',now,now),db.prepare('INSERT INTO requester_addresses(id,requester_id,email,created_at,updated_at) VALUES(?,?,?,?,?)').bind(createUlid(),newRequester,email,now,now)]:[]),
  ...(requesterId?[db.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind(requesterId,evidenceId)]:[]),
  db.prepare('INSERT INTO penny_evidence_owners(evidence_id,operator_id,updated_at) VALUES(?,?,?)').bind(evidenceId,form.actor_id,now),
  db.prepare('INSERT INTO penny_survey_receipts(source_digest,created_at) VALUES(?,?) ON CONFLICT DO NOTHING').bind(receipt,now),
  db.prepare("INSERT INTO penny_survey_sources(evidence_id,job_id,response_url,attributes_json,source_email,source_hash,source_state) VALUES(?,?,?,?,?,?,'current')").bind(evidenceId,jobId,form.response_url.replace('{responseId}',encodeURIComponent(value.id)),JSON.stringify(value.attributes),value.email,fingerprint),
  db.prepare("UPDATE penny_survey_jobs SET evidence_id=?,state='done',claim=NULL,selected_json=NULL,failure=NULL,updated_at=? WHERE id=?").bind(evidenceId,now,jobId),
 ]})
 return id
}
