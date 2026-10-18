import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester,messages} from './support'
import {opaqueToken} from '@/core/features/auth/native-tokens'
import {graph} from './notification-regression-fixture'
beforeEach(async()=>{vi.restoreAllMocks();await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())
const levels=['Nice to have','Important','Must have']
const json=async<T>(path:string,body:unknown,headers:Record<string,string>,method=body===undefined?'GET':'POST',status=200):Promise<T>=>{const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
const settings=(operator:Record<string,string>,labels=levels,enabled=true)=>json('/api/operator/boards/regression/vote-importance',{enabled,labels},operator,'PUT')
type Context={voters:{id:string;importance:number|null}[];importanceLabels:string[];demand:{voteCount:number}}

it('[REQ-035 CAP-014] keeps optional vote importance private, permits change/clear and records stated proxy importance with configurable three or four labels',async()=>{
 const g=await graph(),r=g.requests[0],person=await requester('Finance voter'),vote=`/api/public/requests/${r.slug}/vote`,choice=`/api/public/requests/${r.slug}/vote-importance`
 const permissions=await env.DB.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n')
 expect((await call(vote,{importance:3},person)).status).toBe(409)
 await settings(g.operator)
 expect((await call(vote,{importance:3},person)).status).toBe(204)
 const pending=opaqueToken()
 expect((await call(vote,{importance:1},{'X-Penny-Pending-Token':pending})).status).toBe(202)
 expect((await call('/api/public/identity/email',{email:'importance-pending@example.test',displayName:'Held voter',pendingToken:pending})).status).toBe(202)
 const heldToken=new URLSearchParams(new URL(messages.findLast(message=>message.to==='importance-pending@example.test')!.url).hash.slice(1)).get('token')
 const verified=await call('/api/public/identity/email/verify',{token:heldToken});expect(verified.status).toBe(200)
 const held={Authorization:`Bearer ${(await verified.json() as {token:string}).token}`}
 expect((await json<{votes:{importance:number|null}[]}>('/api/public/requester/activity',undefined,held)).votes[0].importance).toBe(1)
 expect((await call(vote,undefined,held,'DELETE')).status).toBe(204)
 const activity=()=>json<{votes:{slug:string;importance:number|null}[]}>('/api/public/requester/activity',undefined,person)
 expect((await activity()).votes.find(v=>v.slug===r.slug)!.importance).toBe(3)
 let context=await json<Context>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(context.voters.filter(v=>v.importance===3)).toHaveLength(1)
 expect((await call(choice,{importance:2},person,'PATCH')).status).toBe(204)
 expect((await activity()).votes.find(v=>v.slug===r.slug)!.importance).toBe(2)
 expect((await call(choice,{importance:null},person,'PATCH')).status).toBe(204)
 expect((await activity()).votes.find(v=>v.slug===r.slug)!.importance).toBeNull()
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n')).toBe(permissions)
 const publicBytes=await(await call(`/api/public/requests/${r.slug}`)).text()
 for(const field of ['importance','Importance','Must have'])expect(publicBytes).not.toContain(field)
 expect((await call(choice,{importance:4},person,'PATCH')).status).toBe(409)
 const labels=['Occasional','Useful','Business critical','Release blocker'];await settings(g.operator,labels)
 const boards=await json<{slug:string;subscriptionDisclosure:{version:number}}[]>('/api/public/boards',undefined,{})
 await json('/api/operator/boards/regression/vote-subscriptions',{enabled:true,version:boards.find(board=>board.slug==='regression')!.subscriptionDisclosure.version},g.operator,'PUT')
 await json(`/api/operator/requests/${r.slug}/proxy-votes`,{contact:{displayName:'Sales customer'},source:'Customer described a release blocker',importance:4},g.operator)
 context=await json<Context>(`/api/operator/requests/${r.slug}/context`,undefined,g.operator)
 expect(context.importanceLabels).toEqual(labels);expect(context.voters.filter(v=>v.importance===4)).toHaveLength(1)
 expect(context.demand.voteCount).toBe(3)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requester_update_permissions').first('n')).toBe(permissions)
 const csv=await call('/api/operator/votes/export.csv',undefined,g.operator)
 expect(await csv.text()).toMatch(/Sales customer.*"4".*Customer described a release blocker/)
 await settings(g.operator,labels,false)
 expect((await call(choice,{importance:2},person,'PATCH')).status).toBe(409)
 expect((await call(choice,{importance:null},person,'PATCH')).status).toBe(204)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM penny_vote_importance WHERE importance=4').first('n')).toBe(1)
})

it('[REQ-035 REQ-008 REQ-009] projects the latest person choice through merge and restores origin custody on unmerge',async()=>{
 const g=await graph(2),a=g.requests[0],b=g.requests[1],person=await requester('Customer with two requests')
 await settings(g.operator)
 for(const [request,importance] of [[a,1],[b,3]] as const)expect((await call(`/api/public/requests/${request.slug}/vote`,{importance},person)).status).toBe(204)
 await json(`/api/operator/requests/${a.slug}/merge`,{targetSlug:b.slug,notifySubscribers:false},g.operator)
 const context=await json<Context>(`/api/operator/requests/${b.slug}/context`,undefined,g.operator)
 expect(context.demand.voteCount).toBe(2);expect(context.voters.filter(v=>v.importance===3)).toHaveLength(1)
 expect((await call(`/api/public/requests/${b.slug}/vote-importance`,{importance:2},person,'PATCH')).status).toBe(204)
 await json(`/api/operator/requests/${a.slug}/unmerge`,{},g.operator)
 for(const request of [a,b])expect((await json<Context>(`/api/operator/requests/${request.slug}/context`,undefined,g.operator)).voters.filter(v=>v.importance===2)).toHaveLength(1)
 expect((await call(`/api/public/requests/${a.slug}/vote`,undefined,person,'DELETE')).status).toBe(204)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM penny_vote_importance WHERE request_id=?').bind(a.id).first('n')).toBe(0)
})

it('[REQ-035 BASE-ACCESS-004] refuses absent votes, foreign origins, invalid choices and non-owner settings; audit refusal preserves the previous configuration',async()=>{
 const g=await graph(),r=g.requests[0],person=await requester('Not a voter'),path='/api/operator/boards/regression/vote-importance'
 for(const headers of [{},person])expect((await call(path,{enabled:true,labels:levels},headers,'PUT')).status).toBe(401)
 expect((await call(path,{enabled:true,labels:levels},{...g.operator,Origin:'https://other.test'},'PUT')).status).toBe(403)
 expect((await call('/api/operator/settings/operators',{email:'importance-peer@example.test'},g.operator)).status).toBe(202)
 const token=new URL(messages.findLast(message=>message.to==='importance-peer@example.test')!.url).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token}),peer={Cookie:confirmed.headers.get('Set-Cookie')!.split(';')[0]}
 expect(confirmed.status).toBe(303)
 expect((await call(path,{enabled:true,labels:levels},peer,'PUT')).status).toBe(403)
 await settings(g.operator)
 expect((await call(`/api/public/requests/${r.slug}/vote-importance`,{importance:1},person,'PATCH')).status).toBe(409)
 expect((await call(`/api/public/requests/${r.slug}/vote`,{importance:0},person)).status).toBe(400)
 await env.DB.exec("CREATE TRIGGER refuse_importance_audit BEFORE INSERT ON audit_entries WHEN NEW.action='board.vote_importance_saved' BEGIN SELECT RAISE(ABORT,'test_audit_refused'); END;")
 expect((await call(path,{enabled:false,labels:['Low','Medium','High']},g.operator,'PUT')).status).toBe(503)
 const current=await json<{enabled:boolean;labels:string[]}>(path,undefined,g.operator)
 expect(current.enabled).toBe(true);expect(current.labels).toEqual(levels)
})
