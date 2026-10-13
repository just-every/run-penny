import { nativeOwnerCookie } from '../../predecessor-native-authority'
import { applyD1Migrations,type D1Migration } from 'cloudflare:test'
import { inject,it,expect } from 'vitest'
import { env,createUlid,opaqueToken,digest,call,bindings } from './requester-board-fixture'
it('[DATA-002 REQ-009] populated 0005 chain upgrades preserving product cells and R2 bytes with explicit predecessor credential revocation',async()=>{
 const migrations=inject('migrations') as D1Migration[]
 await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0006'))
 const db=env.DB,now='2026-10-01T00:00:00.000Z',board=createUlid(),operator=createUlid(),who=createUlid(),address=createUlid(),a=createUlid(),b=createUlid(),c=createUlid(),ab=createUlid(),bc=createUlid(),comment=createUlid(),file=createUlid(),evidence=createUlid(),cookie=opaqueToken()
 const slug=(id:string)=>`prior-${id.toLowerCase()}`
 await db.batch([
  db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,?,'public',0,?,?)").bind(board,'prior-board','Prior board',now,now),
  db.prepare('INSERT INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(operator,'reviewer@example.test','Reviewer',now,now),
  db.prepare('INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(createUlid(),operator,await digest(cookie),new Date(Date.now()+3600000).toISOString(),now,now,now),
  db.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(who,'Prior requester',now,now),
  db.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(address,who,'prior-custody@example.test',now,now,now),
  ...[a,b,c].map(id=>db.prepare("INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,moderation_state,public_state,public_title,public_description,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'approved','open',?,?,?,?,?)").bind(id,slug(id),board,who,`Original ${id}`,'Original wording','Public title','Public text',now,now,now)),
  db.prepare('UPDATE requests SET merged_into_request_id=?,merged_at=? WHERE id=?').bind(b,now,a),
  db.prepare('UPDATE requests SET merged_into_request_id=?,merged_at=? WHERE id=?').bind(c,now,b),
  ...[[ab,a,b],[bc,b,c]].map(([id,source,target])=>db.prepare('INSERT INTO request_merges(id,source_request_id,target_request_id,actor_operator_id,merged_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,source,target,operator,now,now,now)),
  db.prepare('INSERT INTO request_votes(request_id,requester_id,created_at,updated_at) VALUES(?,?,?,?)').bind(c,who,now,now),
  db.prepare('INSERT INTO request_follows(request_id,requester_id,permission_granted_at,created_at,updated_at) VALUES(?,?,?,?,?)').bind(c,who,now,now,now),
  ...[ab,bc].flatMap(id=>[
   db.prepare('INSERT INTO request_merge_vote_transfers(merge_id,requester_id,target_had_vote,source_created_at,source_updated_at,created_at) VALUES(?,?,0,?,?,?)').bind(id,who,now,now,now),
   db.prepare('INSERT INTO request_merge_follow_transfers(merge_id,requester_id,target_had_follow,source_permission_granted_at,source_created_at,source_updated_at,created_at) VALUES(?,?,0,?,?,?,?)').bind(id,who,now,now,now,now),
  ]),
  db.prepare("INSERT INTO requester_update_permissions(id,requester_id,requester_address_id,request_id,source,granted_at,created_at,updated_at) VALUES(?,?,?,?,'follow',?,?,?)").bind(createUlid(),who,address,a,now,now,now),
  db.prepare("INSERT INTO evidence_items(id,source_type,requester_id,observed_at,review_state,created_at,updated_at) VALUES(?,'portal_request',?,?,'unreviewed',?,?)").bind(evidence,who,now,now,now),
  db.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,created_at,updated_at) VALUES(?,?,1,?,?,?)').bind(createUlid(),evidence,'Exact old private observation',now,now),
  db.prepare('INSERT INTO request_evidence_links(request_id,evidence_id,created_at) VALUES(?,?,?)').bind(c,evidence,now),
  ...[ab,bc].map(id=>db.prepare('INSERT INTO request_merge_evidence_transfers(merge_id,evidence_id,target_was_linked,created_at) VALUES(?,?,0,?)').bind(id,evidence,now)),
  db.prepare("INSERT INTO request_comments(id,request_id,operator_id,body,moderation_state,published_at,created_at,updated_at) VALUES(?,?,?,?,'approved',?,?,?)").bind(comment,c,operator,'Old comment',now,now,now),
  db.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES(?,?,?,'prior.png','image/png',5,'published',?,?)").bind(file,c,'prior-fixture-file',now,now),
  ...[ab,bc].flatMap(id=>[
   db.prepare('INSERT INTO request_merge_comment_transfers(merge_id,comment_id,created_at) VALUES(?,?,?)').bind(id,comment,now),
   db.prepare('INSERT INTO request_merge_attachment_transfers(merge_id,attachment_id,created_at) VALUES(?,?,?)').bind(id,file,now),
  ]),
 ])
 const bytes=new Uint8Array([137,80,78,71,88]);await env.FILES.put('prior-fixture-file',bytes,{httpMetadata:{contentType:'image/png'}})
 const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations'").all<{name:string}>()).results
 const before=[] as {name:string;columns:string[];rows:unknown[]}[]
 for(const table of tables){const columns=(await db.prepare(`PRAGMA table_info(${table.name})`).all<{name:string}>()).results.map(c=>c.name);before.push({name:table.name,columns,rows:(await db.prepare(`SELECT ${columns.join(',')} FROM ${table.name} ORDER BY rowid`).all()).results})}
 await applyD1Migrations(db,migrations.filter(m=>m.name>='0006'))
 for(const table of before){
  const expected=table.name==='operator_sessions'?table.rows.map(row=>({...row as Record<string,unknown>,revoked_at:expect.any(String)})):table.rows
  expect((await db.prepare(`SELECT ${table.columns.join(',')} FROM ${table.name} ORDER BY rowid`).all()).results,table.name).toEqual(expected)
 }
 expect(new Uint8Array(await (await env.FILES.get('prior-fixture-file'))!.arrayBuffer())).toEqual(bytes)
 expect((await call('/api/auth/session',undefined,{Cookie:`penny_operator_session=${cookie}`})).status).toBe(401)
 expect((await call('/api/auth/magic-link',{email:'reviewer@example.test'})).status).toBe(202)
 const link=(await db.prepare("SELECT token FROM local_auth_outbox WHERE recipient='reviewer@example.test'").first<{token:string}>())!
 const signedIn=await call('/api/auth/magic-link/consume?token='+link.token);expect(signedIn.status).toBe(302)
 // Migration 0009 retains this operator as the native owner, but revokes its
 // predecessor credential. The two sign-ins still issue independent sessions.
 const headers={Cookie:`${signedIn.headers.get('Set-Cookie')!.split(';')[0]}; ${await nativeOwnerCookie(bindings,'','reviewer@example.test')}`,Origin:bindings.APP_ORIGIN}
 for(const source of [a,b])expect((await call(`/api/operator/requests/${slug(source)}/unmerge`,{},headers)).status).toBe(200)
 expect((await db.prepare('SELECT request_id,requester_id FROM request_votes').all()).results).toEqual([{request_id:a,requester_id:who}])
 expect((await db.prepare('SELECT request_id,requester_id FROM request_follows').all()).results).toEqual([{request_id:a,requester_id:who}])
 expect(await db.prepare('SELECT request_id FROM request_comments').first()).toEqual({request_id:a})
 expect(await db.prepare('SELECT request_id FROM attachments').first()).toEqual({request_id:a})
 expect(new Uint8Array(await (await env.FILES.get('prior-fixture-file'))!.arrayBuffer())).toEqual(bytes)
})
