import { expect } from 'vitest'
import { createUlid } from '@/core/shared/ulid'
import { digest } from '@/core/features/auth/native-tokens'
import { call,env,mockMail,owner,requester } from './support'
import { time } from './notification-regression-fixture'

/** Explicit pre-0020 product rows. Current voting/status SQL requires 0063;
 * old stores must remain old while the migration assertions inspect them.
 * The unchanged authority, verification, follow and merge doors remain real. */
export async function previousNotificationGraph(count=1){
 mockMail()
 const operator=await owner(),person=await requester()
 expect((await call('/api/operator/boards',{name:'Notifications',slug:'regression',visibility:'public'},operator)).status).toBe(201)
 const board=await env.DB.prepare("SELECT id FROM boards WHERE slug='regression'").first<string>('id')
 const actor=await env.DB.prepare("SELECT id FROM operators WHERE email='owner@penny.invalid'").first<string>('id')
 const recipient=(await env.DB.prepare('SELECT requester_id AS requesterId,id AS addressId,email FROM requester_addresses LIMIT 1').first<{requesterId:string;addressId:string;email:string}>())!
 const requests:{id:string;slug:string}[]=[]
 for(let index=0;index<count;index++){
  const id=createUlid(),slug=`feedback-${id.toLowerCase()}`,evidenceId=createUlid(),stamp=new Date().toISOString(),moderationId=createUlid()
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,moderation_state,public_state,public_title,public_description,approved_author_name,public_author_display_name,published_at,created_at,updated_at)
    VALUES(?,?,?,?,?,'Requester wording','approved','open',?,'Public description','Requester','Requester',?,?,?)`).bind(id,slug,board,recipient.requesterId,`Request ${index}`,`Public request ${index}`,stamp,stamp,stamp),
   env.DB.prepare(`INSERT INTO evidence_items(id,source_type,requester_id,observed_at,review_state,created_at,updated_at) VALUES(?,'portal_request',?,?,'unreviewed',?,?)`).bind(evidenceId,recipient.requesterId,stamp,stamp,stamp),
   env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES(?,?,1,?,?,?)').bind(createUlid(),evidenceId,`Request ${index}\n\nRequester wording`,stamp,stamp),
   env.DB.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(id,evidenceId,stamp),
   env.DB.prepare('INSERT INTO request_evidence_contributions(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(id,evidenceId,stamp),
   env.DB.prepare('INSERT INTO request_submission_keys(key_hash,body_hash,request_id,evidence_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(await digest(crypto.randomUUID()),await digest(`Prior submission ${index}`),id,evidenceId,'2099-01-01T00:00:00Z',stamp,stamp),
   env.DB.prepare(`INSERT INTO request_content_submissions(id,request_id,requester_id,title,description,moderation_state,is_initial,approved_at,created_at,updated_at) VALUES(?,?,?,?,'Requester wording','approved',1,?,?,?)`).bind(createUlid(),id,recipient.requesterId,`Request ${index}`,stamp,stamp,stamp),
   env.DB.prepare(`INSERT INTO native_moderation_events(id,request_id,actor_id,verdict,created_at,updated_at) VALUES(?,?,?,'approved',?,?)`).bind(moderationId,id,actor,stamp,stamp),
   env.DB.prepare(`INSERT INTO request_moderation_events(id,subject_type,subject_id,request_id,verdict,actor_operator_id,created_at,updated_at) VALUES(?,'request',?,?,'approved',?,?,?)`).bind(moderationId,id,id,actor,stamp,stamp),
   env.DB.prepare(`INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'system','request.submitted','request',?,?,?,?)`).bind(createUlid(),id,stamp,stamp,stamp),
   env.DB.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'request.moderated','request',?,?,?,?)`).bind(createUlid(),actor,id,stamp,stamp,stamp),
  ])
  expect((await call(`/api/public/requests/${slug}/follow`,{},person)).status).toBe(204)
  requests.push({id,slug})
 }
 async function vote(index:number){
  const stamp=new Date().toISOString()
  await env.DB.batch(['request_vote_contributions','request_votes'].map(table=>env.DB.prepare(`INSERT INTO ${table}(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)`).bind(requests[index].id,recipient.requesterId,stamp,stamp)))
 }
 async function publish(index:number,body:string,offset=0){
  const update=createUlid(),id=requests[index].id,stamp=time(offset)
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO request_status_updates(id,request_id,public_status,previous_public_state,body,pinned,operator_id,published_at,action_key,publication_version,created_at,updated_at) VALUES(?,?,'under_review','open',?,0,?,?,?,1,?,?)`).bind(update,id,body,actor,stamp,crypto.randomUUID(),stamp,stamp),
   env.DB.prepare("UPDATE requests SET public_state='under_review',updated_at=? WHERE id=?").bind(stamp,id),
   env.DB.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,occurred_at,created_at,updated_at) VALUES(?,'operator',?,'request.status_published','request',?,?,?,?)`).bind(createUlid(),actor,id,stamp,stamp,stamp),
  ])
 }
 return {operator,person,requests,recipient,publish,vote}
}
