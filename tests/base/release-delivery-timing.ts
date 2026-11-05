import {applyD1Migrations,createMessageBatch,createScheduledController,reset} from 'cloudflare:test'
import {expect,inject,vi} from 'vitest'
import {call,env,requester} from './support'
import {graph,rows} from './notification-regression-fixture'
import {weeklyRelease} from './weekly-summary-release'
import {runNotificationQueue} from '@/core/features/notifications/queue'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'

/** Native publication and mail entry points with controlled time and HTTP edges. */
export async function proveReleaseDeliveryTiming(){
 for(const provider of ['sendgrid','resend'] as const){
  for(const scenario of ['immediate','overnight','quiet-off','scheduled','ordered'] as const){
   await reset();await applyD1Migrations(env.DB,inject('migrations'));vi.restoreAllMocks()
   vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-05T12:00:00Z'))
   try{
    const g=await graph(1),peer=await requester('Second follower')
    expect((await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},peer)).status).toBe(204)
    const clock={timezone:'America/New_York',quietEnabled:true,quietStart:20,quietEnd:8}
    expect((await call('/api/operator/settings/workspace-clock',clock,g.operator,'PUT')).status).toBe(200)
    const release=await weeklyRelease(g.operator,g.requests[0].id,{publish:false})
    if(scenario==='ordered')expect((await call(`/api/operator/requests/${g.requests[0].slug}/status-updates`,{body:'Approved status before the release',status:'under_review',pinned:false,idempotencyKey:crypto.randomUUID()},g.operator)).status).toBe(200)
    // November's Eastern offset makes 13:00 UTC the first permitted minute.
    const publishAt=Date.parse(scenario==='overnight'||scenario==='quiet-off'?'2026-11-06T01:00:00Z':'2026-11-05T14:00:00Z')
    vi.setSystemTime(new Date(publishAt))
    const bindings={...env,MAIL_PROVIDER:provider,MAIL_API_KEY:'synthetic-penny-1'}
    let sequence=0
    const queue=()=>runNotificationQueue(createMessageBatch('feedback-penny-local-jobs',[{id:`synthetic-penny-${++sequence}`,timestamp:Date.now(),attempts:1,body:{kind:'notifications.drain'}}]),bindings)
    const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
    if(scenario==='scheduled'){
     const response=await call(`/api/operator/releases/${release.slug}/schedule`,{localTime:'2026-11-05T09:01'},g.operator)
     expect(response.status).toBe(200)
     expect(await response.json()).toMatchObject({scheduledAt:'2026-11-05T14:01:00.000Z',state:'scheduled'})
     vi.setSystemTime(new Date(publishAt+59999));await cron()
     expect(await rows('notification_outbox')).toEqual([])
     expect((await call(`/api/public/releases/${release.slug}`)).status).toBe(404)
     vi.setSystemTime(new Date(publishAt+60000))
    }else{
     expect((await call(`/api/operator/releases/${release.slug}/publish`,{},g.operator)).status).toBe(200)
    }
    const sent:{key:string;at:number;subject:string;receipt:string}[]=[]
    vi.mocked(fetch).mockImplementation(async(input,init)=>{
     expect(String(input)).toBe(provider==='sendgrid'?'https://api.sendgrid.com/v3/mail/send':'https://api.resend.com/emails')
     expect(init?.method).toBe('POST')
     const body=JSON.parse(String(init?.body)),key=provider==='sendgrid'?body.custom_args.rer_delivery_id:new Headers(init?.headers).get('Idempotency-Key'),receipt=`synthetic-penny-${sent.length+1}`
     sent.push({key,at:Date.now(),subject:body.subject,receipt})
     // Delay the earlier status once; the release must not pass its retry.
     if(scenario==='ordered'&&body.subject!== 'Scheduled exports are available'&&sent.filter(message=>message.key===key).length===1)return new Response(null,{status:429})
     return provider==='sendgrid'?new Response(null,{status:202,headers:{'x-message-id':receipt}}):Response.json({id:receipt})
    })
    const queued=async()=>{
     const commands=await rows('notification_outbox'),snapshots=await rows('release_recipient_snapshots')
     expect(commands).toHaveLength(2);expect(snapshots).toHaveLength(2)
     expect(new Set(commands.map(row=>row.requester_id)).size).toBe(2)
     for(const command of commands){
      expect(command).toMatchObject({event_type:'release_version',subject_id:release.versionId,delivery_state:'queued',attempt_count:0,claim_id:null,first_attempt_at:null,created_at:new Date().toISOString(),available_at:new Date().toISOString()})
      expect(snapshots.find(snapshot=>snapshot.id===command.release_snapshot_id)).toMatchObject({release_version_id:release.versionId,requester_id:command.requester_id,requester_address_id:command.address_id})
     }
     return commands
    }
    if(scenario==='scheduled'){
     await cron()
    }else if(scenario==='overnight'||scenario==='quiet-off'){
     const commands=await queued()
     for(const at of [publishAt,publishAt+3600000,Date.parse('2026-11-06T12:59:59Z')]){
      vi.setSystemTime(new Date(at));await queue();await cron()
      expect(sent).toEqual([]);expect(await rows('notification_outbox')).toEqual(commands)
      expect(await rows('notification_outbox_attempts')).toEqual([])
     }
     if(scenario==='quiet-off'){
      expect((await call('/api/operator/settings/workspace-clock',{...clock,quietEnabled:false},g.operator,'PUT')).status).toBe(200)
     }else vi.setSystemTime(new Date('2026-11-06T13:00:00Z'))
     await queue()
    }else{
     await queued()
     await Promise.all([queue(),cron()])
     if(scenario==='ordered'){
      expect(sent).toHaveLength(2)
      expect(sent.every(message=>message.subject!== 'Scheduled exports are available')).toBe(true)
      expect((await rows('notification_outbox')).every(row=>row.attempt_count===0&&row.claim_id===null)).toBe(true)
      vi.setSystemTime(new Date(Date.now()+59999));await queue();expect(sent).toHaveLength(2)
      vi.setSystemTime(new Date(Date.now()+1));await queue()
     }
    }
    const commands=await rows('notification_outbox'),attempts=await rows('notification_outbox_attempts')
    expect(commands).toHaveLength(2);expect(attempts).toHaveLength(2)
    for(const command of commands){
     const message=sent.find(message=>message.key===command.id)!
     expect(message).toBeDefined();expect(message.subject).toBe('Scheduled exports are available')
     const permitted=scenario==='overnight'?Date.parse('2026-11-06T13:00:00Z'):scenario==='quiet-off'?Date.parse('2026-11-06T12:59:59Z'):scenario==='scheduled'?publishAt+60000:scenario==='ordered'?publishAt+60000:publishAt
     expect(message.at-permitted).toBeGreaterThanOrEqual(0);expect(message.at-permitted).toBeLessThanOrEqual(60000)
     expect(command).toMatchObject({delivery_state:'accepted',attempt_count:1,provider,provider_message_id:message.receipt,accepted_at:new Date(message.at).toISOString()})
     expect(attempts.find(attempt=>attempt.id===command.claim_id)).toMatchObject({outbox_id:command.id,state:'accepted',provider,provider_message_id:message.receipt})
     if(scenario==='ordered')expect(sent.findIndex(message=>message.key===command.id)).toBeGreaterThan(sent.findLastIndex(message=>message.subject!== 'Scheduled exports are available'))
    }
    const publicRelease=await call(`/api/public/releases/${release.slug}`)
    expect(publicRelease.status).toBe(200)
    expect(await publicRelease.json()).toMatchObject({slug:release.slug,title:'Scheduled exports are available',body:'Public weekly release wording'})
    expect(sent).toHaveLength(scenario==='ordered'?6:2)
    const transmissions=[...sent]
    for(const offset of [60000,3600000]){
     vi.setSystemTime(new Date(Date.now()+offset));await Promise.all([queue(),cron()])
     expect(sent).toEqual(transmissions);expect(await rows('notification_outbox')).toEqual(commands);expect(await rows('notification_outbox_attempts')).toEqual(attempts)
    }
   }finally{vi.useRealTimers();vi.restoreAllMocks()}
  }
 }
}
