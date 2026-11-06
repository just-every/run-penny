import {createScheduledController} from 'cloudflare:test'
import {expect,vi} from 'vitest'
import {call,env,requester} from './support'
import {nativeReleaseTarget} from './release-fixture'
import {explicitConsentBoard} from './explicit-consent-board'
import {runNotificationSchedule} from '@/core/features/notifications/scheduled'

/** Public controls keep every privacy assertion grounded in populated responses. */
export async function proveInternalBoardExclusion(subject:{operator:Record<string,string>;person:Record<string,string>;slug:string;file:string}){
 vi.setSystemTime(vi.getRealSystemTime())
 try{
 const {operator,person,slug,file}=subject
 expect((await call('/api/operator/settings/workspace-clock',{timezone:'UTC',quietEnabled:false,quietStart:20,quietEnd:8},operator,'PUT')).status).toBe(200)
 expect((await call('/api/operator/boards',{name:'Public control board',slug:'public-control',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('public-control',(path,method,body)=>call(path,body,operator,method))
 const created=await call('/api/public/requests',{title:'synthetic-penny-public-control',description:'Public control description',boardSlug:'public-control',idempotencyKey:crypto.randomUUID()},person)
 expect(created.status).toBe(201)
 const control=await created.json() as {slug:string}
 expect((await call(`/api/operator/moderation/${control.slug}`,{verdict:'approved',title:'synthetic-penny-public-control',description:'Public control description',boardSlug:'public-control',displayName:'Public requester'},operator)).status).toBe(200)
 const follower=await requester('synthetic-penny-follower')
 for(const requestSlug of [slug,control.slug])expect((await call(`/api/public/requests/${requestSlug}/follow`,{},follower)).status).toBe(204)
 const requestId=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<string>('id')
 const controlId=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(control.slug).first<string>('id')
 const hiddenTarget=await nativeReleaseTarget(operator,requestId!,'product','synthetic-penny-internal-target')
 const publicTarget=await nativeReleaseTarget(operator,controlId!,'public-control','synthetic-penny-public-target')
 const settingsResponse=await call('/api/operator/settings/status-roadmap',undefined,operator)
 expect(settingsResponse.status).toBe(200)
 const {settings}=await settingsResponse.json() as {settings:Record<string,unknown>}
 const source=async(value:'approved_items'|'request_statuses')=>expect((await call('/api/operator/settings/status-roadmap',{...settings,source:value,shippedDays:null},operator,'PUT')).status).toBe(200)
 const roadmap=async()=>{
  const response=await call('/api/public/roadmap');expect(response.status).toBe(200)
  return response.json() as Promise<{slug:string;requests:{slug:string}[]}[]>
 }
 for(const mode of ['approved_items','request_statuses'] as const){
  await source(mode)
  const cards=await roadmap()
  expect(cards.map(card=>card.slug).sort()).toEqual((mode==='approved_items'?[hiddenTarget.publicSlug,publicTarget.publicSlug]:[slug,control.slug]).sort())
  expect(cards.flatMap(card=>card.requests.map(request=>request.slug)).sort()).toEqual([slug,control.slug].sort())
 }
 const queuedBody='synthetic-penny-queued-before-internal'
 expect((await call(`/api/operator/requests/${slug}/status-updates`,{status:'under_review',body:queuedBody,pinned:false},operator)).status).toBe(200)
 const queued=await env.DB.prepare('SELECT e.id FROM notification_events e JOIN request_status_updates s ON s.id=e.subject_id WHERE s.request_id=? AND s.body=?').bind(requestId,queuedBody).first<string>('id')
 expect(queued).toBeTruthy()
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),env)
 await cron()
 const pending=await env.DB.prepare('SELECT b.id,b.state FROM notification_batches b JOIN notification_intents i ON i.batch_id=b.id WHERE i.event_id=?').bind(queued).all<{id:string;state:string}>()
 expect(pending.results.length).toBeGreaterThan(0)
 expect(pending.results.every(row=>row.state==='queued')).toBe(true)
 expect((await call('/api/operator/boards/product',{visibility:'internal'},operator,'PATCH')).status).toBe(200)
 for(const mode of ['approved_items','request_statuses'] as const){
  await source(mode)
  const cards=await roadmap(),publicSlug=mode==='approved_items'?publicTarget.publicSlug:control.slug,hiddenSlug=mode==='approved_items'?hiddenTarget.publicSlug:slug
  expect(cards.map(card=>card.slug)).toEqual([publicSlug])
  expect(cards[0].requests.map(request=>request.slug)).toEqual([control.slug])
  const detail=await call(`/api/public/roadmap/${publicSlug}`);expect(detail.status).toBe(200)
  expect(await detail.json()).toEqual(cards[0])
  expect((await call(`/api/public/roadmap/${hiddenSlug}`)).status).toBe(404)
  const page=await call('/portal/roadmap');expect(page.status).toBe(200)
  const rendered=await page.text();expect(rendered).toContain(publicSlug)
  for(const marker of [slug,hiddenTarget.publicSlug,'synthetic-penny-internal-target']){
   expect(JSON.stringify(cards)).not.toContain(marker);expect(rendered).not.toContain(marker)
  }
 }
 const requests=await call('/api/public/requests');expect(requests.status).toBe(200)
 const visible=await requests.text();expect(visible).toContain(control.slug);expect(visible).not.toContain(slug)
 expect((await call(`/api/public/requests/${slug}`)).status).toBe(404)
 expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
 const releaseState=async()=>Object.fromEntries(await Promise.all([
  'releases','release_versions','release_targets','release_draft_mappings','release_target_snapshots',
  'release_recipient_snapshots','release_recipient_contexts','notification_outbox','audit_entries',
 ].map(async table=>[table,(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])))
 const before=await releaseState()
 expect(before.release_target_snapshots).toEqual([])
 expect(before.release_recipient_snapshots).toEqual([])
 const refused=await call(`/api/operator/releases/${hiddenTarget.draft.slug}/publish`,{},operator)
 expect(refused.status).toBe(409)
 expect(await refused.json()).toMatchObject({message:expect.stringContaining('Release targets')})
 expect(await releaseState()).toEqual(before)
 expect((await call(`/api/public/releases/${hiddenTarget.draft.slug}`)).status).toBe(404)
 expect((await call(`/api/operator/releases/${publicTarget.draft.slug}/publish`,{},operator)).status).toBe(200)
 const released=await call('/api/public/releases');expect(released.status).toBe(200)
 const published=await released.text();expect(published).toContain(publicTarget.draft.slug);expect(published).not.toContain(hiddenTarget.draft.slug);expect(published).not.toContain(slug)
 const mailGraph=async()=>Object.fromEntries(await Promise.all(['request_status_updates','request_comments','notification_events','notification_intents','notification_batches'].map(async table=>[table,(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])))
 const internalBefore=await mailGraph()
 expect((await call(`/api/operator/requests/${slug}/status-updates`,{status:'planned',body:'synthetic-penny-internal-status',pinned:false},operator)).status).toBe(404)
 expect((await call(`/api/operator/requests/${slug}/comments`,{body:'synthetic-penny-internal-reply'},operator)).status).toBe(404)
 expect(await mailGraph()).toEqual(internalBefore)
 expect((await call(`/api/operator/requests/${control.slug}/status-updates`,{status:'planned',body:'synthetic-penny-public-status',pinned:false},operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${control.slug}/comments`,{body:'synthetic-penny-public-reply'},operator)).status).toBe(201)
 // All identity setup is finished. Inspect only subsequent provider HTTP effects.
 vi.mocked(fetch).mockClear()
 const sent:{body:string}[]=[]
 vi.mocked(fetch).mockImplementation(async(input,init)=>{
  expect(String(input)).toBe('https://api.sendgrid.com/v3/mail/send');expect(init?.method).toBe('POST')
  sent.push({body:String(init?.body)})
  return new Response(null,{status:202,headers:{'x-message-id':`synthetic-penny-${sent.length}`}})
 })
 vi.setSystemTime(Date.now()+120_001)
 await cron()
 const envelopes=sent.map(row=>row.body).join('\n')
 expect(envelopes).toContain('synthetic-penny-public-status')
 expect(envelopes).toContain('synthetic-penny-public-reply')
 expect(envelopes).toContain(publicTarget.draft.slug)
 for(const marker of [slug,hiddenTarget.draft.slug,queuedBody,'synthetic-penny-internal-status','synthetic-penny-internal-reply'])expect(envelopes).not.toContain(marker)
 for(const batch of pending.results)expect(await env.DB.prepare('SELECT state FROM notification_batches WHERE id=?').bind(batch.id).first('state')).toBe('suppressed')
 const sentCount=sent.length
 expect(sentCount).toBeGreaterThan(0)
 vi.setSystemTime(Date.now()+120_001)
 await cron();await cron()
 expect(sent).toHaveLength(sentCount)
 console.info('PROBE REQ-019 point 1: native board visibility -> populated public roadmaps exclude subject; release 409 leaves publication, snapshots and outbox unchanged; queued and later internal activity sends no mail; public control delivers')
 }finally{vi.useRealTimers()}
}
