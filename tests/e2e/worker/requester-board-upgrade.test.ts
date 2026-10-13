import { applyD1Migrations, type D1Migration } from 'cloudflare:test'
import { inject,it,expect } from 'vitest'
import { env,createUlid,opaqueToken,digest,call,auth } from './requester-board-fixture'

it('[DATA-002 REQ-020/023] upgrades a populated A release preserving publication, evidence and idempotency while revoking predecessor credentials',async()=>{
 const migrations=inject('migrations') as D1Migration[]
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0005'))
 const now=new Date().toISOString(),board=createUlid(),requester=createUlid(),address=createUlid(),request=createUlid(),operator=createUlid(),evidence=createUlid(),version=createUlid(),comment=createUlid(),token=opaqueToken(),key=crypto.randomUUID()
 const slug=`feedback-${request.toLowerCase()}`,boardSlug=`upgrade-${board.toLowerCase()}`
 const input={title:'Original private title',description:'Original private description',boardSlug,idempotencyKey:key}
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,?,'public',0,?,?)").bind(board,boardSlug,'Prior board',now,now),
  env.DB.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(operator,'reviewer@example.test','Prior operator',now,now),
  env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(requester,'Private name that was never approved',now,now),
  env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(address,requester,'prior@example.test',now,now,now),
  env.DB.prepare('INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(createUlid(),requester,address,await digest(token),new Date(Date.now()+86400000).toISOString(),now,now,now),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,moderation_state,public_state,public_title,public_description,approved_author_name,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'approved','open',?,?,?,?,?,?)").bind(request,slug,board,requester,input.title,input.description,'Approved title','Approved description','Approved name',now,now,now),
  env.DB.prepare("INSERT INTO evidence_items(id,source_type,requester_id,observed_at,review_state,created_at,updated_at) VALUES(?,'portal_request',?,?,'unreviewed',?,?)").bind(evidence,requester,now,now,now),
  env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES(?,?,1,?,?,?)').bind(version,evidence,'Exact previous observation',now,now),
  env.DB.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(request,evidence,now),
  env.DB.prepare('INSERT INTO request_submission_keys(key_hash,body_hash,request_id,evidence_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(await digest(`${requester}:${key}`),await digest(JSON.stringify({...input,idempotencyKey:undefined})),request,evidence,new Date(Date.now()+86400000).toISOString(),now,now),
  env.DB.prepare("INSERT INTO request_comments(id,request_id,operator_id,body,moderation_state,published_at,created_at,updated_at) VALUES(?,?,?,?,'approved',?,?,?)").bind(comment,request,operator,'Previously published comment',now,now,now),
  env.DB.prepare("INSERT INTO native_moderation_events(id,request_id,actor_id,verdict,created_at,updated_at) VALUES(?,?,?,'approved',?,?)").bind(createUlid(),request,operator,now,now),
 ])
 const before=await env.DB.prepare('SELECT * FROM evidence_versions').all()
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name>='0005'))
 expect((await env.DB.prepare('SELECT * FROM evidence_versions').all()).results).toEqual(before.results)
 expect(await env.DB.prepare('SELECT public_author_display_name,approved_author_name FROM requests WHERE id=?').bind(request).first()).toEqual({public_author_display_name:'Approved name',approved_author_name:'Approved name'})
 const body=await (await call(`/api/public/requests/${slug}`)).json()
 expect(body).toMatchObject({title:'Approved title',authorDisplayName:'Approved name',comments:[{body:'Previously published comment',author:{displayName:'Prior operator'}}]})
 expect(JSON.stringify(body)).not.toContain('Private name that was never approved')
 expect((await call('/api/public/requests',input,auth(token))).status).toBe(401)
 expect((await call('/api/public/identity/email',{email:'prior@example.test',displayName:'Prior requester'})).status).toBe(202)
 const link=(await env.DB.prepare("SELECT token FROM local_auth_outbox WHERE recipient='prior@example.test'").first<{token:string}>())!
 const verified=await call('/api/public/identity/email/verify',{token:link.token});expect(verified.status).toBe(200)
 const fresh=(await verified.json() as {token:string}).token
 expect((await call('/api/public/requests',input,auth(fresh))).status).toBe(201)
 expect((await env.DB.prepare('SELECT * FROM requests').all()).results).toHaveLength(1)
 expect((await call(`/api/public/requests/${slug}/vote`,{},auth(fresh))).status).toBe(204)
 expect(await env.DB.prepare('SELECT title,moderation_state FROM request_content_submissions').first()).toEqual({title:input.title,moderation_state:'approved'})
 expect((await env.DB.prepare('SELECT * FROM request_moderation_events').all()).results).toHaveLength(1)
})
