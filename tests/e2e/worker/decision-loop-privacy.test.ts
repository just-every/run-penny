import { digest } from '../../../src/core/features/auth/native-tokens'
import { hashOperatorSessionToken } from '../../../src/core/features/auth/session'
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,expect,inject,it } from 'vitest'
import { seedLoop,request,json,document,committed,publicRequest,approve,row,operatorId,stamp } from './decision-loop-fixture'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})
it('[ROAD-002][ROAD-004][ROAD-006][EVID-006] internal edits never publish drafts or internal identity; explicit reapproval changes only safe fields',async()=>{
 const c=await committed(),r=await publicRequest();await approve(c.itemId,[r.id])
 const marker='private-account-secret',internalSlug='private-internal-roadmap-identity',draft='Unapproved draft private phrase'
 await env.DB.prepare('INSERT INTO accounts(id,slug,name,revenue_cents,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('privacy-account','privacy-account',marker,927314159,stamp,stamp).run()
 await env.DB.prepare('UPDATE evidence_items SET account_id=? WHERE id=?').bind('privacy-account',c.e.id).run()
 await env.DB.prepare('UPDATE decisions SET rationale=? WHERE id=?').bind('private-rationale-secret',c.d.id).run()
 await env.DB.prepare('UPDATE candidate_bets SET title=? WHERE id=?').bind('private-declined-bet-secret',c.b.id).run()
 await env.DB.prepare('UPDATE roadmap_items SET slug=? WHERE id=?').bind(internalSlug,c.itemId).run()
 const edit={title:'Internal title private',summary:'Internal summary private',ownerOperatorId:operatorId,targetWindow:'Private target window',decisionId:c.d.id,candidateBetId:c.a.id,accountImpact:marker,confidence:'high',deliveryNotes:'private-delivery-notes-secret',publicTitle:draft,publicSummary:'Unapproved draft summary',evidenceIds:[c.e.id]}
 await json(request(`/api/operator/roadmap/${c.itemId}`,'PATCH',edit));expect(await row('roadmap_items',c.itemId)).toMatchObject({public_title_draft:draft,delivery_notes:'private-delivery-notes-secret'})
 const p=(await env.DB.prepare('SELECT public_slug FROM roadmap_publications WHERE roadmap_item_id=?').bind(c.itemId).first<{public_slug:string}>())!
 const paths=['/api/public/roadmap',`/api/public/roadmap/${p.public_slug}`,'/api/public/requests',`/api/public/requests/${r.slug}`,'/portal/feedback','/portal/roadmap',`/portal/roadmap/${p.public_slug}`,`/portal/feedback/${r.slug}`]
 for(const path of paths){const response=await (path.startsWith('/api/')?request(path):document(path));expect(response.status).toBe(200);const text=await response.text();for(const forbidden of [marker,'927314159','private-rationale-secret','private-declined-bet-secret','private-delivery-notes-secret',internalSlug,draft,'"confidence"','"high"','>high<','"deliveryNotes"'])expect(text,`${path}: ${forbidden}`).not.toContain(forbidden)}
 expect((await document(`/portal/roadmap/${internalSlug}`)).status).toBe(404)
 await json(request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'New explicitly approved title',publicSummary:'New approved summary',boardSlug:'loop-board',requestIds:[r.id]}));expect(await json(request(`/api/public/roadmap/${p.public_slug}`))).toMatchObject({title:'New explicitly approved title',summary:'New approved summary'})
})
it('[ROAD-004][ROAD-006] concurrent draft edits/reapproval and withdrawal never project draft wording or private mappings',async()=>{
 const c=await committed(),r=await publicRequest();await approve(c.itemId,[r.id]);const p=(await env.DB.prepare('SELECT public_slug FROM roadmap_publications WHERE roadmap_item_id=?').bind(c.itemId).first<{public_slug:string}>())!
 const edit={title:'Private internal',summary:'Private',ownerOperatorId:operatorId,targetWindow:null,decisionId:c.d.id,candidateBetId:c.a.id,accountImpact:null,confidence:'low',deliveryNotes:null,publicTitle:'PRIVATE DRAFT RACE',publicSummary:'PRIVATE SUMMARY RACE'}
 await Promise.all([json(request(`/api/operator/roadmap/${c.itemId}`,'PATCH',edit)),json(request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'Approved during race',publicSummary:'Approved problem',boardSlug:'loop-board',requestIds:[r.id]}))])
 expect(await json(request(`/api/public/roadmap/${p.public_slug}`))).toMatchObject({title:'Approved during race'})
 const read=request(`/api/public/roadmap/${p.public_slug}`);await json(request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}));const response=await read;expect([200,404]).toContain(response.status);expect(await response.text()).not.toContain('PRIVATE');expect((await request(`/api/public/roadmap/${p.public_slug}`)).status).toBe(404)
})
it('[ROAD-001][DEC-004][EVID-003][BASE-AUTH-001][BASE-AUTH-003][BASE-DATA-001] all loop writes require operator, CSRF and maintenance admission',async()=>{
 const c=await committed()
 await env.DB.prepare('INSERT INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('expired-loop-session',operatorId,await hashOperatorSessionToken('expired-loop-token'),'2000-01-01T00:00:00Z',stamp,stamp,stamp).run()
 await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind('loop-read-only-requester','Requester only',stamp,stamp).run()
 await env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('loop-read-only-address','loop-read-only-requester','loop-read-only@example.invalid',stamp,stamp,stamp).run()
 await env.DB.prepare('INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('loop-read-only-session','loop-read-only-requester','loop-read-only-address',await digest('q'.repeat(43)),'2099-01-01',stamp,stamp,stamp).run()
 const requesterHeaders={Cookie:'',Authorization:'Bearer '+'q'.repeat(43)}
 expect((await request('/api/public/identity/session','GET',undefined,requesterHeaders)).status).toBe(200)
 const writes:[string,string,unknown][]=[['/api/operator/evidence','POST',{}],[`/api/operator/evidence/${c.e.id}/links`,'DELETE',{target:'bet',targetId:c.a.id}],['/api/operator/decisions','POST',{question:'Denied'}],[`/api/operator/decisions/${c.d.id}`,'PATCH',{question:'Denied'}],[`/api/operator/decisions/${c.d.id}/bets`,'POST',{title:'Denied',summary:'Denied'}],[`/api/operator/decisions/${c.d.id}/bets/${c.a.id}`,'PATCH',{title:'Denied',summary:'Denied'}],[`/api/operator/decisions/${c.d.id}/commit`,'POST',{}],[`/api/operator/evidence/${c.e.id}/links`,'PUT',{target:'bet',targetId:c.a.id}],[`/api/operator/evidence/${c.e.id}/review`,'POST',{reviewed:true,reason:'Denied'}],[`/api/operator/evidence/${c.e.id}/request`,'POST',{}],[`/api/operator/evidence/${c.e.id}/decision`,'POST',{}],[`/api/operator/roadmap/${c.itemId}`,'PATCH',{}],[`/api/operator/roadmap/${c.itemId}/approve`,'POST',{}],[`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}],[`/api/operator/roadmap/${c.itemId}/move`,'POST',{}]]
 const unchanged=await env.DB.prepare('SELECT (SELECT COUNT(*) FROM audit_entries) AS audits,(SELECT COUNT(*) FROM evidence_items) AS evidence,(SELECT COUNT(*) FROM decisions) AS decisions,(SELECT COUNT(*) FROM roadmap_transitions) AS transitions').first()
 for(const [path,method,body] of writes){expect((await request(path,method,body,{Cookie:'penny_operator_session=expired-loop-token'})).status).toBe(401);expect((await request(path,method,body,requesterHeaders)).status).toBe(401);expect((await request(path,method,body,{Cookie:''})).status).toBe(401);expect((await request(path,method,body,{Cookie:'penny_operator_session=invalid'})).status).toBe(401);expect((await request(path,method,body,{Origin:'https://evil.invalid'})).status).toBe(403);expect((await request(path,method,body,{'Sec-Fetch-Site':'cross-site'})).status).toBe(403)}
 for(const path of ['/api/operator/loop/options',`/api/operator/evidence/${c.e.id}/links`,`/api/operator/roadmap/${c.itemId}/context`])for(const headers of [{Cookie:''},{Cookie:'penny_operator_session=expired-loop-token'},requesterHeaders])expect((await request(path,'GET',undefined,headers)).status).toBe(401)
 expect(await env.DB.prepare('SELECT (SELECT COUNT(*) FROM audit_entries) AS audits,(SELECT COUNT(*) FROM evidence_items) AS evidence,(SELECT COUNT(*) FROM decisions) AS decisions,(SELECT COUNT(*) FROM roadmap_transitions) AS transitions').first()).toEqual(unchanged)
 await env.DB.prepare("UPDATE data_state SET phase='locked' WHERE singleton=1").run()
 try{for(const [path,method,body] of writes)expect((await request(path,method,body)).status).toBe(409)}finally{await env.DB.prepare("UPDATE data_state SET phase='idle' WHERE singleton=1").run()}
})
