import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,requester } from './support'
import { graph,runtime,rows,provider,start,time } from './notification-regression-fixture'
import { observeD1,barrier } from './review-race-storage'
import { RequestOperatorRepository } from '@/core/features/requests/operator-repository'
import { RequestWriteRepository } from '@/core/features/requests/write-repository'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { prepareBatches } from '@/core/features/notifications/batches'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())

async function overlappingQueues(){
 const g=await graph(),otherSession=await requester()
 const other=(await env.DB.prepare('SELECT id AS addressId,requester_id AS requesterId,email FROM requester_addresses WHERE requester_id!=?').bind(g.recipient.requesterId).first<{addressId:string;requesterId:string;email:string}>())!
 await g.publish(0,'Source-only event')
 expect((await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},otherSession)).status).toBe(204)
 await g.publish(0,'Shared event',1000)
 const source={...g.recipient,verifiedEmail:g.recipient.email,displayName:'Requester'},writer=new RequestWriteRepository(runtime().database)
 await writer.unfollow(source,g.requests[0].slug)
 await g.publish(0,'Target-only event',2000)
 await writer.follow(source,g.requests[0].slug,time(2000))
 await prepareBatches(env.DB,time(3000))
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!
 return {...g,other,merge:()=>new RequestOperatorRepository(runtime().database).mergeRequesters(g.recipient.requesterId,other.requesterId,actor.id,time(3603000))}
}
it('[REQ-024 NOTIFY-002 NOTIFY-005] identity merge conflicts atomically while concurrent drains own both sending batches',async()=>{
 const g=await overlappingQueues(),claimed=barrier(),release=barrier()
 let count=0
 const db=observeD1(env.DB,{after:async(sql,result)=>{
  if(sql.some(s=>s.includes("UPDATE notification_batches SET state='sending'"))&&(result as D1Result[])[0].results.length===1){
   if(++count===2)claimed.release()
   await release.promise
  }
 }})
 const r={...runtime(),database:{binding:db}},sent=provider()
 const drains=Promise.all([drainNotifications(r,()=>start+3603000),drainNotifications(r,()=>start+3603000)])
 let conflict:unknown
 try{
  await claimed.promise
  expect((await rows('notification_batches')).filter(row=>row.state==='sending')).toHaveLength(2)
  try{await g.merge()}catch(error){conflict=error}
  const response=await call(`/api/operator/requesters/${g.recipient.requesterId}/merge`,{targetRequesterId:g.other.requesterId},g.operator)
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({error:'identity_merge_notification_active'})
 }finally{release.release();await drains}
 expect(conflict).toMatchObject({status:409,code:'identity_merge_notification_active'})
 expect(await rows('requester_identity_merges')).toHaveLength(0)
 expect(sent).toHaveLength(2)
 for(const email of [g.recipient.email,g.other.email])expect(sent.filter(message=>JSON.stringify(message.body.personalizations).includes(email))).toHaveLength(1)
 expect(sent.filter(message=>JSON.stringify(message).includes('Source-only event'))).toHaveLength(1)
 expect(sent.filter(message=>JSON.stringify(message).includes('Target-only event'))).toHaveLength(1)
 await g.merge()
 await drainNotifications(runtime(),()=>start+7203000)
 expect(sent).toHaveLength(2)
 expect((await rows('notification_batches')).every(row=>row.requester_id===g.other.requesterId&&row.state==='accepted')).toBe(true)
})
it('[REQ-024 NOTIFY-005] merging queued overlaps delivers every unique event and sends their common event only once',async()=>{
 const g=await overlappingQueues();await g.merge()
 const sent=provider()
 await Promise.all([drainNotifications(runtime(),()=>start+3603000),drainNotifications(runtime(),()=>start+3603000)])
 // A sibling claim may defer to the next drain; its unique event remains durable.
 await drainNotifications(runtime(),()=>start+3604000)
 for(const body of ['Source-only event','Shared event','Target-only event'])expect(sent.filter(message=>JSON.stringify(message).includes(body))).toHaveLength(1)
 expect((await rows('notification_batches')).every(row=>row.state==='accepted')).toBe(true)
 await drainNotifications(runtime(),()=>start+7203000);expect(sent).toHaveLength(2)
})
