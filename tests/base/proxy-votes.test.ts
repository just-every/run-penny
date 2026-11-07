import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterAll,expect,inject,it,vi } from 'vitest'
import { call,env,messages,owner } from './support'
import { graph } from './notification-regression-fixture'
import { reconcileVoteCsv } from './csv-vote-reconciliation'
beforeEach(async()=>{vi.restoreAllMocks();await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())
const json=async<T>(path:string,body:unknown,headers:Record<string,string>,status=200):Promise<T>=>{const response=await call(path,body,headers);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
const total=async(table:string)=>env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first<number>('n')

it('[CAP-014 REQ-026 REQ-010 DATA-005] records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote',async()=>{
 const g=await graph(4),r=g.requests[0],before={permissions:await total('requester_update_permissions'),sessions:await total('native_requester_sessions')}
 const direct=g.requests.map(request=>({slug:request.slug,voters:[{id:g.recipient.requesterId,name:'Private display',proxy:0}]}))
 await reconcileVoteCsv(g.operator,g.person,direct)
 // A populated request export must retain every zero even when the voter file has only its header.
 for(const request of g.requests)expect((await call(`/api/public/requests/${request.slug}/vote`,undefined,g.person,'DELETE')).status).toBe(204)
 await reconcileVoteCsv(g.operator,g.person,g.requests.map(request=>({slug:request.slug,voters:[]})))
 for(const request of g.requests.slice(0,2))expect((await call(`/api/public/requests/${request.slug}/vote`,{},g.person)).status).toBe(204)
 await reconcileVoteCsv(g.operator,g.person,direct.map((request,index)=>index<2?request:{...request,voters:[]}))
 const evidence=await json<{id:string}>('/api/operator/evidence',{sourceType:'support_conversation',wording:'Customer needs monthly exports.',observedAt:new Date().toISOString(),requestLinks:[{id:r.id,stance:'supporting'}]},g.operator,201)
 const contactEmail='synthetic-penny-4'+String.fromCharCode(64)+'example.test'
 const input={contact:{displayName:'Casey Bell',email:contactEmail},source:'Zendesk ticket 738: monthly exports, "priority"\nCustomer asked again',sourceUrl:'https://harbor.zendesk.com/agent/tickets/738',evidenceId:evidence.id}
 const vote=await json<{requesterId:string;created:boolean}>(`/api/operator/requests/${r.slug}/proxy-votes`,input,g.operator)
 expect(vote.created).toBe(true)
 expect(await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE requester_id=?').bind(vote.requesterId).first('verified_at')).toBeNull()
 expect(await total('requester_update_permissions')).toBe(before.permissions);expect(await total('native_requester_sessions')).toBe(before.sessions)
 const repeated=await json<{created:boolean}>(`/api/operator/requests/${r.slug}/proxy-votes`,{requesterId:vote.requesterId,source:input.source},g.operator)
 expect(repeated.created).toBe(false);expect(await total('penny_proxy_votes')).toBe(1)
 const context=await json<{voters:{id:string;nativeProxy:number;proxyAttributionsJson:string}[];demand:{voteCount:number}}>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(context.demand.voteCount).toBe(2)
 expect(context.voters.find(v=>v.id===vote.requesterId)).toMatchObject({nativeProxy:1})
 expect(context.voters.find(v=>v.id===vote.requesterId)!.proxyAttributionsJson).toContain('Zendesk ticket 738')
 // Opted-in public voter lists still expose proxy customers only in the total.
 expect((await call('/api/operator/boards/regression',{showVoters:true},g.operator,'PATCH')).status).toBe(200)
 const publicBody=await(await call(`/api/public/requests/${r.slug}`)).text()
 for(const secret of ['Casey Bell',contactEmail,'738','recorderId','proxyAttributionsJson'])expect(publicBody).not.toContain(secret)
 // Native fixtures cover mixed, direct-only, zero and proxy-only demand.
 for(const index of [2,3])expect((await call(`/api/public/requests/${g.requests[index].slug}/vote`,undefined,g.person,'DELETE')).status).toBe(204)
 const proxyOnly=await json<{requesterId:string}>(`/api/operator/requests/${g.requests[3].slug}/proxy-votes`,{contact:{displayName:'synthetic-penny-5'},source:'Customer interview'},g.operator)
 const actor=await env.DB.prepare('SELECT id,display_name FROM operators').first<{id:string;display_name:string}>()
 const accountIds:string[]=[]
 for(const name of ['synthetic-penny-1','synthetic-penny-2']){
  const account=await json<{id:string}>('/api/operator/accounts',{name,internalOwnerId:actor!.id},g.operator,201)
  accountIds.push(account.id)
  await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(g.recipient.requesterId,account.id,new Date().toISOString()).run()
  await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(proxyOnly.requesterId,account.id,new Date().toISOString()).run()
 }
 const address=await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE id=?').bind(g.recipient.addressId).first<{verified_at:string}>()
 const extraAddress='synthetic-penny-3'+String.fromCharCode(64)+'example.test'
 await env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),g.recipient.requesterId,extraAddress,address!.verified_at,new Date().toISOString(),new Date().toISOString()).run()
 const expected=[
  {slug:r.slug,voters:[{id:g.recipient.requesterId,name:'Private display',proxy:0},{id:vote.requesterId,name:'Casey Bell',proxy:1}]},
  {slug:g.requests[1].slug,voters:[{id:g.recipient.requesterId,name:'Private display',proxy:0}]},
  {slug:g.requests[2].slug,voters:[]},
  {slug:g.requests[3].slug,voters:[{id:proxyOnly.requesterId,name:'synthetic-penny-5',proxy:1}]},
 ]
 const csv=await reconcileVoteCsv(g.operator,g.person,expected)
 expect(csv.find(row=>row.customer_id===vote.requesterId)).toMatchObject({request:r.slug,source:input.source,source_url:input.sourceUrl,recorder_id:actor!.id,recorder:actor!.display_name})
 expect(csv.find(row=>row.customer_id===g.recipient.requesterId)!.addresses.split('; ').sort()).toEqual([g.recipient.email,extraAddress].sort())
 const joined=await json<{voters:{id:string;accountId:string}[];demand:{voteCount:number}}>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(joined.voters.filter(person=>person.id===g.recipient.requesterId)).toHaveLength(4)
 expect([...new Set(joined.voters.filter(person=>person.id===g.recipient.requesterId).map(person=>person.accountId))].sort()).toEqual(accountIds.sort())
 const proxyJoined=await json<typeof joined>(`/api/operator/requests/${g.requests[3].slug}/context`,undefined,g.operator)
 expect(proxyJoined.voters.filter(person=>person.id===proxyOnly.requesterId)).toHaveLength(2)
 expect(proxyJoined.demand.voteCount).toBe(1)
 // Export the current participation after removal and an idempotent repeat vote.
 const directVoters=expected[1].voters
 expect((await call(`/api/public/requests/${g.requests[1].slug}/vote`,undefined,g.person,'DELETE')).status).toBe(204)
 expected[1].voters=[]
 await reconcileVoteCsv(g.operator,g.person,expected)
 for(let attempt=0;attempt<2;attempt++)expect((await call(`/api/public/requests/${g.requests[1].slug}/vote`,{},g.person)).status).toBe(204)
 expected[1].voters=directVoters
 await reconcileVoteCsv(g.operator,g.person,expected)
 expect((await call('/api/public/identity/email',{email:contactEmail,displayName:'Casey Bell'})).status).toBe(202)
 const token=new URLSearchParams(new URL(messages.findLast(m=>m.to===contactEmail)!.url).hash.slice(1)).get('token')
 const verified=await json<{token:string}>('/api/public/identity/email/verify',{token},{})
 expect((await call(`/api/public/requests/${r.slug}/vote`,{},{Authorization:`Bearer ${verified.token}`})).status).toBe(204)
 const after=await json<typeof context>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(after.demand.voteCount).toBe(2);expect(after.voters.find(v=>v.id===vote.requesterId)!.nativeProxy).toBe(0)
 expect(await total('requester_update_permissions')).toBe(before.permissions)
 expected[0].voters[1].proxy=0
 await reconcileVoteCsv(g.operator,g.person,expected)
 expect((await call(`/api/operator/requesters/${vote.requesterId}/block`,{},g.operator)).status).toBe(200)
 expected[0].voters.pop()
 await reconcileVoteCsv(g.operator,g.person,expected)
 expect((await call('/api/auth/sign-out',{},g.operator)).status).toBe(204)
 for(const path of ['/api/operator/requests/export.csv','/api/operator/votes/export.csv']){
  const refused=await call(path,undefined,g.operator)
  expect(refused.status).toBe(401)
  const body=await refused.text()
  for(const value of [r.slug,'Casey Bell','synthetic-penny-5',contactEmail])expect(body).not.toContain(value)
 }
})

it('[CAP-014 REQ-035 REQ-008 REQ-009 DATA-001] retains native source attribution and importance through merge, unmerge and the product archive',async()=>{
 const g=await graph(2),a=g.requests[0],b=g.requests[1]
 expect((await call('/api/operator/boards/regression/vote-importance',{enabled:true,labels:['Nice to have','Important','Must have']},g.operator,'PUT')).status).toBe(200)
 const contact=await json<{requesterId:string}>(`/api/operator/requests/${a.slug}/proxy-votes`,{contact:{displayName:'Morgan Reed'},source:'Sales call, customer explicitly asked',importance:3},g.operator)
 await json(`/api/operator/requests/${b.slug}/proxy-votes`,{requesterId:contact.requesterId,source:'Follow-up support conversation',importance:2},g.operator)
 await json(`/api/operator/requests/${a.slug}/merge`,{targetSlug:b.slug,notifySubscribers:false},g.operator)
 const merged=await json<{demand:{voteCount:number};voters:{id:string;proxyAttributionsJson:string}[]}>(`/api/operator/requests/${b.slug}/context`,undefined,g.operator)
 expect(merged.demand.voteCount).toBe(2);expect(JSON.parse(merged.voters.find(v=>v.id===contact.requesterId)!.proxyAttributionsJson)).toHaveLength(2)
 await json(`/api/operator/requests/${a.slug}/unmerge`,{},g.operator)
 expect((await json<typeof merged>(`/api/operator/requests/${a.slug}/context`,undefined,g.operator)).demand.voteCount).toBe(2)
 const exported=await json<{archive:{tables:{penny_proxy_votes:unknown[];penny_vote_importance:{importance:number}[];penny_vote_importance_settings:{enabled:number;labels_json:string}[]}}}>('/api/operator/data/export',undefined,g.operator)
 expect(exported.archive.tables.penny_proxy_votes).toHaveLength(2)
 expect(exported.archive.tables.penny_vote_importance.map(row=>row.importance).sort()).toEqual([2,3])
 expect(exported.archive.tables.penny_vote_importance_settings).toHaveLength(1)
 const importanceBefore=(await env.DB.prepare('SELECT * FROM penny_vote_importance ORDER BY request_id').all()).results,settingsBefore=(await env.DB.prepare('SELECT * FROM penny_vote_importance_settings').all()).results
 expect(await total('penny_proxy_votes')).toBe(2)
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const operator=await owner(),imported=await call('/api/operator/data/import',exported,operator)
 expect([200,202],await imported.clone().text()).toContain(imported.status)
 let restored=await imported.json() as {operationId:string;status:string}
 for(let step=0;step<100&&restored.status!=='complete';step++)restored=await json(`/api/operator/data/operations/${restored.operationId}/resume`,{},operator)
 expect(restored.status).toBe('complete');expect(await total('penny_proxy_votes')).toBe(2)
 expect((await env.DB.prepare('SELECT * FROM penny_vote_importance ORDER BY request_id').all()).results).toEqual(importanceBefore)
 expect((await env.DB.prepare('SELECT * FROM penny_vote_importance_settings').all()).results).toEqual(settingsBefore)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[CAP-014 DATA-003 DATA-005] refuses stale or invalid authority and rolls back every effect if auditing fails; requester erasure removes proxy custody',async()=>{
 const g=await graph(),r=g.requests[0],input={contact:{displayName:'Sam Rivera'},source:'Customer interview'}
 for(const headers of [{},g.person])expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,headers)).status).toBe(401)
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,{...g.operator,Origin:'https://other.test'})).status).toBe(403)
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,{contact:{displayName:'Sam'},source:''},g.operator)).status).toBe(400)
 await env.DB.exec("CREATE TRIGGER refuse_proxy_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.proxy_vote_recorded' BEGIN SELECT RAISE(ABORT,'test_audit_refused'); END;")
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,g.operator)).status).toBe(503)
 expect(await total('penny_proxy_votes')).toBe(0);expect(await env.DB.prepare("SELECT COUNT(*) n FROM requesters WHERE display_name='Sam Rivera'").first('n')).toBe(0)
 await env.DB.exec('DROP TRIGGER refuse_proxy_audit;')
 const person=await json<{requesterId:string}>(`/api/operator/requests/${r.slug}/proxy-votes`,input,g.operator)
 const expected=[{slug:r.slug,voters:[{id:g.recipient.requesterId,name:'Private display',proxy:0},{id:person.requesterId,name:input.contact.displayName,proxy:1}]}]
 await reconcileVoteCsv(g.operator,g.person,expected)
 const root={table:'requesters',id:person.requesterId},preview=await json<{planHash:string}>('/api/operator/data/erasure/preview',root,g.operator)
 const response=await call('/api/operator/data/erasure',{...root,planHash:preview.planHash},g.operator)
 expect([200,202],await response.clone().text()).toContain(response.status)
 let erased=await response.json() as {operationId:string;status:string}
 for(let step=0;step<100&&erased.status!=='complete';step++)erased=await json(`/api/operator/data/operations/${erased.operationId}/resume`,{},g.operator)
 expect(erased.status).toBe('complete');expect(await total('penny_proxy_votes')).toBe(0)
 expected[0].voters.pop()
 await reconcileVoteCsv(g.operator,g.person,expected)
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,{requesterId:person.requesterId,source:input.source},g.operator)).status).toBe(409)
 await reconcileVoteCsv(g.operator,g.person,expected)
})

it('[CAP-014 API-001 API-002] server-held scoped keys record proxy demand, refuse a read-only key and stop on revocation',async()=>{
 const g=await graph(),r=g.requests[0]
 const issue=(scopes:string[])=>json<{token:string;credential:{id:string}}>('/api/operator/integrations/keys',{name:'Zendesk sidebar',scopes},g.operator,201)
 const denied=await issue(['requests:read']),allowed=await issue(['requests:read','votes:write'])
 const input={contact:{displayName:'Zendesk customer',email:'synthetic-penny-1'+String.fromCharCode(64)+'example.test'},source:'Zendesk ticket 1108',sourceUrl:'https://harbor.zendesk.com/agent/tickets/1108'}
 const endpoint=`/api/v1/requests/${r.slug}/proxy-votes`,key={Authorization:'Bearer '+allowed.token},readOnly={Authorization:'Bearer '+denied.token}
 const snapshot=async()=>({
  votes:(await env.DB.prepare('SELECT * FROM request_votes ORDER BY request_id,requester_id').all()).results,
  contributions:(await env.DB.prepare('SELECT * FROM request_vote_contributions ORDER BY request_id,requester_id').all()).results,
  proxies:(await env.DB.prepare('SELECT * FROM penny_proxy_votes ORDER BY request_id,requester_id').all()).results,
  permissions:(await env.DB.prepare('SELECT * FROM requester_update_permissions ORDER BY 1,2').all()).results,
  requesters:(await env.DB.prepare('SELECT * FROM requesters ORDER BY id').all()).results,
  addresses:(await env.DB.prepare('SELECT * FROM requester_addresses ORDER BY id').all()).results,
  sessions:(await env.DB.prepare('SELECT * FROM native_requester_sessions ORDER BY id').all()).results,
 })
 const before=await snapshot()
 expect(before.votes).not.toHaveLength(0);expect(before.permissions).not.toHaveLength(0)
 expect((await call(endpoint,input,readOnly)).status).toBe(401)
 expect(await snapshot()).toEqual(before)
 const recorded=await json<{requesterId:string;created:boolean}>(endpoint,input,key)
 expect(recorded.created).toBe(true)
 const after=await snapshot(),actor=await env.DB.prepare('SELECT id FROM operators').first('id')
 expect(after.votes).toHaveLength(before.votes.length+1)
 expect(after.votes).toContainEqual(expect.objectContaining({request_id:r.id,requester_id:recorded.requesterId}))
 expect(after.contributions).toHaveLength(before.contributions.length+1)
 expect(after.contributions).toContainEqual(expect.objectContaining({request_id:r.id,requester_id:recorded.requesterId}))
 expect(after.proxies).toEqual([expect.objectContaining({request_id:r.id,requester_id:recorded.requesterId,recorder_operator_id:actor,source:input.source,source_url:input.sourceUrl,direct_vote_at:null})])
 expect(after.addresses.find(row=>row.requester_id===recorded.requesterId)).toMatchObject({email:input.contact.email,verified_at:null})
 expect(after.permissions).toEqual(before.permissions);expect(after.sessions).toEqual(before.sessions)
 const context=await json<{voters:{id:string;nativeProxy:number;proxyAttributionsJson:string}[];demand:{voteCount:number}}>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(context.demand.voteCount).toBe(before.votes.length+1)
 expect(context.voters.find(person=>person.id===recorded.requesterId)).toMatchObject({nativeProxy:1})
 expect(context.voters.find(person=>person.id===recorded.requesterId)!.proxyAttributionsJson).toContain(input.source)
 // Refusal also preserves existing proxy demand and granted update permissions.
 expect((await call(endpoint,{contact:{displayName:'synthetic-penny-2'},source:'synthetic-penny-2'},readOnly)).status).toBe(401)
 expect(await snapshot()).toEqual(after)
 const contacts=await json<{id:string}[]>('/api/v1/proxy-vote-contacts?q=synthetic-penny-1',undefined,key)
 expect(contacts.map(person=>person.id)).toEqual([recorded.requesterId])
 expect((await call(`/api/operator/integrations/keys/${allowed.credential.id}`,undefined,g.operator,'DELETE')).status).toBe(200)
 const revoked=await snapshot()
 expect((await call(endpoint,{requesterId:recorded.requesterId,source:input.source},key)).status).toBe(401)
 expect((await call(endpoint,{contact:{displayName:'synthetic-penny-3'},source:'synthetic-penny-3'},key)).status).toBe(401)
 expect(await snapshot()).toEqual(revoked)
 expect(await total('penny_proxy_votes')).toBe(1)
})
