import {applyD1Migrations,createScheduledController,reset} from 'cloudflare:test'
import {exports} from 'cloudflare:workers'
import {expect,inject,vi} from 'vitest'
import {call,env} from './support'
import {graph,rows} from './notification-regression-fixture'
import {weeklyRelease} from './weekly-summary-release'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import type {OperatorReleaseDetail} from '@/core/shared/api/operator'
import type {CurrentPublicRelease} from '@/core/features/releases/public-read-repository'

type DeliveryView={id:string;kind:string;releaseId:string;releaseSlug:string;releaseVersionId:string;state:string;provider:string;attemptCount:number;failureReason:string|null;attemptId:string|null;attemptState:string|null}
async function json<T>(response:Promise<Response>):Promise<T>{
 const result=await response
 expect(result.status,await result.clone().text()).toBe(200)
 return result.json() as Promise<T>
}

/** Real publication, scheduler and reads; only the mail HTTP edge is replaced. */
export async function proveReleaseFailureVisibility(){
 for(const provider of ['sendgrid','resend'] as const){
  for(const outcome of ['rejected','rate_limited','recovered','expired','ambiguous','interrupted','accepted'] as const){
   await reset();await applyD1Migrations(env.DB,inject('migrations'));vi.restoreAllMocks()
   vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'))
   try{
    const g=await graph(1),release=await weeklyRelease(g.operator,g.requests[0].id)
    const publicPath=`/api/public/releases/${release.slug}`,pagePath=`/portal/updates/${release.slug}`
    const baseline=await json<CurrentPublicRelease>(call(publicPath))
    expect(baseline).toMatchObject({slug:release.slug,versionNumber:1,isCurrent:true,title:'Scheduled exports are available',body:'Public weekly release wording'})
    const deliveries=await rows('notification_outbox')
    expect(deliveries).toHaveLength(1)
    const delivery=deliveries[0]
    expect(delivery).toMatchObject({event_type:'release_version',subject_id:release.versionId,requester_id:g.recipient.requesterId,address_id:g.recipient.addressId,delivery_state:'queued',attempt_count:0,created_at:new Date().toISOString(),available_at:new Date().toISOString()})
    const available=async()=>{
     expect(await json(call(publicPath))).toEqual(baseline)
     expect(await json(call('/api/public/releases'))).toEqual([baseline])
     for(const path of [pagePath,'/portal/updates']){
      const response=await call(path)
      expect(response.status).toBe(200)
      const html=await response.text()
      // Read visible server-rendered markup, excluding serialized loader data.
      const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
      expect(markup).toContain(baseline.title);expect(markup).toContain(baseline.body)
      if(path==='/portal/updates')expect(markup).toContain(`href="${pagePath}"`)
     }
    }
    const readDelivery=async(state:string,count:number,reason:string|null)=>{
     const view=await call('/api/operator/notifications',undefined,g.operator)
     expect(view.status).toBe(200);expect(view.headers.get('Cache-Control')).toBe('no-store')
     const {deliveries}=await view.json() as {deliveries:DeliveryView[]}
     expect(deliveries).toHaveLength(1)
     expect(deliveries[0]).toMatchObject({id:delivery.id,kind:'release',releaseId:release.id,releaseSlug:release.slug,releaseVersionId:release.versionId,state,provider,attemptCount:count,failureReason:reason})
     const detail=await json<OperatorReleaseDetail>(call(`/api/operator/releases/${release.slug}`,undefined,g.operator))
     expect(detail).toMatchObject({id:release.id,versionId:release.versionId,slug:release.slug,state:'published',title:baseline.title,body:baseline.body,recipientSnapshotCount:1,deliveryCounts:{queued:state==='queued'?1:0,sent:state==='accepted'?1:0,failed:state==='failed'?1:0,unknown:state==='unknown'?1:0}})
     for(const authority of [{},g.person]){
      expect((await call('/api/operator/notifications',undefined,authority)).status).toBe(401)
      expect((await call(`/api/operator/releases/${release.slug}`,undefined,authority)).status).toBe(401)
     }
     await available()
     return deliveries[0]
    }
    const sent:{key:string;subject:string;text:string}[]=[]
    vi.mocked(fetch).mockImplementation(async(input,init)=>{
     expect(String(input)).toBe(provider==='sendgrid'?'https://api.sendgrid.com/v3/mail/send':'https://api.resend.com/emails')
     expect(init?.method).toBe('POST')
     const body=JSON.parse(String(init?.body)),key=provider==='sendgrid'?body.custom_args.rer_delivery_id:new Headers(init?.headers).get('Idempotency-Key')
     expect(key).toBe(delivery.id)
     const attempts=await rows('notification_outbox_attempts'),attempt=attempts.at(-1)!
     const owned=(await rows('notification_outbox'))[0]
     expect(attempt).toMatchObject({id:owned.claim_id,outbox_id:delivery.id,provider,state:'sending'})
     if(provider==='sendgrid')expect(body.custom_args.rer_penny_attempt).toBe(attempt.id)
     sent.push({key,subject:body.subject,text:provider==='sendgrid'?body.content.find((part:{type:string})=>part.type==='text/plain').value:body.text})
     expect(sent.at(-1)).toMatchObject({subject:baseline.title})
     expect(sent.at(-1)!.text).toContain(baseline.body)
     if(outcome==='interrupted'){
      // Start a real SQLite write outage only after the provider received this claim.
      // It rejects both completion and the catch path, leaving durable sending custody.
      await env.DB.exec("CREATE TRIGGER synthetic_penny_completion_outage BEFORE UPDATE ON notification_outbox_attempts WHEN OLD.state='sending' BEGIN SELECT RAISE(ABORT,'synthetic-penny-storage-unavailable'); END;")
     }
     return outcome==='rejected'?new Response(null,{status:400}):outcome==='rate_limited'||outcome==='expired'||outcome==='recovered'&&sent.length===1?new Response(null,{status:429}):outcome==='ambiguous'?new Response(null,{status:503}):provider==='sendgrid'?new Response(null,{status:202,headers:{'x-message-id':'synthetic-penny-1'}}):Response.json({id:'synthetic-penny-1'})
    })
    const bindings={...env,WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:provider,MAIL_API_KEY:'synthetic-penny-1'}
    const worker=exports.default as typeof exports.default&{scheduled(options:{scheduledTime:number;cron:string}):Promise<void>}
    const cron=()=>provider==='sendgrid'&&outcome!=='interrupted'?worker.scheduled({scheduledTime:Date.now(),cron:'* * * * *'}):runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
    if(outcome==='interrupted'){
     try{
      await expect(cron()).rejects.toThrow('synthetic-penny-storage-unavailable')
      expect(sent).toHaveLength(1)
      const attempt=(await rows('notification_outbox_attempts'))[0]
      expect(attempt).toMatchObject({outbox_id:delivery.id,provider,state:'sending',provider_message_id:null})
      expect((await rows('notification_outbox'))[0]).toMatchObject({id:delivery.id,claim_id:attempt.id,delivery_state:'queued',attempt_count:1})
     }finally{await env.DB.exec('DROP TRIGGER IF EXISTS synthetic_penny_completion_outage')}
     vi.setSystemTime(new Date(Date.now()+300001));await cron()
     const view=await readDelivery('unknown',1,'attempt_interrupted_review_required')
     const recovered=(await rows('notification_outbox_attempts'))[0]
     expect(recovered).toMatchObject({outbox_id:delivery.id,provider,state:'unknown',failure_reason:'attempt_interrupted_review_required',provider_message_id:null})
     expect(view).toMatchObject({attemptId:recovered.id,attemptState:'unknown'})
    }else{
     await cron();expect(sent).toHaveLength(1)
     if(outcome==='rejected'||outcome==='rate_limited'){
      const reason=outcome==='rejected'?'provider_rejected':provider==='sendgrid'?'provider_rate_limited':'rate_limited'
      for(let retry=0;retry<5;retry++){
       const row=(await rows('notification_outbox'))[0]
       expect(row.available_at).toBe(new Date(Date.now()+60000*2**retry).toISOString())
       await readDelivery('queued',retry+1,reason)
       vi.setSystemTime(new Date(Date.parse(String(row.available_at))-1));await cron();expect(sent).toHaveLength(retry+1)
       vi.setSystemTime(new Date(Date.now()+1));await cron();expect(sent).toHaveLength(retry+2)
      }
      await readDelivery('failed',6,reason)
     }else if(outcome==='expired'){
      await readDelivery('queued',1,provider==='sendgrid'?'provider_rate_limited':'rate_limited')
      const prior=await rows('notification_outbox_attempts'),firstAttemptAt=(await rows('notification_outbox'))[0].first_attempt_at
      expect(firstAttemptAt).toBe(new Date().toISOString())
      vi.setSystemTime(new Date(Date.now()+3600000));await cron()
      await readDelivery('failed',1,'retry_window_exhausted')
      expect(sent).toHaveLength(1);expect(await rows('notification_outbox_attempts')).toEqual(prior)
     }else if(outcome==='recovered'){
      const queued=(await rows('notification_outbox'))[0]
      await readDelivery('queued',1,provider==='sendgrid'?'provider_rate_limited':'rate_limited')
      vi.setSystemTime(new Date(Date.parse(String(queued.available_at))));await cron()
      await readDelivery('accepted',2,null)
      expect(sent).toHaveLength(2)
     }else{
      const state=outcome==='accepted'?'accepted':'unknown',reason=outcome==='accepted'?null:provider==='sendgrid'?'provider_uncertain':'unexpected_response'
      const view=await readDelivery(state,1,reason)
      expect(view).toMatchObject({attemptId:(await rows('notification_outbox_attempts'))[0].id,attemptState:state})
     }
    }
    const terminal=await rows('notification_outbox'),attempts=await rows('notification_outbox_attempts'),transmissions=[...sent]
    expect(attempts).toHaveLength(outcome==='rejected'||outcome==='rate_limited'?6:outcome==='recovered'?2:1)
    expect(new Set(attempts.map(attempt=>attempt.id)).size).toBe(attempts.length)
    if(outcome==='accepted'||outcome==='recovered'){
     expect(terminal[0]).toMatchObject({provider_message_id:'synthetic-penny-1',accepted_at:new Date().toISOString()})
     expect(attempts.at(-1)).toMatchObject({provider_message_id:'synthetic-penny-1',state:'accepted'})
    }
    for(const message of sent){expect(message.key).toBe(delivery.id);expect(message.subject).toBe(baseline.title);expect(message.text).toContain(baseline.body)}
    expect(attempts.every(attempt=>attempt.outbox_id===delivery.id&&attempt.provider===provider&&attempt.state===(outcome==='rejected'?'rejected':outcome==='rate_limited'||outcome==='expired'?'rate_limited':outcome==='recovered'?(attempt===attempts[0]?'rate_limited':'accepted'):outcome==='accepted'?'accepted':'unknown'))).toBe(true)
    for(const offset of [60000,3600000,86400000]){
     vi.setSystemTime(new Date(Date.now()+offset));await cron()
     expect(sent).toEqual(transmissions)
     expect(await rows('notification_outbox')).toEqual(terminal)
     expect(await rows('notification_outbox_attempts')).toEqual(attempts)
     await available()
    }
   }finally{vi.useRealTimers();vi.restoreAllMocks()}
  }
 }
}
