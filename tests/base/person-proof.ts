import {expect} from 'vitest'
import {call,env} from './support'
export async function personProof(g:{operator:Record<string,string>;person:Record<string,string>;recipient:{requesterId:string}}){
 const json=async<T>(path:string,body?:unknown,status=200)=>{const response=await call(path,body,g.operator);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
 const post=await call('/api/public/requests',{title:'synthetic-penny-5',description:'Second customer post',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},g.person)
 expect(post.status).toBe(201)
 const second=await post.json() as {slug:string;id:string}
 expect((await call('/api/operator/moderation/'+second.slug,{verdict:'approved',title:'synthetic-penny-5',description:'Second customer post',boardSlug:'regression',displayName:'synthetic-penny-5'},g.operator)).status).toBe(200)
 expect((await call('/api/public/requests/'+second.slug+'/vote',undefined,g.person,'DELETE')).status).toBe(204)
 const actor=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<string>('id')
 const account=await json<{id:string;slug:string}>('/api/operator/accounts',{name:'synthetic-penny-6',internalOwnerId:actor,revenueCents:12000},201)
 await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(g.recipient.requesterId,account.id,new Date().toISOString()).run()
 const evidence=await json<{id:string}>('/api/operator/evidence',{sourceType:'support_conversation',sourceLabel:'https://harbor.zendesk.com/agent/tickets/738',wording:'synthetic-penny-7',observedAt:new Date().toISOString(),accountId:account.id},201)
 await json('/api/operator/requests/'+second.slug+'/proxy-votes',{requesterId:g.recipient.requesterId,source:'synthetic-penny-7',sourceUrl:'https://harbor.zendesk.com/agent/tickets/738',evidenceId:evidence.id})

 const field=await json<{id:string}>('/api/operator/settings/custom-fields',{entityType:'requester',name:'synthetic-penny-14',fieldType:'text'},201)
 expect((await call('/api/operator/custom-fields/requester/'+field.id+'/'+g.recipient.requesterId,{value:'synthetic-penny-15'},g.operator,'PUT')).status).toBe(200)
 const path='/api/operator/people/'+g.recipient.requesterId
 const person=await json<{displayName:string;addresses:{verifiedAt:string|null;suppressedAt:string|null}[];customFields:{name:string;value:unknown}[];submitted:{href:string}[];votes:{href:string;proxy:number}[];comments:{href:string}[];evidence:{href:string;sourceUrls:string[]}[];accounts:{href:string;revenueCents:number}[];follows:unknown[];permissions:unknown[];outcomes:unknown[]}>(path)
 expect(person.addresses.some(a=>a.verifiedAt!==null)).toBe(true);expect(person.customFields).toContainEqual({name:'synthetic-penny-14',value:'synthetic-penny-15'})
 expect(person.submitted).toHaveLength(2);expect(person.votes).toHaveLength(3);expect(person.comments).toHaveLength(1);expect(person.votes.some(v=>v.proxy===1)).toBe(true)
 expect(person.evidence).toContainEqual(expect.objectContaining({sourceUrls:['https://harbor.zendesk.com/agent/tickets/738']}))
 expect(person.accounts).toContainEqual(expect.objectContaining({revenueCents:12000}))
 expect(person.follows.length).toBeGreaterThan(0);expect(person.permissions.length).toBeGreaterThan(0);expect(person.outcomes.length).toBeGreaterThan(0)
 for(const record of [...person.submitted,...person.votes,...person.comments,...person.evidence,...person.accounts])expect((await call(record.href,undefined,g.operator)).status,record.href).toBe(200)
 for(const headers of [{},g.person])for(const url of [path,'/app/customers/people-'+g.recipient.requesterId])expect((await call(url,undefined,headers)).status).toBe(404)
 for(const url of ['/api/public/boards','/api/public/requests','/api/public/roadmap','/api/public/releases'])expect(await(await call(url)).text()).not.toContain('/app/customers/people-')
 const issued=await json<{token:string}>('/api/operator/integrations/keys',{name:'synthetic-penny-13',scopes:['requests:read','releases:read']},201)
 for(const url of ['/api/v1/boards','/api/v1/requests','/api/v1/releases'])expect(await(await call(url,undefined,{Authorization:'Bearer '+issued.token})).text()).not.toContain('/app/customers/people-')
 return {second,account,evidence}
}
