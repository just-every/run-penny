import { applyD1Migrations,reset,createScheduledController } from 'cloudflare:test'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { call,env,requester } from './support'
import { releaseGraph } from './release-fixture'
import { graph,rows,runtime,time } from './notification-regression-fixture'
import { createPennyRuntime } from '@/core/app/runtime'
import { createPennyApi } from '@/core/app/api'
import { providerMessages } from './provider-messages'
import { runNotificationSchedule } from '@/core/features/notifications/scheduled'
import { releaseContent } from '@/core/features/releases/delivery-admission'
import { unsubscribeUrl } from '@/core/features/notifications/unsubscribe'
import { canonical,type Archive,type ErasureJournal } from '@/core/features/data/archive'
import { digest } from '@/core/features/auth/native-tokens'
import type { ReleaseVersion } from '@/core/features/releases/versioning'
import type { ReleaseOutcomeReport,RequesterReleaseOutcomes } from '@/core/features/releases/outcomes'
import type { DecisionHistory,DecisionPostRelease } from '@/core/features/decisions/history'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
async function json<T>(response:Response,status=200):Promise<T>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<T>}
const publish=(g:Awaited<ReturnType<typeof releaseGraph>>)=>call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator)
const correction=(g:Awaited<ReturnType<typeof releaseGraph>>,expectedVersionId=g.draft.versionId)=>call(`/api/operator/releases/${g.draft.slug}/corrections`,{expectedVersionId,title:'Corrected release',body:'Corrected customer wording.',outcomePrompt:'Have you adopted this update?'},g.operator)
async function votedReleaseGraph(){
 const g=await graph(2)
 expect((await call(`/api/public/requests/${g.requests[0].slug}/vote`,{},g.person)).status).toBe(204)
 return releaseGraph(2,false,g)
}
async function addSecondReleaseTarget(g:Awaited<ReturnType<typeof releaseGraph>>){
 await env.DB.batch([
  env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,title,summary,status,created_at,updated_at) VALUES('second-item','second-item','release-decision','Second private target','Private summary','shipped',?,?)").bind(time(),time()),
  env.DB.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,public_slug,approved_by_operator_id,approved_at,created_at,updated_at) VALUES('second-approval','second-item','Second improvement','Safe summary','second-improvement',?,?,?,?)").bind(g.actor,time(),time(),time()),
  env.DB.prepare("UPDATE roadmap_request_mappings SET roadmap_item_id='second-item' WHERE request_id=?").bind(g.requests[1].id),
 ])
 await json(await call(`/api/operator/releases/${g.draft.slug}`,{...g.input,targetIds:['release-item','second-item']},g.operator,'PATCH'))
}
it('[REL-003] correction preserves original context and operator history; portal marks current; one explicit delivery command per version',async()=>{
 const g=await votedReleaseGraph()
 await json(await call('/api/public/updates/subscription',{subscribed:true},g.person,'PATCH'))
 vi.mocked(fetch).mockClear()
 const bindings={...env,PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://127.0.0.1:8787',WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'auth@localhost.test',MAIL_API_KEY:'synthetic-provider-test-key'}
 const nextDay=new Date();nextDay.setUTCDate(nextDay.getUTCDate()+1);nextDay.setUTCHours(9,0,0,0)
 vi.spyOn(Date,'now').mockReturnValue(nextDay.getTime())
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 const capture=providerMessages(createPennyRuntime(bindings))!
 await json(await publish(g))
 await cron()
 const original=(await capture.list())[0]
 expect(await capture.list()).toHaveLength(1)
 expect(original.message).toMatchObject({to:[g.recipient.email],subject:g.input.title})
 expect(original.message.text).toContain(g.input.body)
 const snapshots=await rows('release_recipient_snapshots'),contexts=await rows('release_recipient_contexts'),targets=await rows('release_target_snapshots')
 const corrected=await json<{versionId:string}>(await correction(g),201)
 const versions=await json<ReleaseVersion[]>(await call(`/api/operator/releases/${g.draft.slug}/versions`,undefined,g.operator))
 expect(versions.map(v=>[v.title,v.isCurrent])).toEqual([['Corrected release',true],[g.input.title,false]])
 expect(versions[1].body).toBe(g.input.body)
 const portal=await json<{title:string;versionNumber:number;isCurrent:boolean}>(await call(`/api/public/releases/${g.draft.slug}`))
 expect(portal).toMatchObject({title:'Corrected release',versionNumber:2,isCurrent:true})
 expect(await rows('release_recipient_snapshots')).toEqual(snapshots);expect(await rows('release_recipient_contexts')).toEqual(contexts);expect(await rows('release_target_snapshots')).toEqual(targets)
 await json(await publish(g));expect(await rows('notification_outbox')).toHaveLength(1)
 expect((await correction(g)).status).toBe(409)
 const path=`/api/operator/releases/${g.draft.slug}/versions/${corrected.versionId}/deliver`
 for(const headers of [{},g.person])expect((await call(path,{},headers)).status).toBe(401)
 expect((await call(path,{}, {...g.operator,Origin:'https://foreign.test'})).status).toBe(403)
 await cron();expect(await capture.list()).toEqual([original])
 expect(await rows('notification_outbox')).toHaveLength(1)
 await Promise.all([call(path,{},g.operator),call(path,{},g.operator)]).then(async results=>{for(const r of results)await json(r)})
 expect(await rows('notification_outbox')).toHaveLength(2)
 const outbox=(await rows('notification_outbox')).find(r=>r.subject_id===corrected.versionId)!
 expect(outbox.release_snapshot_id).toBe(snapshots[0].id)
 expect((await releaseContent(env.DB,String(outbox.id)))[0].body).toBe('Corrected customer wording.')
 await cron()
 const captured=await capture.list(),correctedMessage=captured.find(m=>m.message.deliveryId===outbox.id)!
 expect(captured).toHaveLength(2)
 expect(correctedMessage.id).not.toBe(original.id)
 expect(correctedMessage.message.deliveryId).not.toBe(original.message.deliveryId)
 expect(correctedMessage.message.to).toEqual(original.message.to)
 expect(correctedMessage.message.subject).toBe('Corrected release')
 expect(correctedMessage.message.text).toContain('Corrected customer wording.')
 expect(correctedMessage.message.text).not.toContain(g.input.body)
 expect(original.message.text).not.toContain('Corrected customer wording.')
 for(const request of g.requests){expect(original.message.text).toContain(`/portal/feedback/${request.slug}`);expect(correctedMessage.message.text).toContain(`/portal/feedback/${request.slug}`)}
 const deliveries=await rows('notification_outbox')
 expect(deliveries).toEqual(expect.arrayContaining([
  expect.objectContaining({id:original.message.deliveryId,subject_id:g.draft.versionId,event_version:1}),
  expect.objectContaining({id:correctedMessage.message.deliveryId,subject_id:corrected.versionId,event_version:2}),
 ]))
 for(const delivery of deliveries)expect(delivery).toMatchObject({delivery_state:'accepted',attempt_count:1,provider_message_id:expect.any(String),failure_reason:null})
 const attempts=await rows('notification_outbox_attempts');expect(attempts).toHaveLength(2)
 for(const attempt of attempts)expect(attempt).toMatchObject({state:'accepted',provider_message_id:expect.any(String),failure_reason:null})
 await json(await publish(g));await json(await call(path,{},g.operator))
 await Promise.all([cron(),cron()]);await cron()
 expect(await capture.list()).toEqual(captured)
 expect(await rows('notification_outbox')).toEqual(deliveries)
 expect(await rows('notification_outbox_attempts')).toEqual(attempts)
 expect(fetch).toHaveBeenCalledTimes(2)
 expect(await rows('release_recipient_snapshots')).toEqual(snapshots);expect(await rows('release_recipient_contexts')).toEqual(contexts);expect(await rows('release_target_snapshots')).toEqual(targets)
 for(const path of [`/api/operator/releases/${g.draft.slug}/versions`,`/api/operator/releases/${g.draft.slug}/outcomes`])expect((await call(path,undefined,g.person)).status).toBe(401)
 expect((await call(path,{}, {...g.operator,Origin:'https://foreign.test'})).status).toBe(403)
 const retained=await Promise.all(['requests','request_votes','request_follows'].map(rows))
 const permissions=await rows('requester_update_permissions'),preferences=await rows('requester_notification_preferences')
 const unsubscribeLink=correctedMessage.message.text!.match(/^Unsubscribe from all requester email: (.+)$/m)![1]
 expect(new URL(unsubscribeLink).origin).toBe(bindings.APP_ORIGIN)
 const api=createPennyApi(),openLink=(method='GET')=>api.fetch(new Request(unsubscribeLink,{method,headers:{Origin:bindings.APP_ORIGIN}}),bindings)
 expect((await openLink()).status).toBe(200)
 expect(await rows('requester_update_permissions')).toEqual(permissions)
 expect(await rows('requester_notification_preferences')).toEqual(preferences)
 expect((await openLink('POST')).status).toBe(200)
 expect(await json(await call('/api/public/requester/notifications',undefined,g.person))).toEqual({muted:true})
 expect(await json(await call('/api/public/updates/subscription',undefined,g.person))).toMatchObject({subscribed:false})
 expect(await Promise.all(['requests','request_votes','request_follows'].map(rows))).toEqual(retained)
 expect((await call('/api/public/requester/activity',undefined,g.person)).status).toBe(200)
 expect(await capture.list()).toEqual(captured)
 expect(fetch).toHaveBeenCalledTimes(2)
})
it('[EVID-009 REL-001] a private tag on a published release stays out of the public updates pages and the customer email',async()=>{
 const g=await votedReleaseGraph(),secret='Confidential billing tag'
 const tag=await json<{id:string}>(await call('/api/operator/catalog/tags',{name:secret},g.operator),201)
 await json(await call(`/api/operator/releases/${g.draft.slug}`,{...g.input,tagIds:[tag.id]},g.operator,'PATCH'))
 await json(await call('/api/public/updates/subscription',{subscribed:true},g.person,'PATCH'))
 const bindings={...env,PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://127.0.0.1:8787',WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'auth@localhost.test',MAIL_API_KEY:'synthetic-provider-test-key'}
 const nextDay=new Date();nextDay.setUTCDate(nextDay.getUTCDate()+1);nextDay.setUTCHours(9,0,0,0)
 vi.spyOn(Date,'now').mockReturnValue(nextDay.getTime())
 await json(await publish(g))
 await runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 const mail=(await providerMessages(createPennyRuntime(bindings))!.list())[0].message
 const page=await (await call(`/portal/updates/${g.draft.slug}`)).text()
 expect(mail.text).toContain(g.input.body);expect(page).toContain(g.input.body)
 for(const surface of [mail.text,mail.html??'',page,await (await call('/portal/updates')).text(),await (await call('/api/public/releases')).text(),await (await call(`/api/public/releases/${g.draft.slug}`)).text()])expect(surface).not.toContain(secret)
})
it('[REL-012] request mute retains update subscription and global unsubscribe withdraws permission while preserving votes and follows',async()=>{
 const g=await votedReleaseGraph(),subscriber=await requester('Subscriber only'),endpoint='/api/public/updates/subscription'
 expect((await call(endpoint,{subscribed:true},{},'PATCH')).status).toBe(401)
 await json(await call(endpoint,{subscribed:true},subscriber,'PATCH'))
 await json(await call(endpoint,{subscribed:true},subscriber,'PATCH'))
 const permission=(await rows('requester_update_permissions')).filter(p=>p.source==='subscription')
 expect(permission).toHaveLength(1);expect(permission[0].granted_at).toBeTruthy()
 await json(await publish(g));expect(await rows('release_recipient_snapshots')).toHaveLength(2)
 const snapshot=(await rows('release_recipient_snapshots')).find(s=>s.requester_id===permission[0].requester_id)!
 const queued=(await rows('notification_outbox')).find(n=>n.release_snapshot_id===snapshot.id)!
 expect(await releaseContent(env.DB,String(queued.id))).toHaveLength(1)
 await json(await call(endpoint,{subscribed:false},subscriber,'PATCH'))
 expect(await releaseContent(env.DB,String(queued.id))).toHaveLength(0)
 await json(await call(endpoint,{subscribed:true},g.person,'PATCH'))
 const before=await Promise.all(['requests','request_follows','request_votes'].map(rows))
 for(const records of before)expect(records.length).toBeGreaterThan(0)
 const permissions=await rows('requester_update_permissions')
 const url=await unsubscribeUrl(runtime(),g.recipient,g.requests[0].id)
 expect((await call(new URL(url).pathname+new URL(url).search,{})).status).toBe(200)
 expect(await json(await call(endpoint,undefined,g.person))).toMatchObject({subscribed:true})
 expect(await json(await call('/api/public/requester/notifications',undefined,g.person))).toEqual({muted:false})
 expect(await rows('requester_update_permissions')).toEqual(permissions)
 expect(await rows('request_notification_mutes')).toEqual([expect.objectContaining({requester_id:g.recipient.requesterId,request_id:g.requests[0].id})])
 expect(await Promise.all(['requests','request_follows','request_votes'].map(rows))).toEqual(before)
 const globalUrl=new URL(await unsubscribeUrl(runtime(),g.recipient,'all'))
 expect((await call(globalUrl.pathname+globalUrl.search,{})).status).toBe(200)
 expect(await json(await call(endpoint,undefined,g.person))).toMatchObject({subscribed:false})
 expect(await json(await call('/api/public/requester/notifications',undefined,g.person))).toEqual({muted:true})
 expect(await Promise.all(['requests','request_follows','request_votes'].map(rows))).toEqual(before)
 expect((await rows('requester_update_permissions')).filter(p=>p.source==='subscription').every(p=>p.revoked_at)).toBe(true)
 expect((await rows('requester_update_permissions')).filter(p=>p.source!=='subscription')).toEqual(permissions.filter(p=>p.source!=='subscription'))
})
it('[REL-008 REL-009 DEC-008 DATA-003] original snapshot members retain revisions through identity merges until erasure; outsiders and erased archive restoration are refused',async()=>{
 const g=await releaseGraph(),outsider=await requester('Outside snapshot'),survivor=await requester('Merge survivor'),last=await requester('Final survivor'),subscriber=await requester('Independent subscriber'),follower=await requester('Request-only follower')
 // Complete this release fixture's decision through the commitment API, with
 // independent evidence that is outside the requester's later erasure lineage.
 await env.DB.prepare("UPDATE decisions SET state='draft' WHERE id='release-decision'").run()
 const priorEvidence=await json<{id:string}>(await call('/api/operator/evidence',{sourceType:'interview',wording:'Independent commitment evidence',observedAt:time()},g.operator),201)
 const bet=await json<{id:string}>(await call('/api/operator/decisions/release-decision/bets',{title:'Improve the workflow',summary:'Deliver the approved improvements'},g.operator),201)
 await json(await call(`/api/operator/evidence/${priorEvidence.id}/links`,{target:'bet',targetId:bet.id},g.operator,'PUT'))
 await env.DB.prepare("UPDATE roadmap_items SET candidate_bet_id=? WHERE id='release-item'").bind(bet.id).run()
 await json(await call('/api/operator/decisions/release-decision/commit',{selectedCandidateBetId:bet.id,rationale:'Independent evidence supports the change',ownerOperatorId:g.actor,confidence:'medium',reviewAt:'2026-11-01',noViableAlternativeReason:'Only viable approach'},g.operator))
 await g.transition('shipped')
 const history=async()=>json<DecisionHistory>(await call('/api/operator/decisions/release-decision/history',undefined,g.operator))
 const commitment=await history()
 expect(commitment.revisions).toHaveLength(1)
 expect(commitment.revisions[0].evidence).toEqual([expect.objectContaining({evidenceId:priorEvidence.id,wording:'Independent commitment evidence'})])
 const followerId=(await env.DB.prepare('SELECT id FROM requesters WHERE display_name=?').bind('Request-only follower').first<{id:string}>())!.id
 expect((await call(`/api/public/requests/${g.requests[0].slug}/follow`,{},follower)).status).toBe(204)
 await addSecondReleaseTarget(g)
 await json(await call('/api/public/updates/subscription',{subscribed:true},subscriber,'PATCH'))
 const survivorId=(await env.DB.prepare('SELECT id FROM requesters WHERE display_name=?').bind('Merge survivor').first<{id:string}>())!.id
 const lastId=(await env.DB.prepare('SELECT id FROM requesters WHERE display_name=?').bind('Final survivor').first<{id:string}>())!.id
 await json(await publish(g));await json(await correction(g),201)
 const linkedEvidence=await json<{id:string}>(await call('/api/operator/evidence',{sourceType:'interview',wording:'Independent post-release observation',observedAt:time(),releaseId:g.draft.id},g.operator),201)
 const postRelease=async()=>json<DecisionPostRelease>(await call('/api/operator/decisions/release-decision/post-release',undefined,g.operator))
 await json(await call('/api/public/requester/notifications',{muted:true},g.person,'PATCH'))
 await json(await call('/api/public/updates/subscription',{subscribed:false},g.person,'PATCH'))
 const endpoint=`/api/public/releases/${g.draft.slug}/outcomes`
 const put=(outcome:string,headers=g.person)=>call(endpoint,{targetId:'release-item',outcome},headers,'PUT')
 expect((await call(endpoint,undefined,outsider)).status).toBe(404)
 expect((await put('adopted',outsider)).status).toBe(404)
 expect((await call(endpoint)).status).toBe(401)
 await json(await put('adopted'));await json(await put('adopted'));expect(await rows('release_outcomes')).toHaveLength(1)
 const snapshots=await rows('release_recipient_snapshots'),contexts=await rows('release_recipient_contexts'),targets=await rows('release_target_snapshots'),sealedTargets=await rows('release_targets')
 const authorSnapshot=snapshots.find(row=>row.requester_id===g.recipient.requesterId)!,subscriberSnapshot=snapshots.find(row=>row.request_id===null)!,followerSnapshot=snapshots.find(row=>row.requester_id===followerId)!
 expect(subscriberSnapshot).toMatchObject({request_id:null,evidence_id:null})
 expect(followerSnapshot.request_id).toBe(g.requests[0].id)
 await json(await call(`/api/operator/requesters/${g.recipient.requesterId}/merge`,{targetRequesterId:survivorId},g.operator))
 await json(await call(`/api/operator/requesters/${survivorId}/merge`,{targetRequesterId:lastId},g.operator))
 for(const session of [g.person,survivor,last])expect(await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,session))).toMatchObject({targets:[{targetId:'release-item',outcome:'adopted',revisionNumber:1},{targetId:'second-item',outcome:null,revisionNumber:null}]})
 await json(await put('adopted'));expect(await rows('release_outcomes')).toHaveLength(1)
 await json(await put('partly_adopted'));expect(await rows('release_outcomes')).toHaveLength(2)
 await json(await put('partly_adopted',last));expect(await rows('release_outcomes')).toHaveLength(2)
 expect((await rows('release_outcomes')).every(r=>r.release_version_id===g.draft.versionId)).toBe(true)
 expect((await rows('release_outcomes')).every(r=>r.requester_id===g.recipient.requesterId)).toBe(true)
 expect(await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,g.person))).toMatchObject({targets:[{targetId:'release-item',outcome:'partly_adopted',revisionNumber:2},{targetId:'second-item',outcome:null,revisionNumber:null}]})
 expect(await rows('release_recipient_snapshots')).toEqual(snapshots);expect(await rows('release_recipient_contexts')).toEqual(contexts);expect(await rows('release_target_snapshots')).toEqual(targets)
 await json(await call(endpoint,{targetId:'second-item',outcome:'adopted'},subscriber,'PUT'))
 await json(await put('not_yet',follower))
 const subscriberAnswers=(await rows('release_outcomes')).filter(row=>row.requester_id===subscriberSnapshot.requester_id),followerAnswers=(await rows('release_outcomes')).filter(row=>row.requester_id===followerId)
 const report=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(report.whole).toMatchObject({adopted:1,partlyAdopted:1,notYet:1,responses:3,snapshotRecipients:3,coverage:1})
 expect(report.responses).toEqual(expect.arrayContaining([expect.objectContaining({requesterId:g.recipient.requesterId,snapshotId:authorSnapshot.id,revisionNumber:2,contexts:expect.arrayContaining([expect.objectContaining({requestId:g.requests[0].id,roadmapId:'release-item',decisionId:'release-decision'})])})]))
 expect((await put('not_yet',outsider)).status).toBe(404)
 const publicText=await (await call(`/api/public/releases/${g.draft.slug}`)).text()
 for(const privateValue of [g.recipient.requesterId,g.recipient.email,'partly_adopted'])expect(publicText).not.toContain(privateValue)
 const saved=await json<{archive:Archive;journal:ErasureJournal}>(await call('/api/operator/data/export',undefined,g.operator))
 const root={table:'requesters',id:lastId}
 const preview=await json<{planHash:string;counts:Record<string,number>;kept:Record<string,number>;blockedCopies:unknown[]}>(await call('/api/operator/data/erasure/preview',root,g.operator))
 // The follower is another person: their snapshot and answer on the erased author's request stay.
 expect(preview.blockedCopies).toEqual([]);expect(preview.counts).toMatchObject({requesters:3,requester_identity_merges:2,release_outcomes:2,release_recipient_snapshots:1});expect(preview.kept).toEqual({requests:2})
 expect(await json(await call('/api/operator/data/erasure',{...root,planHash:preview.planHash},g.operator))).toMatchObject({status:'complete'})
 for(const session of [g.person,survivor,last]){
  expect((await call('/api/public/identity/session',undefined,session)).status).toBe(401)
  expect((await call(endpoint,undefined,session)).status).toBe(401)
  expect((await put('adopted',session)).status).toBe(401)
 }
 expect((await put('adopted',outsider)).status).toBe(404)
 expect((await call('/api/public/identity/session',undefined,follower)).status).toBe(200)
 expect(await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,follower))).toMatchObject({targets:[{targetId:'release-item',outcome:'not_yet',revisionNumber:1},{targetId:'second-item',outcome:null,revisionNumber:null}]})
 expect((await rows('requesters')).some(row=>[g.recipient.requesterId,survivorId,lastId].includes(String(row.id)))).toBe(false)
 // Their requests stay for the follower, without an author or the author's words:
 // each is named by its approved public wording.
 expect((await rows('requests')).map(row=>[row.id,row.author_requester_id,row.title])).toEqual(g.requests.map((row,index)=>[row.id,null,`Public request ${index}`]))
 expect(await rows('request_evidence_links')).toEqual([])
 expect(await rows('release_target_snapshots')).toEqual(targets)
 expect(await rows('release_recipient_contexts')).toEqual(contexts.filter(row=>row.snapshot_id===followerSnapshot.id))
 expect(await rows('release_recipient_snapshots')).toEqual(snapshots.filter(row=>[subscriberSnapshot.id,followerSnapshot.id].includes(row.id)))
 expect(await rows('release_outcomes')).toEqual([...subscriberAnswers,...followerAnswers])
 expect(await rows('release_targets')).toEqual(sealedTargets)
 const survivingTimeline=(await postRelease()).timeline
 expect(survivingTimeline).toHaveLength(3)
 expect(survivingTimeline).toEqual(expect.arrayContaining([
  expect.objectContaining({kind:'outcome',id:subscriberAnswers[0].id,requesterId:subscriberSnapshot.requester_id,roadmapItemId:'second-item',outcome:'adopted',revisionNumber:1,requests:[],evidenceId:null}),
  expect.objectContaining({kind:'outcome',id:followerAnswers[0].id,requesterId:followerId,roadmapItemId:'release-item',outcome:'not_yet',revisionNumber:1,requests:[{requestId:g.requests[0].id,requestSlug:g.requests[0].slug}],evidenceId:null}),
  expect.objectContaining({kind:'evidence',evidenceId:linkedEvidence.id,releaseId:g.draft.id,wording:'Independent post-release observation'}),
 ]))
 expect(await history()).toEqual(commitment)
 const surviving=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(surviving.whole).toEqual({adopted:1,partlyAdopted:0,notYet:1,responses:2,snapshotRecipients:2,coverage:1})
 expect(surviving.targets).toEqual([
  expect.objectContaining({targetId:'release-item',adopted:0,partlyAdopted:0,notYet:1,responses:1,snapshotRecipients:2,coverage:0.5}),
  expect.objectContaining({targetId:'second-item',adopted:1,partlyAdopted:0,notYet:0,responses:1,snapshotRecipients:2,coverage:0.5}),
 ])
 expect(surviving.responses).toEqual([
  expect.objectContaining({requesterId:subscriberSnapshot.requester_id,snapshotId:subscriberSnapshot.id,outcome:'adopted',revisionNumber:1,contexts:[{requestId:null,requestSlug:null,evidenceId:null,roadmapId:'second-item',roadmapSlug:'second-item',decisionId:'release-decision',decisionSlug:'private-decision-slug'}]}),
  expect.objectContaining({requesterId:followerId,snapshotId:followerSnapshot.id,outcome:'not_yet',revisionNumber:1,contexts:[{requestId:g.requests[0].id,requestSlug:g.requests[0].slug,evidenceId:null,roadmapId:'release-item',roadmapSlug:'private-item-slug',decisionId:'release-decision',decisionSlug:'private-decision-slug'}]}),
 ])
 expect(await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,subscriber))).toMatchObject({targets:[
  {targetId:'release-item',title:'Approved improvement',outcome:null,revisionNumber:null},
  {targetId:'second-item',title:'Second improvement',outcome:'adopted',revisionNumber:1},
 ]})
 await json(await call(endpoint,{targetId:'release-item',outcome:'adopted'},subscriber,'PUT'))
 for(let repeat=0;repeat<2;repeat++)await json(await call(endpoint,{targetId:'second-item',outcome:'not_yet'},subscriber,'PUT'))
 const current=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(current.whole).toEqual({adopted:1,partlyAdopted:0,notYet:2,responses:3,snapshotRecipients:2,coverage:1.5})
 expect(current.targets).toEqual([
  expect.objectContaining({targetId:'release-item',adopted:1,notYet:1,responses:2,snapshotRecipients:2,coverage:1}),
  expect.objectContaining({targetId:'second-item',adopted:0,notYet:1,responses:1,snapshotRecipients:2,coverage:0.5}),
 ])
 expect(current.responses.find(row=>row.targetId==='second-item')).toMatchObject({outcome:'not_yet',revisionNumber:2})
 const retainedAnswers=await rows('release_outcomes');expect(retainedAnswers).toHaveLength(4)
 const revisedTimeline=(await postRelease()).timeline
 expect(revisedTimeline).toHaveLength(5)
 expect(revisedTimeline.filter(entry=>entry.kind==='outcome')).toEqual(expect.arrayContaining(retainedAnswers.map(answer=>expect.objectContaining({id:answer.id,requesterId:answer.requester_id,roadmapItemId:answer.roadmap_item_id,outcome:answer.outcome,revisionNumber:answer.revision_number,requests:answer.requester_id===followerId?[{requestId:g.requests[0].id,requestSlug:g.requests[0].slug}]:[],evidenceId:null}))))
 expect(revisedTimeline.filter(entry=>entry.kind==='evidence')).toEqual(survivingTimeline.filter(entry=>entry.kind==='evidence'))
 expect(await history()).toEqual(commitment)
 expect(await rows('release_recipient_contexts')).toEqual(contexts.filter(row=>row.snapshot_id===followerSnapshot.id))
 expect(await json(await call('/api/operator/data/import',saved,g.operator),409)).toEqual({error:'erasure_journal_regression'})
 const journal=await json<ErasureJournal>(await call('/api/operator/data/journal',undefined,g.operator))
 for(const [table,keys] of [
  ['requesters',[g.recipient.requesterId,survivorId,lastId].map(id=>[id])],
  ['release_recipient_snapshots',[[authorSnapshot.id]]],
  ['release_outcomes',saved.archive.tables.release_outcomes.filter(row=>![subscriberSnapshot.requester_id,followerId].includes(row.requester_id)).map(row=>[row.id])],
 ] as const)for(const key of keys)expect(journal.tombstones).toContainEqual({epoch:journal.epoch,table_name:table,key_hash:await digest(canonical([journal.origin,table,canonical(key)]))})
 expect(await json(await call('/api/operator/data/import',{archive:saved.archive,journal},g.operator),409)).toEqual({error:'stale_archive'})
 const replay=structuredClone(saved.archive);replay.epoch=journal.epoch;replay.journalHash=journal.sha256
 const {sha256:ignored,...body}=replay;void ignored;replay.sha256=await digest(canonical(body))
 expect(await json(await call('/api/operator/data/import',{archive:replay,journal},g.operator),409)).toEqual({error:'erased_archive_record'})
 expect(await rows('release_outcomes')).toEqual(retainedAnswers)
 expect(await rows('release_target_snapshots')).toEqual(targets)
 expect(await rows('release_targets')).toEqual(sealedTargets)
 for(const id of [String(subscriberSnapshot.requester_id),followerId]){
  const remainingRoot={table:'requesters',id}
  const remainingPlan=await json<{planHash:string;blockedCopies:unknown[]}>(await call('/api/operator/data/erasure/preview',remainingRoot,g.operator))
  expect(remainingPlan.blockedCopies).toEqual([])
  expect(await json(await call('/api/operator/data/erasure',{...remainingRoot,planHash:remainingPlan.planHash},g.operator))).toMatchObject({status:'complete'})
 }
 expect(await rows('release_outcomes')).toEqual([])
 const empty=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(empty.whole).toEqual({adopted:0,partlyAdopted:0,notYet:0,responses:0,snapshotRecipients:0,coverage:0})
 expect(empty.targets.map(target=>target.targetId)).toEqual(['release-item','second-item'])
 for(const target of empty.targets)expect(target).toMatchObject(empty.whole)
 expect((await postRelease()).timeline).toEqual(survivingTimeline.filter(entry=>entry.kind==='evidence'))
 expect(await history()).toEqual(commitment)
})
it('[REL-009] coverage state table counts current responses over original recipients across multiple targets with private snapshot links',async()=>{
 const g=await releaseGraph(2),second=await requester('Second recipient')
 await json(await call('/api/public/updates/subscription',{subscribed:true},second,'PATCH'))
 await addSecondReleaseTarget(g)
 await json(await publish(g))
 const states=[
  {actor:null,target:'',answer:'',counts:[0,0,0,0,0]},
  {actor:g.person,target:'release-item',answer:'adopted',counts:[1,0,0,1,0.5]},
  {actor:g.person,target:'second-item',answer:'not_yet',counts:[1,0,1,2,1]},
  {actor:second,target:'second-item',answer:'partly_adopted',counts:[1,1,1,3,1.5]},
  {actor:g.person,target:'second-item',answer:'adopted',counts:[2,1,0,3,1.5]},
 ]
 for(const state of states){
  if(state.actor)await json(await call(`/api/public/releases/${g.draft.slug}/outcomes`,{targetId:state.target,outcome:state.answer},state.actor,'PUT'))
  const report=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
  expect([report.whole.adopted,report.whole.partlyAdopted,report.whole.notYet,report.whole.responses,report.whole.coverage]).toEqual(state.counts)
  expect(report.whole.snapshotRecipients).toBe(2)
  for(const target of report.targets)expect(target.coverage).toBe(target.responses/2)
  for(const response of report.responses){expect(response.contexts[0].roadmapId).toBe(response.targetId);expect(response.contexts[0].decisionId).toBe('release-decision')}
  if(report.responses.length)expect(report.responses.find(r=>r.requesterId===g.recipient.requesterId)?.contexts[0].requestId).toBe(g.requests[0].id)
 }
 const snapshots=await rows('release_recipient_snapshots'),secondId=String(snapshots.find(row=>row.requester_id!==g.recipient.requesterId)!.requester_id)
 await json(await call(`/api/operator/requesters/${g.recipient.requesterId}/merge`,{targetRequesterId:secondId},g.operator))
 const endpoint=`/api/public/releases/${g.draft.slug}/outcomes`
 for(const session of [g.person,second])expect((await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,session))).targets.find(target=>target.targetId==='second-item')).toMatchObject({outcome:'adopted',revisionNumber:2})
 const afterMerge=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(afterMerge.whole).toMatchObject({adopted:2,partlyAdopted:0,notYet:0,responses:2,snapshotRecipients:2,coverage:1})
 for(let repeat=0;repeat<2;repeat++)await json(await call(endpoint,{targetId:'second-item',outcome:'not_yet'},second,'PUT'))
 const mergedReport=await json<ReleaseOutcomeReport>(await call(`/api/operator/releases/${g.draft.slug}/outcomes`,undefined,g.operator))
 expect(mergedReport.whole).toMatchObject({adopted:1,partlyAdopted:0,notYet:1,responses:2,snapshotRecipients:2,coverage:1})
 expect(mergedReport.responses.filter(response=>response.targetId==='second-item')).toEqual([
  expect.objectContaining({requesterId:g.recipient.requesterId,outcome:'not_yet',revisionNumber:3}),
 ])
 for(const session of [g.person,second])expect((await json<RequesterReleaseOutcomes>(await call(endpoint,undefined,session))).targets.find(target=>target.targetId==='second-item')).toMatchObject({outcome:'not_yet',revisionNumber:3})
 expect(await rows('release_outcomes')).toHaveLength(5)
 expect(await rows('release_recipient_snapshots')).toEqual(snapshots)
})
