import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester} from './support'
import {graph} from './notification-regression-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())

it('[REQ-026] private demand counts people, evidence and accounts separately, preserves every attribution and excludes removed or blocked votes',async()=>{
 const g=await graph(),r=g.requests[0],second=await requester('Morgan Reed'),third=await requester('Sam Rivera')
 const actor=await env.DB.prepare('SELECT id FROM operators').first<string>('id')
 const json=async<T>(path:string,body?:unknown,headers:Record<string,string>=g.operator,status=200):Promise<T>=>{
  const response=await call(path,body,headers);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>
 }
 const accounts=[]
 for(const name of ['Harbor Analytics','Northstar Logistics','Cedar Health'])accounts.push(await json<{id:string;slug:string}>('/api/operator/accounts',{name,internalOwnerId:actor},g.operator,201))
 for(const identity of [second,third])expect((await call(`/api/public/requests/${r.slug}/vote`,{},identity)).status).toBe(204)
 const people=(await env.DB.prepare('SELECT id,display_name FROM requesters ORDER BY created_at,id').all<{id:string;display_name:string}>()).results
 const author=people.find(person=>person.display_name==='Private display')!,morgan=people.find(person=>person.display_name==='Morgan Reed')!,sam=people.find(person=>person.display_name==='Sam Rivera')!
 const now=new Date().toISOString()
 // Associations are private fixture inputs; the votes and demand are read through real routes.
 for(const [person,account] of [[author,accounts[0]],[morgan,accounts[0]],[morgan,accounts[1]],[sam,accounts[1]]] as const)
  await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(person.id,account.id,now).run()
 const address=await env.DB.prepare('SELECT * FROM requester_addresses WHERE requester_id=?').bind(morgan.id).first<Record<string,unknown>>()
 await env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),morgan.id,'morgan.secondary@example.test',address!.verified_at,now,now).run()
 await json('/api/operator/evidence',{sourceType:'sales_call',wording:'Finance exports prevent manual reconciliation.',observedAt:now,accountId:accounts[2].id,requestLinks:[{id:r.id,stance:'supporting'}]},g.operator,201)
 type Context={demand:{voteCount:number;evidenceCount:number;accountCount:number};voters:{id:string;email:string;accountName:string}[];votesByAccount:{name:string;voteCount:number}[]}
 const context=()=>json<Context>(`/api/operator/requests/${r.slug}/context`)
 const initial=await context()
 expect(initial.demand).toEqual({voteCount:3,evidenceCount:2,accountCount:3})
 expect(initial.votesByAccount.map(account=>[account.name,account.voteCount])).toEqual([['Harbor Analytics',2],['Northstar Logistics',2]])
 expect(initial.voters.filter(person=>person.id===morgan.id)).toHaveLength(4)
 expect(initial.voters).toEqual(expect.arrayContaining([expect.objectContaining({email:'morgan.secondary@example.test',accountName:'Harbor Analytics'}),expect.objectContaining({email:'morgan.secondary@example.test',accountName:'Northstar Logistics'})]))
 for(const identity of [{},second])expect((await call(`/api/operator/requests/${r.slug}/context`,undefined,identity)).status).toBe(401)
 const publicBody=await(await call(`/api/public/requests/${r.slug}`)).text()
 for(const privateValue of ['morgan.secondary@example.test','Harbor Analytics','Northstar Logistics','Cedar Health','votesByAccount','evidenceCount','accountCount'])expect(publicBody).not.toContain(privateValue)
 expect((await call(`/api/operator/requesters/${sam.id}/block`,{},g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${r.slug}/vote`,undefined,second,'DELETE')).status).toBe(204)
 const changed=await context()
 expect(changed.demand).toEqual({voteCount:1,evidenceCount:2,accountCount:2})
 expect(changed.votesByAccount).toMatchObject([{name:'Harbor Analytics',voteCount:1}])
 expect(changed.voters.map(person=>person.id)).toEqual([author.id])
})
