import { expect } from 'vitest'
import { createUlid } from '@/core/shared/ulid'
import { digest,opaqueToken } from '@/core/features/auth/native-tokens'
import { authenticateOperator } from '@/core/features/auth/operator'
import { call,env,mockMail,origin,owner } from './support'
import { runtime,time } from './notification-regression-fixture'

/** Explicit pre-0020 product rows. Today's mail identity, board defaults and
 * permission provenance require later product migrations. Populate historical
 * records without applying those migrations before the preservation snapshot.
 * Native owner/session admission, link consumption and merge remain real. */
export async function previousNotificationGraph(count=1){
 mockMail()
 const operator=await owner(),person=await historicalRequester(),board=createUlid(),createdAt=new Date().toISOString()
 await env.DB.prepare("INSERT INTO boards(id,name,slug,visibility,position,created_at,updated_at) VALUES(?,'Notifications','regression','public',0,?,?)").bind(board,createdAt,createdAt).run()
 const admitted=await authenticateOperator(runtime(),new Request(origin+'/app',{headers:operator}))
 expect(admitted).not.toBeNull()
 const actor=admitted!.id
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
  await env.DB.batch([
   ...['request_follow_contributions','request_follows'].map(table=>env.DB.prepare(`INSERT INTO ${table}(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES(?,?,?,?,?)`).bind(id,recipient.requesterId,stamp,stamp,stamp)),
   env.DB.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES(?,?,?,?,'follow',?,?,?)").bind(createUlid(),recipient.requesterId,recipient.addressId,id,stamp,stamp,stamp),
  ])
  expect(await env.DB.prepare('SELECT COUNT(*) FROM request_follows WHERE request_id=? AND requester_id=?').bind(id,recipient.requesterId).first('COUNT(*)')).toBe(1)
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

/** A previously issued link belongs to the old store, rather than asking the
 * current sender to compose mail using configuration that does not exist yet. */
async function historicalRequester(){
 const token=opaqueToken(),now=new Date().toISOString()
 await env.DB.prepare(`INSERT INTO native_magic_links(id,purpose,email,display_name,token_hash,expires_at,created_at,updated_at)
  VALUES(?,'requester',?,'Private display',?,?,?,?)`).bind(createUlid(),`${crypto.randomUUID()}@example.test`,await digest(token),new Date(Date.now()+30*60000).toISOString(),now,now).run()
 const response=await call('/api/public/identity/email/verify',{token})
 expect(response.status,await response.clone().text()).toBe(200)
 const person={Authorization:`Bearer ${(await response.json() as {token:string}).token}`}
 expect((await call('/api/public/identity/session',undefined,person)).status).toBe(200)
 return person
}
