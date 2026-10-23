import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterAll,expect,inject,it,vi } from 'vitest'
import { call,env,messages,owner } from './support'
import { graph } from './notification-regression-fixture'
beforeEach(async()=>{vi.restoreAllMocks();await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())
const json=async<T>(path:string,body:unknown,headers:Record<string,string>,status=200):Promise<T>=>{const response=await call(path,body,headers);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
const total=async(table:string)=>env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first<number>('n')

it('[CAP-014 REQ-026 REQ-010] records inbox-sourced customer demand once, without verification or consent, and collapses with the customer’s later own vote',async()=>{
 const g=await graph(),r=g.requests[0],before={permissions:await total('requester_update_permissions'),sessions:await total('native_requester_sessions')}
 const evidence=await json<{id:string}>('/api/operator/evidence',{sourceType:'support_conversation',wording:'Customer needs monthly exports.',observedAt:new Date().toISOString(),requestLinks:[{id:r.id,stance:'supporting'}]},g.operator,201)
 const input={contact:{displayName:'Casey Bell',email:'casey@example.test'},source:'Zendesk ticket 738: monthly export request',sourceUrl:'https://harbor.zendesk.com/agent/tickets/738',evidenceId:evidence.id}
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
 for(const secret of ['Casey Bell','casey@example.test','738','recorderId','proxyAttributionsJson'])expect(publicBody).not.toContain(secret)
 const csv=await call('/api/operator/votes/export.csv',undefined,g.operator)
 expect(csv.status).toBe(200);const csvText=await csv.text();expect(csvText).toContain(vote.requesterId);expect(csvText).toContain('Casey Bell');expect(csvText).not.toContain('casey@example.test');expect(csvText).toContain((await env.DB.prepare('SELECT display_name FROM operators ORDER BY id LIMIT 1').first<string>('display_name'))!)
 expect((await call('/api/public/identity/email',{email:'casey@example.test',displayName:'Casey Bell'})).status).toBe(202)
 const token=new URLSearchParams(new URL(messages.findLast(m=>m.to==='casey@example.test')!.url).hash.slice(1)).get('token')
 const verified=await json<{token:string}>('/api/public/identity/email/verify',{token},{})
 expect((await call(`/api/public/requests/${r.slug}/vote`,{},{Authorization:`Bearer ${verified.token}`})).status).toBe(204)
 const after=await json<typeof context>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(after.demand.voteCount).toBe(2);expect(after.voters.find(v=>v.id===vote.requesterId)!.nativeProxy).toBe(0)
 expect(await total('requester_update_permissions')).toBe(before.permissions)
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

it('[CAP-014 DATA-003] refuses stale or invalid authority and rolls back every effect if auditing fails; requester erasure removes proxy custody',async()=>{
 const g=await graph(),r=g.requests[0],input={contact:{displayName:'Sam Rivera'},source:'Customer interview'}
 for(const headers of [{},g.person])expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,headers)).status).toBe(401)
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,{...g.operator,Origin:'https://other.test'})).status).toBe(403)
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,{contact:{displayName:'Sam'},source:''},g.operator)).status).toBe(400)
 await env.DB.exec("CREATE TRIGGER refuse_proxy_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.proxy_vote_recorded' BEGIN SELECT RAISE(ABORT,'test_audit_refused'); END;")
 expect((await call(`/api/operator/requests/${r.slug}/proxy-votes`,input,g.operator)).status).toBe(503)
 expect(await total('penny_proxy_votes')).toBe(0);expect(await env.DB.prepare("SELECT COUNT(*) n FROM requesters WHERE display_name='Sam Rivera'").first('n')).toBe(0)
 await env.DB.exec('DROP TRIGGER refuse_proxy_audit;')
 const person=await json<{requesterId:string}>(`/api/operator/requests/${r.slug}/proxy-votes`,input,g.operator)
 const root={table:'requesters',id:person.requesterId},preview=await json<{planHash:string}>('/api/operator/data/erasure/preview',root,g.operator)
 const response=await call('/api/operator/data/erasure',{...root,planHash:preview.planHash},g.operator)
 expect([200,202],await response.clone().text()).toContain(response.status)
 let erased=await response.json() as {operationId:string;status:string}
 for(let step=0;step<100&&erased.status!=='complete';step++)erased=await json(`/api/operator/data/operations/${erased.operationId}/resume`,{},g.operator)
 expect(erased.status).toBe('complete');expect(await total('penny_proxy_votes')).toBe(0)
})

it('[CAP-014 API-001 API-002] server-held scoped keys record proxy demand, refuse a read-only key and stop on revocation',async()=>{
 const g=await graph(),r=g.requests[0]
 const issue=(scopes:string[])=>json<{token:string;credential:{id:string}}>('/api/operator/integrations/keys',{name:'Zendesk sidebar',scopes},g.operator,201)
 const denied=await issue(['requests:read']),allowed=await issue(['requests:read','votes:write'])
 const input={contact:{displayName:'Zendesk customer',email:'zendesk.customer@example.test'},source:'Zendesk ticket 1108',sourceUrl:'https://harbor.zendesk.com/agent/tickets/1108'}
 const endpoint=`/api/v1/requests/${r.slug}/proxy-votes`,key={Authorization:'Bearer '+allowed.token}
 expect((await call(endpoint,input,{Authorization:'Bearer '+denied.token})).status).toBe(401)
 const recorded=await json<{requesterId:string}>(endpoint,input,key)
 expect(await env.DB.prepare('SELECT recorder_operator_id FROM penny_proxy_votes WHERE requester_id=?').bind(recorded.requesterId).first('recorder_operator_id')).toBe(await env.DB.prepare('SELECT id FROM operators').first('id'))
 const contacts=await json<{id:string}[]>('/api/v1/proxy-vote-contacts?q=zendesk.customer',undefined,key)
 expect(contacts.map(person=>person.id)).toEqual([recorded.requesterId])
 expect((await call(`/api/operator/integrations/keys/${allowed.credential.id}`,undefined,g.operator,'DELETE')).status).toBe(200)
 expect((await call(endpoint,{requesterId:recorded.requesterId,source:input.source},key)).status).toBe(401)
 expect(await total('penny_proxy_votes')).toBe(1)
})
