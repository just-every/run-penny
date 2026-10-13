import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {call,env,mockMail,requester} from './support'
import {drainRejectionNotices} from '@/core/features/notifications/rejection-delivery'
import {rejectionFixture,rejectionRows,rejectionRuntime,rejectionTime,captureRejections} from './rejection-fixture'
import {RequestOperatorRepository} from '@/core/features/requests/operator-repository'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it.each(['consent','mute','global','suppression','block','address','internal','merge'] as const)('[REQ-030 NOTIFY-002] suppresses %s changed after enqueue',async change=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 if(change==='consent')await env.DB.prepare('UPDATE requester_update_permissions SET revoked_at=? WHERE requester_id=?').bind(new Date().toISOString(),g.requesterId).run()
 if(change==='mute')await env.DB.prepare('UPDATE request_follows SET muted_at=? WHERE requester_id=?').bind(new Date().toISOString(),g.requesterId).run()
 if(change==='global')expect((await call('/api/public/requester/notifications',{muted:true},g.person,'PATCH')).status).toBe(200)
 if(change==='suppression')await env.DB.prepare('UPDATE requester_addresses SET suppressed_at=? WHERE id=?').bind(new Date().toISOString(),g.addressId).run()
 if(change==='block')await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=?').bind(new Date().toISOString(),g.requesterId).run()
 if(change==='address')await env.DB.prepare('UPDATE requester_addresses SET verified_at=NULL WHERE id=?').bind(g.addressId).run()
 if(change==='internal')expect((await call(`/api/operator/boards/${g.board}`,{visibility:'internal'},g.operator,'PATCH')).status).toBe(200)
 if(change==='merge'){
  await requester('Survivor')
  const target=await env.DB.prepare('SELECT id FROM requesters WHERE id!=?').bind(g.requesterId).first<{id:string}>()
  const actor=await env.DB.prepare('SELECT id FROM operators').first<{id:string}>()
  await new RequestOperatorRepository(rejectionRuntime().database).mergeRequesters(g.requesterId,target!.id,actor!.id,new Date().toISOString())
 }
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(sent).toHaveLength(0)
 expect(await rejectionRows()).toMatchObject([{state:'suppressed',reason:expect.any(String)}])
 const result=await (await call('/api/operator/notifications',undefined,g.operator)).json() as {deliveries:{state:string;failureReason:string}[]}
 expect(result.deliveries).toMatchObject([{state:'suppressed',failureReason:expect.any(String)}])
})
it('[REQ-030] missing consent and unconfigured mail never claim delivery',async()=>{
 const g=await rejectionFixture({consent:false});expect((await g.reject()).status).toBe(200)
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(await rejectionRows()).toMatchObject([{state:'suppressed',reason:'consent_missing_or_revoked'}])
 mockMail()
 const eligible=await rejectionFixture({operator:g.operator});expect((await eligible.reject()).status).toBe(200)
 const laterSent=captureRejections()
 await drainRejectionNotices(rejectionRuntime({MAIL_PROVIDER:undefined,MAIL_FROM:undefined,SENDGRID_API_KEY:undefined}),()=>rejectionTime)
 expect((await rejectionRows()).find(r=>r.state==='failed')).toMatchObject({reason:'mail_configuration_missing'})
 expect(sent).toHaveLength(0);expect(laterSent).toHaveLength(0)
})
it('[REQ-030 BASE-ACCESS-003] rejects requester, anonymous and cross-origin verdicts without queueing mail',async()=>{
 const g=await rejectionFixture()
 expect((await g.reject(true,{} as {Cookie:string})).status).toBe(401)
 expect((await call(g.path,{verdict:'rejected',reason:'Do not send',notifyAuthor:true},g.person)).status).toBe(401)
 expect((await call(g.path,{verdict:'rejected',reason:'Do not send',notifyAuthor:true},{...g.operator,Origin:'https://attacker.test'})).status).toBe(403)
 expect((await call(g.path,{verdict:'rejected',reason:'Do not send',notifyAuthor:true},{...g.operator,Origin:''})).status).toBe(403)
 expect(await rejectionRows()).toHaveLength(0)
})
it.each(['request','comment'] as const)('[REQ-030] rejected %s edits send only the private author reason',async subject=>{
 const g=await rejectionFixture({comment:true})
 let id:string,path:string
 if(subject==='request'){
  expect((await call(`/api/public/requests/${g.slug}`,{title:'PRIVATE EDIT TITLE',description:'PRIVATE EDIT TEXT'},g.person,'PATCH')).status).toBe(200)
  id=(await env.DB.prepare('SELECT id FROM request_content_submissions WHERE request_id=? AND is_initial=0').bind(g.requestId).first<{id:string}>())!.id
  path=`/api/operator/requests/edits/${id}/moderate`
 }else{
  expect((await call(g.path,{verdict:'approved',publicAuthorDisplayName:'Author'},g.operator)).status).toBe(200)
  expect((await call(`/api/public/comments/${g.subjectId}`,{body:'PRIVATE EDIT TEXT'},g.person,'PATCH')).status).toBe(200)
  id=(await env.DB.prepare('SELECT id FROM request_comment_edits WHERE comment_id=?').bind(g.subjectId).first<{id:string}>())!.id
  path=`/api/operator/comments/edits/${id}/moderate`
 }
 expect((await call(path,{verdict:'rejected',reason:'The original wording is clearer.',notifyAuthor:true},g.operator)).status).toBe(200)
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(sent).toHaveLength(1);expect(JSON.stringify(sent)).toContain('The original wording is clearer.');expect(JSON.stringify(sent)).not.toMatch(/PRIVATE|COMMERCIAL|HELD/)
 expect(await rejectionRows()).toMatchObject([{state:'accepted'}])
 expect(await (await call(`/api/public/requests/${g.slug}`)).text()).not.toContain('PRIVATE EDIT')
})
it('[REQ-030 DATA-003] erased authors cannot retain a queued rejection audience',async()=>{
 const g=await rejectionFixture();expect((await g.reject()).status).toBe(200)
 const preview=await call('/api/operator/data/erasure/preview',{table:'requesters',id:g.requesterId},g.operator)
 expect(preview.status,await preview.clone().text()).toBe(200)
 const plan=await preview.json() as {planHash:string;blockedCopies:unknown[]}
 expect(plan.blockedCopies).toEqual([])
 const erased=await call('/api/operator/data/erasure',{table:'requesters',id:g.requesterId,planHash:plan.planHash},g.operator)
 expect(erased.status,await erased.clone().text()).toBe(200)
 const sent=captureRejections();await drainRejectionNotices(rejectionRuntime(),()=>rejectionTime)
 expect(sent).toHaveLength(0);expect(await rejectionRows()).toHaveLength(0)
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(g.requesterId).first()).toBeNull()
})
