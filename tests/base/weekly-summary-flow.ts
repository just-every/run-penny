import {applyD1Migrations,reset,createScheduledController} from 'cloudflare:test'
import {expect,inject,vi} from 'vitest'
import {call,env,requester,messages} from './support'
import {graph} from './notification-regression-fixture'
import {weeklyRelease} from './weekly-summary-release'
import {weeklyPortability} from './weekly-summary-portability'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'
import {completedWeek} from '@/core/features/notifications/weekly-schedule'
export async function proveWeeklySummary(){
 const migrations=inject('migrations')
 await reset();await applyD1Migrations(env.DB,migrations.slice(0,-1))
 const g=await graph(2,true),prior=(await env.DB.prepare('SELECT * FROM requests ORDER BY id').all()).results
 await applyD1Migrations(env.DB,migrations.slice(-1))
 expect((await env.DB.prepare('SELECT * FROM requests ORDER BY id').all()).results).toEqual(prior)
 const action=async(path:string,body:unknown,who:Record<string,string>=g.operator,method='POST')=>{const response=await call(path,body,who,method);expect(response.ok,await response.clone().text()).toBe(true);return response}
 expect(await (await call('/api/operator/settings/weekly-summary',undefined,g.operator)).json()).toMatchObject({enabled:false})
 expect((await call('/api/operator/settings/weekly-summary',{enabled:true},g.person,'PUT')).status).toBe(401)
 await runNotificationSchedule(createScheduledController({cron:'* * * * *',scheduledTime:Date.now()+7*86400000}),{...env,WORKSPACE_TIMEZONE:'UTC'})
 expect(await env.DB.prepare("SELECT count(*) n FROM notification_outbox WHERE event_type='weekly_digest'").first('n')).toBe(0)
 await action(`/api/public/requests/${g.requests[1].slug}/follow`,undefined,g.person,'DELETE')
 const control=await requester('Another weekly reader'),controlEmail=messages.at(-1)!.to
 await action(`/api/public/requests/${g.requests[0].slug}/follow`,{},control)
 const plain=await requester('Plain voter')
 await action(`/api/public/requests/${g.requests[0].slug}/vote`,{},plain)
 const board=(await (await call('/api/public/boards')).json() as {slug:string;subscriptionDisclosure:{version:number}}[]).find(row=>row.slug==='regression')!
 await action('/api/operator/boards/regression/vote-subscriptions',{enabled:true,version:board.subscriptionDisclosure.version},g.operator,'PUT')
 const voter=await requester('Subscribed voter'),voterEmail=messages.at(-1)!.to
 await action(`/api/public/requests/${g.requests[0].slug}/vote`,{},voter)
 expect(await (await call('/api/public/requester/weekly-summary',undefined,voter)).json()).toMatchObject({subscribed:true,origin:'vote'})
 await action('/api/operator/settings/weekly-summary',{enabled:true},g.operator,'PUT')
 for(const who of [g.person,control])await action('/api/public/requester/weekly-summary',{subscribed:true},who,'PATCH')
 await action(`/api/operator/requests/${g.requests[0].slug}/status-updates`,{status:'planned',body:'Public weekly status',idempotencyKey:crypto.randomUUID()})
 await action(`/api/operator/requests/${g.requests[0].slug}/comments`,{body:'Public weekly operator reply'})
 const held=await action(`/api/public/requests/${g.requests[0].slug}/comments`,{body:'synthetic-penny-private held comment'},plain),comment=await held.json() as {id:string}
 await action(`/api/operator/comments/${comment.id}/moderate`,{verdict:'approved',body:'Approved weekly requester comment',publicAuthorDisplayName:'A customer'})
 await action(`/api/public/requests/${g.requests[0].slug}/comments`,{body:'synthetic-penny-private unapproved comment'},plain)
 await action(`/api/operator/requests/${g.requests[0].slug}/notes`,{body:'synthetic-penny-private internal commercial evidence'})
 await action(`/api/operator/requests/${g.requests[1].slug}/status-updates`,{status:'planned',body:'Unfollowed request public change',idempotencyKey:crypto.randomUUID()})
 await weeklyRelease(g.operator,g.requests[0].id)
 const sent:{receipt:string;email:string;text:string;body:Record<string,unknown>}[]=[]
 vi.mocked(fetch).mockImplementation(async(input,init)=>{
  expect(String(input)).toBe('https://api.sendgrid.com/v3/mail/send');expect(init?.method).toBe('POST')
  const body=JSON.parse(String(init?.body)),receipt=`synthetic-penny-weekly-mail-${sent.length+1}`
  sent.push({receipt,email:body.personalizations[0].to[0].email,text:body.content.find((item:{type:string})=>item.type==='text/plain').value,body})
  return new Response(null,{status:202,headers:{'x-message-id':receipt}})
 })
 const end=Date.parse(completedWeek(Date.now()).end)+7*86400000,clock=end+9*3600000
 const cron=async(at:number)=>runNotificationSchedule(createScheduledController({cron:'* * * * *',scheduledTime:at}),{...env,WORKSPACE_TIMEZONE:'UTC'})
 const digests=async()=>{const receipts=(await env.DB.prepare("SELECT provider_message_id FROM notification_outbox WHERE event_type='weekly_digest' AND delivery_state='accepted'").all<{provider_message_id:string}>()).results.map(row=>row.provider_message_id);return sent.filter(row=>receipts.includes(row.receipt))}
 await cron(end+2*3600000)
 expect(await digests()).toHaveLength(0)
 await cron(clock);await cron(clock)
 expect((await digests()).map(row=>row.email).sort()).toEqual([g.recipient.email,controlEmail,voterEmail].sort())
 for(const mail of await digests()){
  for(const body of ['Public weekly status','Public weekly operator reply','Approved weekly requester comment','Public weekly release wording'])expect(mail.text).toContain(body)
  for(const hidden of ['synthetic-penny-private','Unfollowed request public change','Requester wording'])expect(mail.text).not.toContain(hidden)
  expect(mail.body.headers).toMatchObject({'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'})
 }
 await cron(clock+7*86400000)
 expect(await digests()).toHaveLength(3)
 const first=(await digests()).find(row=>row.email===g.recipient.email)!,link=first.text.match(/Unsubscribe from all requester email: (https:\/\/\S+)/)![1]
 expect((await call(link.replace('https://penny.test',''),{}, {},'POST')).status).toBe(200)
 expect(await (await call('/api/public/requester/weekly-summary',undefined,g.person)).json()).toMatchObject({subscribed:false})
 // Native publication owns the event; its fixture time moves into the next week.
 await action(`/api/operator/requests/${g.requests[0].slug}/status-updates`,{status:'in_progress',body:'Next weekly public status',idempotencyKey:crypto.randomUUID()})
 await env.DB.prepare("UPDATE notification_events SET created_at=?,updated_at=? WHERE body='Next weekly public status'").bind(new Date(end+8*86400000).toISOString(),new Date(end+8*86400000).toISOString()).run()
 await cron(clock+14*86400000)
 const next=(await digests()).filter(row=>row.text.includes('Next weekly public status'))
 expect(next.map(row=>row.email).sort()).toEqual([controlEmail,voterEmail].sort())
 await action(`/api/public/requests/${g.requests[0].slug}/follow`,{muted:true},control,'PATCH')
 await env.DB.prepare('UPDATE requester_addresses SET suppressed_at=? WHERE email=?').bind(new Date().toISOString(),voterEmail).run()
 await action(`/api/operator/requests/${g.requests[0].slug}/status-updates`,{status:'planned',body:'Muted weekly public status',idempotencyKey:crypto.randomUUID()})
 await env.DB.prepare("UPDATE notification_events SET created_at=?,updated_at=? WHERE body='Muted weekly public status'").bind(new Date(end+15*86400000).toISOString(),new Date(end+15*86400000).toISOString()).run()
 await cron(clock+21*86400000)
 expect((await digests()).some(row=>row.text.includes('Muted weekly public status'))).toBe(false)
 await weeklyPortability(g.operator)
}
