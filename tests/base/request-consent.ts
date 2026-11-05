import {applyD1Migrations,reset} from 'cloudflare:test'
import {expect,inject,vi} from 'vitest'
import {mockMail,messages} from './support'
import {accepted,call,env,graph,requester} from './subscription-fixture'

export async function proveExplicitConsent(){
 await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()
 try{
 const g=await graph(),emails=new Map<Record<string,string>,string>()
 const person=async(name:string)=>{const headers=await requester(name);emails.set(headers,messages.at(-1)!.to);return headers}
 const author=await person('Consent author'),voter=await person('Consent voter')
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:false,version:g.disclosure.version},g.operator,'PUT'))
 // Keep native D1 authority inside the current day while controlling every grant time.
 const start=new Date(vi.getRealSystemTime()).setUTCHours(12,0,0,0)
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(start)
 const plain=await g.submit(author);await g.publish(plain)
 await accepted(call(`/api/public/requests/${plain}/vote`,{emailUpdates:false},voter),204)
 expect(await g.rows()).toEqual([])
 const activity=async(person:Record<string,string>)=>{
  const response=await accepted(call('/api/public/requester/activity',undefined,person))
  return await response.json() as {votes:{slug:string}[];follows:{slug:string}[]}
 }
 for(const person of [author,voter]){
  expect((await activity(person)).votes.map(row=>row.slug)).toContain(plain)
  expect((await activity(person)).follows).toEqual([])
 }
 const assertGrant=async(person:Record<string,string>,slug:string,source:string,at:number)=>{
  const email=emails.get(person)!,address=await env.DB.prepare('SELECT id,requester_id FROM requester_addresses WHERE email=? AND verified_at IS NOT NULL').bind(email).first<{id:string;requester_id:string}>()
  expect(address).not.toBeNull()
  const requestId=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<string>('id')
  const permissions=(await g.rows()).filter(row=>row.requester_id===address!.requester_id&&row.request_id===requestId)
  expect(permissions).toHaveLength(1)
  expect(permissions[0]).toMatchObject({requester_id:address!.requester_id,requester_address_id:address!.id,request_id:requestId,source,grant_origin:'explicit',board_id:null,setting_version:null,granted_at:new Date(at).toISOString(),revoked_at:null})
  expect((await activity(person)).follows.map(row=>row.slug)).toContain(slug)
  return permissions[0]
 }
 vi.setSystemTime(start+60_000)
 const checked=await g.submit(author,true);await g.publish(checked)
 await assertGrant(author,checked,'submission',start+60_000)
 await accepted(call(`/api/public/requests/${plain}/vote`,undefined,voter,'DELETE'),204)
 vi.setSystemTime(start+120_000)
 await accepted(call(`/api/public/requests/${plain}/vote`,{emailUpdates:true},voter),204)
 await assertGrant(voter,plain,'vote',start+120_000)
 // A replay cannot move the original permission's grant time or duplicate it.
 vi.setSystemTime(start+180_000)
 await accepted(call(`/api/public/requests/${plain}/vote`,{emailUpdates:true},voter),204)
 await assertGrant(voter,plain,'vote',start+120_000)
 const follower=await person('Explicit follower')
 vi.setSystemTime(start+240_000)
 await accepted(call(`/api/public/requests/${plain}/follow`,{},follower),204)
 await assertGrant(follower,plain,'follow',start+240_000)
 const before=await g.rows()
 expect((await call(`/api/public/requests/${plain}/follow`,{})).status).toBe(401)
 expect(await g.rows()).toEqual(before)
 vi.setSystemTime(start+300_000)
 for(const [person,slug] of [[author,checked],[voter,plain],[follower,plain]] as const){
  await accepted(call(`/api/public/requests/${slug}/follow`,undefined,person,'DELETE'),204)
  expect((await activity(person)).follows).toEqual([])
 }
 const revoked=await g.rows()
 expect(revoked).toHaveLength(3)
 for(const row of revoked)expect(row.revoked_at).toBe(new Date(start+300_000).toISOString())
 expect((await activity(voter)).votes.map(row=>row.slug)).toContain(plain)
 }finally{vi.useRealTimers()}
}
