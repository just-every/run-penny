import {expect} from 'vitest'
import {call,env,requester,messages} from './support'
import type {PersonProfile} from '@/core/features/people/types'
export async function provePersonProfile(operator:Record<string,string>,existing:{id:string;slug:string}){
 const personAuth=await requester('synthetic-penny-2 Alex Chen'),id=await env.DB.prepare("SELECT id FROM requesters WHERE display_name='synthetic-penny-2 Alex Chen'").first<string>('id')
 const json=async<T>(path:string,body?:unknown,headers=operator,method=body===undefined?'GET':'POST',status=200):Promise<T>=>{const r=await call(path,body,headers,method);expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 const actor=await env.DB.prepare('SELECT id FROM operators ORDER BY created_at LIMIT 1').first<string>('id')
 const posts=[]
 for(const title of ['synthetic-penny-3 Monthly finance reports','synthetic-penny-4 Scheduled exports'])posts.push(await json<{slug:string}>('/api/public/requests',{title,description:'Customer feedback about monthly finance workflows.',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},personAuth,'POST',201))
 await json('/api/operator/boards/regression/vote-importance',{enabled:true,labels:['Useful','Important','Essential']},operator,'PUT')
 const evidence=await json<{id:string}>('/api/operator/evidence',{sourceType:'support_conversation',wording:'synthetic-penny-5 Zendesk evidence about monthly exports',observedAt:new Date().toISOString()},operator,'POST',201)
 await json(`/api/operator/requests/${existing.slug}/proxy-votes`,{requesterId:id,source:'synthetic-penny-6 Zendesk ticket',sourceUrl:'https://support.example.test/tickets/6',evidenceId:evidence.id,importance:3})
 const comment=await json<{id:string}>(`/api/public/requests/${existing.slug}/comments`,{body:'synthetic-penny-7 Finance needs this each month.'},personAuth,'POST',201)
 expect((await call(`/api/public/requests/${existing.slug}/follow`,{},personAuth)).status).toBe(204)
 const account=await json<{id:string;slug:string}>('/api/operator/accounts',{name:'synthetic-penny-8 Harbor Analytics',internalOwnerId:actor,revenueCents:960000},operator,'POST',201)
 await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(id,account.id,new Date().toISOString()).run()
 const field=await json<{id:string}>('/api/operator/settings/custom-fields',{name:'synthetic-penny-9 Department',entityType:'requester',fieldType:'text'},operator,'POST',201)
 await json(`/api/operator/custom-fields/requester/${field.id}/${id}`,{value:'Finance'},operator,'PUT')
 const path=`/api/operator/people/${id}`,profile=await json<PersonProfile>(path)
 const section=(key:string)=>profile.sections.find(s=>s.key===key)!.items
 expect(profile).toMatchObject({displayName:'synthetic-penny-2 Alex Chen',blockedAt:null,accounts:[{id:account.id,name:'synthetic-penny-8 Harbor Analytics',href:`/app/customers/${account.slug}`}],customFields:[{name:'synthetic-penny-9 Department',value:'Finance'}]})
 expect(profile.addresses).toHaveLength(1)
 expect(profile.addresses.every(address=>address.verifiedAt!==null)).toBe(true)
 expect(section('submitted').map(item=>item.href)).toEqual(expect.arrayContaining(posts.map(post=>expect.stringContaining(post.slug))))
 expect(section('votes')).toHaveLength(3)
 expect(section('votes').find(item=>item.id===existing.id)?.detail).toContain('Importance: 3 · Proxy vote')
 expect(section('comments')).toMatchObject([{id:comment.id,href:expect.stringContaining(existing.slug)}])
 expect(section('evidence')).toHaveLength(3)
 expect(section('evidence').find(item=>item.id===evidence.id)).toMatchObject({id:evidence.id,href:expect.stringContaining(evidence.id),sourceUrl:'https://support.example.test/tickets/6'})
 expect(section('follows').some(item=>item.id===existing.id)).toBe(true)
 expect(section('permissions').some(item=>item.href.includes(existing.slug)&&item.detail?.includes('Granted'))).toBe(true)
 for(const item of [...section('submitted'),...section('votes'),...section('comments'),...section('evidence'),...profile.accounts])expect((await call(item.href,undefined,{...operator,Accept:'text/html'})).status).toBe(200)
 await json('/api/operator/settings/operators',{email:'synthetic-penny-10@example.test'},operator,'POST',202)
 const token=new URL(messages.findLast(m=>m.to==='synthetic-penny-10@example.test')!.url).searchParams.get('token'),confirmed=await call('/auth/confirm',{token}),peer={Cookie:confirmed.headers.get('Set-Cookie')!.split(';')[0]}
 const peerProfile=await json<PersonProfile>(path,undefined,peer)
 const keys=(value:unknown):string[]=>value&&typeof value==='object'?Object.entries(value).flatMap(([key,child])=>[key,...keys(child)]):[]
 expect(keys(peerProfile).filter(key=>/^(arr|mrr|revenueCents|revenue_cents)$/i.test(key))).toEqual([])
 for(const headers of [{},personAuth]){
  expect((await call(path,undefined,headers)).status).toBe(404)
  expect((await call(`/app/people/${id}`,undefined,{...headers,Accept:'text/html'})).status).toBe(404)
 }
 for(const path of ['/api/public/requests','/api/public/roadmap','/api/public/releases','/portal/feedback','/portal/roadmap','/portal/updates'])expect(await(await call(path)).text()).not.toContain('/app/people/')
 const captured=await json<{requesterId:string}>(`/api/operator/requests/${existing.slug}/proxy-votes`,{contact:{displayName:'synthetic-penny-11 Captured contact',email:'synthetic-penny-11@example.test'},source:'synthetic-penny-12 Customer conversation'})
 expect(await json(`/api/operator/people/${captured.requesterId}`)).toMatchObject({displayName:'synthetic-penny-11 Captured contact',addresses:[{verifiedAt:null}]})
}
