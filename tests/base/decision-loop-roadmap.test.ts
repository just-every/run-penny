import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,describe,expect,inject,it } from 'vitest'
import { seedLoop,request,json,document,committed,publicRequest,approve,row,ready,commitInput,stamp } from './decision-loop-fixture'
import { decision,bet,evidence,link } from './decision-loop-fixture'
import { call } from './support'
import type { PublicRoadmapItem } from '@/core/shared/api/public'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop();const settings=await json<any>(request('/api/operator/settings/status-roadmap'));await json(request('/api/operator/settings/status-roadmap','PUT',{...settings.settings,source:'approved_items'}))})
const publication=(id:string)=>env.DB.prepare('SELECT * FROM roadmap_publications WHERE roadmap_item_id=?').bind(id).first<{id:string;public_slug:string;approved_at:string;updated_at:string;withdrawn_at:string|null}>()
const move=(id:string,status:string,key=crypto.randomUUID())=>request(`/api/operator/roadmap/${id}/move`,'POST',{status,reason:'Measured delivery reason',idempotencyKey:key})

async function privateRoadmap() {
 const privateValues={
  accountName:'synthetic-penny-301',revenueCents:91827364,targetWindow:'2034-08-19',
  confidence:'high' as const,rationale:'synthetic-penny-302',wording:'synthetic-penny-303',
  declinedBet:'synthetic-penny-304',deliveryNotes:'synthetic-penny-305',reviewAt:'2034-09-21',
  title:'synthetic-penny-306',summary:'synthetic-penny-307',accountImpact:'synthetic-penny-308',
 }
 const account=await json(request('/api/operator/accounts','POST',{name:privateValues.accountName,internalOwnerId:'loop-operator',revenueCents:privateValues.revenueCents}),201)
 const d=await decision(),a=await bet(d.id),b=await bet(d.id,privateValues.declinedBet)
 const e=await evidence({wording:privateValues.wording,accountId:account.id});await link(e.id,a.id)
 const committedItem=await json<{itemId:string;revisionId:string;slug:string}>(request(`/api/operator/decisions/${d.id}/commit`,'POST',{
  ...commitInput(a.id),rationale:privateValues.rationale,confidence:privateValues.confidence,reviewAt:privateValues.reviewAt,
 }))
 await json(request(`/api/operator/roadmap/${committedItem.itemId}`,'PATCH',{
  title:privateValues.title,summary:privateValues.summary,ownerOperatorId:'loop-operator',
  targetWindow:privateValues.targetWindow,deliveryNotes:privateValues.deliveryNotes,confidence:privateValues.confidence,
  accountImpact:privateValues.accountImpact,decisionId:d.id,candidateBetId:a.id,publicTitle:null,publicSummary:null,evidenceIds:[e.id],
 }))
 return {...committedItem,d,a,b,e,account,privateValues}
}

async function assertPublicProjection(expected:PublicRoadmapItem,privateValues:readonly (string|number)[]) {
 const list=await json<PublicRoadmapItem[]>(call('/api/public/roadmap'))
 const detail=await json<PublicRoadmapItem>(call(`/api/public/roadmap/${expected.slug}`))
 // Complete equality rejects extra fields even when their values are not known to this fixture.
 expect(list.filter(item=>item.slug===expected.slug)).toEqual([expected]);expect(detail).toEqual(expected)
 const forbiddenFields=[
  'account','accounts','accountName','account_name','accountImpact','account_impact','revenue','revenueCents','revenue_cents',
  'targetWindow','target_window','reviewAt','review_at','createdAt','created_at','updatedAt','updated_at',
  'confidence','rationale','evidence','evidenceIds','evidence_ids','declinedBets','declined_bets','deliveryNotes','delivery_notes',
 ]
 for(const path of ['/portal/roadmap',`/portal/roadmap/${expected.slug}`]){
  const response=await call(path,undefined,{Accept:'text/html'});expect(response.status).toBe(200)
  const html=await response.text()
  expect(html).toContain(expected.title);expect(html).toContain(expected.summary);expect(html).toContain(expected.board!.name)
  expect(html.replace(/<!--[^>]*-->/g,'')).toContain(`ETA: ${expected.publicEta}`)
  for(const request of expected.requests)expect(html).toContain(`/portal/feedback/${request.slug}`)
  for(const release of expected.releases!)expect(html).toContain(`/portal/updates/${release.slug}`)
  for(const text of [JSON.stringify(list),JSON.stringify(detail),html]){
   for(const field of forbiddenFields)expect(text).not.toMatch(new RegExp(`(?:["'<>]|&quot;)${field}(?:["'<>]|&quot;)`))
   for(const value of privateValues){
    // Confidence is an enum; match its standalone serialized or rendered value, not an unrelated HTML attribute substring.
    if(value==='high')expect(text).not.toMatch(/(?:["'>]|&quot;)high(?:["'<]|&quot;)/)
    else expect(text).not.toContain(String(value))
   }
  }
 }
}
describe('Explicit roadmap publication',()=>{
 it('[ROAD-004][ROAD-005][ROAD-006] keeps commitments internal, approves safe identity, withdraws to 404 and reuses the mapping slot without losing history',async()=>{
  const c=await committed(),r=await publicRequest();expect(await publication(c.itemId)).toBeNull();const internal=await row('roadmap_items',c.itemId);expect(JSON.stringify(await json(request('/api/public/roadmap')))).not.toContain(c.slug)
  await approve(c.itemId,[r.id]);const p=(await publication(c.itemId))!;expect(p.public_slug).not.toBe(c.slug)
  expect(await json(request(`/api/public/roadmap/${p.public_slug}`))).toMatchObject({slug:p.public_slug,status:'planned',title:'Safe roadmap title',summary:'Safe roadmap problem',board:{slug:'loop-board',name:'Loop board'}})
  expect((await document(`/portal/roadmap/${p.public_slug}`)).status).toBe(200)
  await json(request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}));expect((await request(`/api/public/roadmap/${p.public_slug}`)).status).toBe(404);expect((await document(`/portal/roadmap/${p.public_slug}`)).status).toBe(404);expect(await row('roadmap_items',c.itemId)).toEqual(internal)
  const other=await committed();await approve(other.itemId,[r.id]);expect((await env.DB.prepare('SELECT * FROM roadmap_mapping_history WHERE request_id=?').bind(r.id).all()).results).toHaveLength(1)
 })
 it('[ROAD-004] refuses second mappings including concurrent approval and rejects private, blocked or nonexistent requests atomically',async()=>{
  const a=await committed(),b=await committed(),r=await publicRequest();const results=await Promise.all([request(`/api/operator/roadmap/${a.itemId}/approve`,'POST',{publicTitle:'A',publicSummary:'Problem A',boardSlug:'loop-board',requestIds:[r.id]}),request(`/api/operator/roadmap/${b.itemId}/approve`,'POST',{publicTitle:'B',publicSummary:'Problem B',boardSlug:'loop-board',requestIds:[r.id]})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect((await env.DB.prepare('SELECT * FROM roadmap_request_mappings WHERE request_id=? AND withdrawn_at IS NULL').bind(r.id).all()).results).toHaveLength(1)
  const c=await committed();for(const requestIds of [['missing'],[r.id,r.id]]){expect([409,422]).toContain((await request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'Safe',publicSummary:'Safe',boardSlug:'loop-board',requestIds})).status);expect(await publication(c.itemId)).toBeNull()}
  const privateRequest=await publicRequest();await env.DB.prepare("UPDATE requests SET moderation_state='awaiting_review',published_at=NULL WHERE id=?").bind(privateRequest.id).run();expect((await request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'Safe',publicSummary:'Safe',boardSlug:'loop-board',requestIds:[privateRequest.id]})).status).toBe(422);expect(await publication(c.itemId)).toBeNull()
 })
 it('[ROAD-001][ROAD-003][ROAD-007] projects every forward/backward move within five seconds and snapshots exact approval/mapping witnesses atomically',async()=>{
  const c=await privateRoadmap(),r=await publicRequest();await approve(c.itemId,[r.id])
  await json(request(`/api/operator/roadmap/${c.itemId}/public-eta`,'PUT',{publicEta:'2034-Q4',approvalId:(await publication(c.itemId))!.id}))
  await json(move(c.itemId,'shipped'))
  const tag=await json(request('/api/operator/catalog/tags','POST',{name:'Public improvement'}),201)
  const release=await json(request('/api/operator/releases','POST',{title:'Safe public release',body:'Approved release details',releaseType:'improved',tagIds:[tag.id],publicationDate:'2026-10-08',setupUrl:'',targetIds:[c.itemId],authorOperatorId:'loop-operator'}),201)
  await json(request(`/api/operator/releases/${release.slug}/publish`,'POST',{}));await json(move(c.itemId,'planned'))
  const p=(await publication(c.itemId))!,decisionBefore=await row('decisions',c.d.id)
  const expected:PublicRoadmapItem={slug:p.public_slug,title:'Safe roadmap title',summary:'Safe roadmap problem',status:'planned',board:{slug:'loop-board',name:'Loop board'},publicEta:'2034-Q4',requests:[{slug:r.slug,title:'Safe request'}],releases:[{slug:release.slug,title:'Safe public release'}]}
  const privateValues=[...Object.values(c.privateValues),c.slug,c.d.id,c.a.id,c.b.id,c.e.id,c.account.id]
  await assertPublicProjection(expected,privateValues)
  let prior='planned'
  for(const status of ['exploring','in_progress','shipped','planned','dropped','exploring']){
   const started=Date.now(),result=await json(move(c.itemId,status));const transition=await row('roadmap_transitions',result.transitionId);expect(transition).toMatchObject({from_status:prior,to_status:status,reason:'Measured delivery reason',actor_operator_id:'loop-operator'});prior=status
   const publicStatus=status==='exploring'?'under_review':status==='dropped'?'open':status
   expect(await json(request(`/api/public/requests/${r.slug}`))).toMatchObject({status:publicStatus})
   const page=await document(`/portal/feedback/${r.slug}`);expect(page.status).toBe(200);expect(await page.text()).toContain(({under_review:'Under review',planned:'Planned',in_progress:'In progress',shipped:'Shipped',open:'Open'} as Record<string,string>)[publicStatus]);const elapsedMs=Date.now()-started;expect(elapsedMs).toBeLessThan(5000);console.info('[ROAD-003] API and SSR projection',{status,elapsedMs})
   const publicItem=await request(`/api/public/roadmap/${p.public_slug}`);expect(publicItem.status).toBe(status==='dropped'?404:200)
   if(status==='dropped'){
    expect((await json<PublicRoadmapItem[]>(call('/api/public/roadmap'))).filter(item=>item.slug===p.public_slug)).toEqual([])
    expect((await call(`/api/public/roadmap/${p.public_slug}`)).status).toBe(404)
    expect((await call(`/portal/roadmap/${p.public_slug}`,undefined,{Accept:'text/html'})).status).toBe(404)
    const html=await (await call('/portal/roadmap',undefined,{Accept:'text/html'})).text();expect(html).not.toContain(p.public_slug)
   }else await assertPublicProjection({...expected,status:publicStatus as PublicRoadmapItem['status']},privateValues)
   const draft=await row('roadmap_update_versions',result.transitionId);expect(draft).toMatchObject({title:'Safe roadmap title',problem:'Safe roadmap problem',public_slug:p.public_slug,approval_id:p.id,approval_at:p.approved_at,approval_updated_at:p.updated_at,published_at:null,public_status:status==='dropped'?'withdrawn':publicStatus})
   expect((await env.DB.prepare('SELECT * FROM roadmap_update_targets WHERE version_id=?').bind(result.transitionId).all()).results).toMatchObject([{request_id:r.id,approval_at:p.approved_at}]);expect(await row('decisions',c.d.id)).toEqual(decisionBefore)
   expect((await publication(c.itemId))!.withdrawn_at).toBeNull()
  }
  // [ROAD-001 ROAD-007] Replay and failed moves use the same approved item and request.
  const key=crypto.randomUUID(),responses=await Promise.all([move(c.itemId,'in_progress',key),move(c.itemId,'in_progress',key)]);expect(responses.map(r=>r.status)).toEqual([200,200]);expect(await responses[0].json()).toEqual(await responses[1].json());expect((await move(c.itemId,'shipped',key)).status).toBe(409)
  const before=await row('roadmap_items',c.itemId),transitions=(await env.DB.prepare('SELECT * FROM roadmap_transitions WHERE roadmap_item_id=? ORDER BY id').bind(c.itemId).all()).results
  await env.DB.exec("CREATE TRIGGER fail_draft BEFORE INSERT ON roadmap_update_versions BEGIN SELECT RAISE(ABORT,'late draft failure'); END")
  try{expect((await move(c.itemId,'shipped')).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER fail_draft')}
  expect(await row('roadmap_items',c.itemId)).toEqual(before);expect((await env.DB.prepare('SELECT * FROM roadmap_transitions WHERE roadmap_item_id=? ORDER BY id').bind(c.itemId).all()).results).toEqual(transitions)
 })
 it('[DEC-005][ROAD-007] committing an existing approved item records its real prior status and exactly one safe draft',async()=>{
  const {d,a}=await ready(),id='existing-'+a.id;await env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'exploring',?,?)").bind(id,id,d.id,a.id,'Existing internal title','Internal summary',stamp,stamp).run();await approve(id)
  const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)));expect(result.itemId).toBe(id);expect((await env.DB.prepare('SELECT from_status,to_status FROM roadmap_transitions WHERE roadmap_item_id=?').bind(id).all()).results).toEqual([{from_status:'exploring',to_status:'planned'}]);expect((await env.DB.prepare('SELECT title,public_status FROM roadmap_update_versions WHERE roadmap_item_id=?').bind(id).all()).results).toEqual([{title:'Safe roadmap title',public_status:'planned'}])
 })
})

it('[ROAD-001][ROAD-007] concurrent distinct moves form a truthful transition chain, and unapproved items prepare no draft',async()=>{
 const c=await committed();const responses=await Promise.all([move(c.itemId,'exploring'),move(c.itemId,'shipped')]);expect(responses.map(r=>r.status)).toEqual([200,200]);const transitions=(await env.DB.prepare('SELECT from_status,to_status FROM roadmap_transitions WHERE roadmap_item_id=? ORDER BY rowid').bind(c.itemId).all<{from_status:string;to_status:string}>()).results
 expect(transitions).toHaveLength(2);expect(transitions[0].from_status).toBe('planned');expect(transitions[1].from_status).toBe(transitions[0].to_status);expect(await row('roadmap_items',c.itemId)).toMatchObject({status:transitions[1].to_status});expect((await env.DB.prepare('SELECT * FROM roadmap_update_versions WHERE roadmap_item_id=?').bind(c.itemId).all()).results).toHaveLength(0)
})

it('[ROAD-004][ROAD-007] a move racing reapproval captures one complete approval and its mappings, while withdrawal cannot leave a partially captured draft',async()=>{
 const c=await committed(),oldRequest=await publicRequest(),newRequest=await publicRequest();await approve(c.itemId,[oldRequest.id])
 const prior=(await publication(c.itemId))!
 const [moved,reapproved]=await Promise.all([move(c.itemId,'in_progress'),request(`/api/operator/roadmap/${c.itemId}/approve`,'POST',{publicTitle:'New approved problem',publicSummary:'New approved summary',boardSlug:'loop-board',requestIds:[newRequest.id]})])
 expect(reapproved.status).toBe(200);expect(moved.status).toBe(200)
 const transition=await moved.json() as {transitionId:string},draft=await row('roadmap_update_versions',transition.transitionId)
 const current=(await publication(c.itemId))!,usedPrior=draft!.approval_id===prior.id
 expect(draft).toMatchObject(usedPrior?{approval_id:prior.id,title:'Safe roadmap title',problem:'Safe roadmap problem',approval_at:prior.approved_at,approval_updated_at:prior.updated_at}:{approval_id:current.id,title:'New approved problem',problem:'New approved summary',approval_at:current.approved_at,approval_updated_at:current.updated_at})
 expect((await env.DB.prepare('SELECT request_id FROM roadmap_update_targets WHERE version_id=?').bind(transition.transitionId).all()).results).toEqual([{request_id:usedPrior?oldRequest.id:newRequest.id}])
 const [withdrawing,secondMove]=await Promise.all([request(`/api/operator/roadmap/${c.itemId}/withdraw`,'POST',{}),move(c.itemId,'shipped')])
 expect(withdrawing.status).toBe(200);expect(secondMove.status).toBe(200)
 const second=await secondMove.json() as {transitionId:string},secondDraft=await row('roadmap_update_versions',second.transitionId)
 const targets=(await env.DB.prepare('SELECT request_id FROM roadmap_update_targets WHERE version_id=?').bind(second.transitionId).all()).results
 if(secondDraft){expect(secondDraft).toMatchObject({approval_id:current.id,title:'New approved problem'});expect(targets).toEqual([{request_id:newRequest.id}])}else expect(targets).toEqual([])
 expect((await request(`/api/public/roadmap/${current.public_slug}`)).status).toBe(404)
})
