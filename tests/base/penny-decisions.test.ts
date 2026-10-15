import {mockMail} from './support'
import { applyD1Migrations,reset,createScheduledController } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { providerMessages } from './provider-messages'
import { runNotificationSchedule } from '@/core/features/notifications/scheduled'
import type { ReviewNotification } from '@/core/features/notifications/decision-reviews'
import type { DecisionHistory,DecisionPostRelease } from '@/core/features/decisions/history'
const origin='https://127.0.0.1:8787'
const devKey='synthetic-decisions-checkout-key-for-local-outbox-tests'
const bindings=()=>({...env,RER_DEV_KEY:devKey,PENNY_ENVIRONMENT:'test',APP_ORIGIN:origin,WORKSPACE_TIMEZONE:'Australia/Brisbane',MAIL_PROVIDER:'sendgrid',SENDGRID_API_KEY:'synthetic-provider-test-key',RESEND_API_KEY:undefined})
const runtime=()=>createPennyRuntime(bindings())
const app=createPennyApi()
function call(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST'){
 return app.fetch(new Request(origin+path,{method,headers:{Host:'127.0.0.1:8787',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings())
}
async function good<T=Record<string,string>>(path:string,body:unknown,headers:Record<string,string>,method='POST'):Promise<T>{const r=await call(path,body,headers,method);expect(r.status,await r.clone().text()).toBeLessThan(300);return r.json() as Promise<T>}
const rows=(table:string)=>env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all<Record<string,unknown>>().then(r=>r.results)
async function graph(){
 const auth=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(auth.status).toBe(303)
 const cookie={Cookie:auth.headers.get('set-cookie')!.split(';')[0]}
 const evidence=await good('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Interview',wording:'Original evidence wording',observedAt:'2026-10-01T00:00:00Z'},cookie)
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 const decision=await good('/api/operator/decisions',{question:'Which approach?',ownerOperatorId:actor},cookie)
 const first=await good(`/api/operator/decisions/${decision.id}/bets`,{title:'First option',summary:'First approach',successMeasure:'Faster onboarding'},cookie)
 const second=await good(`/api/operator/decisions/${decision.id}/bets`,{title:'Second option',summary:'Second approach',urgency:'Next quarter'},cookie)
 await good(`/api/operator/evidence/${evidence.id}/links`,{target:'bet',targetId:first.id},cookie,'PUT')
 const fields={selectedCandidateBetId:first.id,rationale:'Original rationale',ownerOperatorId:actor,confidence:'medium',reviewAt:'2026-10-10'}
 const commit=await good(`/api/operator/decisions/${decision.id}/commit`,fields,cookie)
 return {cookie,evidence,decision,first,second,fields,commit,actor}
}
const history=async(g:Awaited<ReturnType<typeof graph>>)=>(await call(`/api/operator/decisions/${g.decision.id}/history`,undefined,g.cookie)).json() as Promise<DecisionHistory>
async function cron(at:string){
 const scheduledTime=Date.parse(at);vi.spyOn(Date,'now').mockReturnValue(scheduledTime)
 await runNotificationSchedule(createScheduledController({scheduledTime,cron:'* * * * *'}),bindings())
}
const notices=async(g:Awaited<ReturnType<typeof graph>>)=>(await (await call('/api/operator/notifications',undefined,g.cookie)).json() as {reviews:ReviewNotification[]}).reviews
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
it('[DEC-006] revisions preserve commitment evidence and declined dimensions while atomically replacing approved roadmap bets',async()=>{
 const g=await graph(),prior=(await history(g)).revisions[0]
 await env.DB.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,approved_by_operator_id,approved_at,created_at,updated_at) VALUES('approval',?,'Approved title','Approved summary',?,'2026-10-01','2026-10-01','2026-10-01')").bind(g.commit.itemId,g.actor).run()
 await good(`/api/operator/roadmap/${g.commit.itemId}/move`,{status:'in_progress',reason:'Started work',idempotencyKey:'start'},g.cookie)
 await good(`/api/operator/evidence/${g.evidence.id}/wording`,{wording:'Evidence wording clarified later',expectedVersionId:prior.evidence[0].evidenceVersionId},g.cookie,'PATCH')
 const before=await rows('roadmap_items')
 await good(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,rationale:'Clearer rationale',expectedRevision:1},g.cookie)
 expect(await rows('roadmap_items')).toEqual(before)
 await good(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,selectedCandidateBetId:g.second.id,rationale:'Changed direction',expectedRevision:2},g.cookie)
 const recorded=(await history(g)).revisions
 expect(recorded).toHaveLength(3);expect(recorded[2]).toEqual(prior)
 expect(recorded[2].bets.find(b=>b.candidateBetId===g.second.id)).toMatchObject({disposition:'declined',urgency:'Next quarter'})
 expect(recorded[2].evidence[0].wording).toBe('Original evidence wording');expect(recorded[0].evidence[0].wording).toBe('Evidence wording clarified later')
 expect((await rows('roadmap_items')).find(i=>i.id===g.commit.itemId)?.status).toBe('exploring')
 expect((await rows('roadmap_items')).find(i=>i.candidate_bet_id===g.second.id)?.status).toBe('planned')
 expect((await rows('roadmap_publications'))[0].withdrawn_at).not.toBeNull()
 expect((await rows('roadmap_update_versions')).some(v=>v.public_status==='under_review'&&v.published_at===null)).toBe(true)
 expect((await call(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,expectedRevision:2},g.cookie)).status).toBe(409)
})
it('[DEC-007] calendar dates expire after the workspace day, explicit timestamps at their instant, and a revision can complete a due schedule',async()=>{
 const g=await graph(),snapshot=await history(g),roadmap=await rows('roadmap_items')
 for(const reviewAt of ['2026-10-11T02:00:00','2026-02-30','2026-02-30T02:00:00+10:00']){
  expect((await call(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,reviewAt,expectedRevision:1},g.cookie)).status).toBe(422)
  expect((await call(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Check schedule',reviewAt},g.cookie)).status).toBe(422)
 }
 await cron('2026-10-10T13:59:59Z')
 expect((await rows('decisions'))[0].state).toBe('committed')
 expect(await providerMessages(runtime())!.list()).toHaveLength(0);expect(await notices(g)).toHaveLength(0)
 await cron('2026-10-10T14:00:00Z')
 expect((await rows('decisions'))[0]).toMatchObject({state:'review_due',selected_candidate_bet_id:g.first.id})
 expect(await rows('roadmap_items')).toEqual(roadmap);expect(await history(g)).toEqual(snapshot)
 expect((await call(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Reviewed'},g.cookie)).status).toBe(400)
 const reviewAt='2026-10-11T02:00:00+10:00'
 await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Still the right choice',reviewAt},g.cookie)
 await cron('2026-10-10T15:59:59Z')
 expect((await rows('decisions'))[0].state).toBe('committed')
 expect(await providerMessages(runtime())!.list()).toHaveLength(1);expect(await notices(g)).toHaveLength(1)
 await cron('2026-10-10T16:00:01Z')
 const due=(await rows('decisions'))[0]
 expect(due.state).toBe('review_due');expect(await providerMessages(runtime())!.list()).toHaveLength(2);expect(await notices(g)).toHaveLength(2)
 await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'New evidence changes the rationale',revision:{...g.fields,rationale:'Reviewed rationale',reviewAt,expectedRevision:1}},g.cookie)
 await cron('2026-10-10T16:01:00Z');await cron('2026-10-10T16:02:00Z')
 expect((await rows('decisions'))[0]).toMatchObject({state:'committed',review_at:due.review_at,review_generation:due.review_generation})
 expect(await providerMessages(runtime())!.list()).toHaveLength(2);expect(await notices(g)).toHaveLength(2)
 expect((await history(g)).reviews).toHaveLength(2);expect((await history(g)).revisions).toHaveLength(2)
 await good(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,rationale:'Schedule the next check',reviewAt:'2026-10-10T17:00:00Z',expectedRevision:2},g.cookie)
 await cron('2026-10-10T16:59:59Z')
 expect((await rows('decisions'))[0].state).toBe('committed');expect(await providerMessages(runtime())!.list()).toHaveLength(2)
 await cron('2026-10-10T17:00:01Z');await cron('2026-10-10T17:01:00Z')
 expect((await rows('decisions'))[0].state).toBe('review_due')
 expect(await providerMessages(runtime())!.list()).toHaveLength(3);expect(await notices(g)).toHaveLength(3)
 expect(await rows('roadmap_items')).toEqual(roadmap)
})
it('[NOTIFY-003] completing a review before Cron holds that schedule; changed dates notify once without quiet hours and stay in app until dismissed',async()=>{
 const g=await graph(),original=(await rows('decisions'))[0]
 await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Reviewed before the reminder',revision:{...g.fields,rationale:'Reviewed rationale',expectedRevision:1}},g.cookie)
 await Promise.all([cron('2026-10-10T14:00:00Z'),cron('2026-10-10T14:00:00Z')])
 await cron('2026-10-10T14:01:00Z')
 const completed=(await rows('decisions'))[0]
 expect(completed).toMatchObject({state:'committed',review_at:original.review_at,review_generation:original.review_generation})
 expect(completed.review_completed_at).not.toBeNull()
 expect(await providerMessages(runtime())!.list()).toHaveLength(0);expect(await notices(g)).toHaveLength(0)
 await good(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,rationale:'Clarify the same decision without another schedule',expectedRevision:2},g.cookie)
 await cron('2026-10-11T14:00:00Z')
 expect((await rows('decisions'))[0].review_completed_at).toBe(completed.review_completed_at)
 expect(await providerMessages(runtime())!.list()).toHaveLength(0);expect(await notices(g)).toHaveLength(0)
 await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Schedule another review',reviewAt:'2026-10-11'},g.cookie)
 expect((await rows('decisions'))[0].review_completed_at).toBeNull()
 // Brisbane midnight remains within requester quiet hours.
 await Promise.all([cron('2026-10-11T14:00:00Z'),cron('2026-10-11T14:00:00Z')])
 await cron('2026-10-11T14:01:00Z')
 const mails=await providerMessages(runtime())!.list();expect(mails).toHaveLength(1);expect(mails[0].message.to).toEqual(['owner@penny.invalid'])
 for(const path of ['/__dev/outbox','/__dev/outbox?message='+mails[0].id]){
  expect((await call(path)).status).toBe(404)
  expect((await call(path,undefined,{'x-rer-dev-key':'wrong-'+devKey})).status).toBe(404)
  expect((await call(path,undefined,{'x-rer-dev-key':devKey})).status).toBe(404)
 }
 const reminders=await notices(g)
 expect(reminders).toHaveLength(1);expect(reminders[0].state).toBe('accepted')
 expect(await rows('decision_review_notifications')).toEqual([expect.objectContaining({id:mails[0].message.deliveryId,state:'accepted',attempt_count:1,provider_message_id:expect.any(String),failure_reason:null})])
 await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:'Keep going',reviewAt:'2026-10-12'},g.cookie)
 expect(await notices(g)).toHaveLength(1)
 await good(`/api/operator/notifications/${reminders[0].id}/dismiss`,{},g.cookie)
 expect(await notices(g)).toHaveLength(0)
 await cron('2026-10-12T14:00:00Z');await cron('2026-10-12T14:01:00Z')
 expect(await providerMessages(runtime())!.list()).toHaveLength(2);expect(await notices(g)).toHaveLength(1)
})
it('[DEC-008] requester outcome revisions and release-linked evidence appear immediately through original publication links without changing commitment snapshots',async()=>{
 const g=await graph(),snapshot=await history(g)
 await good('/api/public/identity/email',{email:'outcome@example.test',displayName:'Reader'}, {})
 const message=(await providerMessages(runtime())!.list())[0]
 const token=new URL(message.message.text!.match(/https?:\/\/\S+/)![0]).hash.slice(7)
 const identity=await good('/api/public/identity/email/verify',{token},{})
 const person={Authorization:`Bearer ${identity.token}`}
 await good('/api/operator/boards',{name:'Feedback',slug:'feedback',visibility:'public'},g.cookie)
 const request=await good('/api/public/requests',{title:'Improve onboarding',description:'Make starting easier',boardSlug:'feedback',idempotencyKey:crypto.randomUUID()},person)
 await good(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'Improve onboarding',description:'Make starting easier',boardSlug:'feedback',displayName:'Reader'},g.cookie)
 expect((await call(`/api/public/requests/${request.slug}/follow`,{},person)).status).toBe(204)
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first<{id:string}>())!.id
 await good(`/api/operator/roadmap/${g.commit.itemId}/approve`,{publicTitle:'Onboarding',publicSummary:'Simpler start',boardSlug:'feedback',requestIds:[requestId]},g.cookie)
 await good(`/api/operator/roadmap/${g.commit.itemId}/move`,{status:'shipped',reason:'Available',idempotencyKey:'ship'},g.cookie)
 await env.DB.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('tag','Workflow','2026-10-01','2026-10-01')").run()
 const release=await good('/api/operator/releases',{title:'Onboarding is easier',body:'New onboarding flow',releaseType:'improved',tagIds:['tag'],publicationDate:'2026-10-11',targetIds:[g.commit.itemId],authorOperatorId:g.actor},g.cookie)
 await good(`/api/operator/releases/${release.slug}/publish`,{},g.cookie)
 await good(`/api/public/releases/${release.slug}/outcomes`,{targetId:g.commit.itemId,outcome:'adopted'},person,'PUT')
 await good(`/api/public/releases/${release.slug}/outcomes`,{targetId:g.commit.itemId,outcome:'partly_adopted'},person,'PUT')
 const evidence=await good('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Post-release interview',wording:'New flow helps',observedAt:'2026-10-11T00:00:00Z',releaseId:release.id},g.cookie)
 const view=await call(`/api/operator/decisions/${g.decision.id}/post-release`,undefined,g.cookie);expect(view.status,await view.clone().text()).toBe(200)
 const post=await view.json() as DecisionPostRelease
 expect(post.timeline).toHaveLength(3)
 expect(post.timeline.find(e=>e.kind==='evidence')).toMatchObject({evidenceId:evidence.id,releaseId:release.id,wording:'New flow helps'})
 expect(post.timeline.filter(e=>e.kind==='outcome')).toEqual(expect.arrayContaining([expect.objectContaining({outcome:'adopted',roadmapItemId:g.commit.itemId,requests:[{requestId,requestSlug:request.slug}]}),expect.objectContaining({outcome:'partly_adopted'})]))
 expect(await history(g)).toEqual(snapshot)
 expect((await call(`/api/operator/decisions/${g.decision.id}/post-release`,undefined,person)).status).toBe(401)
})
it('[BASE-ACCESS-004 DEC-006] unauthorized, foreign-origin, stale and failed revisions leave the entire commitment unchanged',async()=>{
 const g=await graph(),path=`/api/operator/decisions/${g.decision.id}/revisions`,input={...g.fields,selectedCandidateBetId:g.second.id,expectedRevision:1}
 expect((await call(path,input)).status).toBe(401)
 expect((await call(path,input,{...g.cookie,Origin:'https://foreign.test'})).status).toBe(403)
 const commitment=async()=>Promise.all(['decisions','decision_revisions','decision_evidence_snapshots','decision_bet_snapshots','roadmap_items','roadmap_transitions','roadmap_publications','roadmap_request_mappings','roadmap_update_versions','roadmap_update_targets','audit_entries'].map(async table=>({table,rows:(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all<Record<string,unknown>>()).results})))
 const initial=await commitment()
 await env.DB.exec("CREATE TRIGGER reject_revision BEFORE INSERT ON audit_entries WHEN NEW.action='decision.revised' BEGIN SELECT RAISE(ABORT,'final write failed'); END;")
 const failed=await call(path,input,g.cookie)
 expect(failed.status).toBe(503);expect(await failed.json()).toMatchObject({error:'service_unavailable'})
 expect(await commitment()).toEqual(initial)
 await env.DB.exec('DROP TRIGGER reject_revision')
 const results=await Promise.all([call(path,input,g.cookie),call(path,input,g.cookie)])
 expect(results.map(r=>r.status).sort()).toEqual([201,409])
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run()
 expect((await call(path,{...input,expectedRevision:2},g.cookie)).status).toBe(401)
})
