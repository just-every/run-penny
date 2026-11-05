import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, expect, inject, it } from 'vitest'
import type { DecisionHistory } from '../../src/core/features/decisions/history'
import type { OperatorDecisionBrief } from '../../src/core/shared/api/operator'
import { seedLoop, request, json, evidence, bet, link, row, commitInput, operatorId, stamp } from './decision-loop-fixture'

beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')); await seedLoop() })

it('[DEC-001][DEC-002] requires question, owner, a bet and linked evidence, and reverses readiness when the final link is removed', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:''}),201)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft',owner_operator_id:null})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:null}))
 const a=await bet(d.id),e=await evidence();await link(e.id,a.id)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'',ownerOperatorId:operatorId}))
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 await link(e.id,a.id,'supporting','DELETE')
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
})

it('[DEC-003][DEC-004] keeps separate dimensions and bet order through evidence changes and commitment', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:'Compare the evidence',ownerOperatorId:operatorId}),201),a=await bet(d.id,'A'),b=await bet(d.id,'B'),empty=await bet(d.id,'No support yet')
 for(const id of ['dimensions-a1','dimensions-a2','dimensions-a3'])await env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,stamp,stamp).run()
 for(const id of ['dimensions-r1','dimensions-r2'])await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,id,stamp,stamp).run()
 const e1=await evidence({wording:'synthetic-penny-1',accountId:'dimensions-a1',observedAt:'2026-01-01T00:00:00Z'}),e2=await evidence({wording:'synthetic-penny-2',accountId:'dimensions-a1',observedAt:'2026-01-03T10:00:00+10:00'}),e3=await evidence({wording:'synthetic-penny-3',accountId:'dimensions-a2',observedAt:'2026-01-02T00:00:00Z'}),e4=await evidence({wording:'synthetic-penny-4',observedAt:'2026-01-03T00:30:00Z'})
 for(const e of [e1,e2])await env.DB.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind('dimensions-r1',e.id).run()
 await env.DB.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind('dimensions-r2',e3.id).run()
 for(const account of ['dimensions-a1','dimensions-a3'])await env.DB.prepare('INSERT INTO candidate_bet_account_links(candidate_bet_id,account_id,created_at) VALUES(?,?,?)').bind(a.id,account,stamp).run()
 for(const e of [e1,e2])await link(e.id,a.id)
 for(const e of [e2,e4])await link(e.id,b.id)
 for(const candidate of [a,b])await link(e3.id,candidate.id,'contradicting')
 await link(e2.id,a.id)
 await json(request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'A',summary:'Updated approach',urgency:'Now',deliveryShape:'One small release',successMeasure:'Completion in ten seconds'}))
 const read=async()=>{
  const result=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
  expect(Object.keys(result).sort()).toEqual(['id','slug','title','state','reviewAt','lastAction','lastActionAt','owner','evidenceCount','accountCount','question','confidence','rationale','selectedCandidateBetId','bets','roadmapItem'].sort())
  return result
 }
 const brief=await read(),baseline=brief.bets.map(candidate=>candidate.id)
 expect([...baseline].sort()).toEqual([a.id,b.id,empty.id].sort())
 expect(brief).toMatchObject({evidenceCount:4,accountCount:3})
 const account=(id:string)=>({id,slug:id,name:id,revenueCents:null,health:null})
 const source=(id:string,wording:string,observedAt:string,accountId:string|null,requesterId:string|null,stance:string)=>({
  id,wording,observedAt,sourceType:'interview',sourceLabel:null,namedSpeaker:null,admittedSender:null,reviewState:'unreviewed',reviewReason:null,tags:[],stance,
  account:accountId?{id:accountId,slug:accountId,name:accountId}:null,
  requester:requesterId?{id:requesterId,displayName:requesterId,email:null}:null,
 })
 const support1=source(e1.id,'synthetic-penny-1','2026-01-01T00:00:00Z','dimensions-a1','dimensions-r1','supporting')
 const support2=source(e2.id,'synthetic-penny-2','2026-01-03T10:00:00+10:00','dimensions-a1','dimensions-r1','supporting')
 const contrary=source(e3.id,'synthetic-penny-3','2026-01-02T00:00:00Z','dimensions-a2','dimensions-r2','contradicting')
 const support4=source(e4.id,'synthetic-penny-4','2026-01-03T00:30:00Z',null,null,'supporting')
 const expected=[
  {id:a.id,title:'A',summary:'Updated approach',urgency:'Now',deliveryShape:'One small release',successMeasure:'Completion in ten seconds',assumptions:null,counterEvidence:null,
   accounts:['dimensions-a1','dimensions-a2','dimensions-a3'].map(account),evidence:[support2,contrary,support1],
   metrics:{affectedRequesterCount:2,affectedAccountCount:3,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T10:00:00+10:00'}},
  {id:b.id,title:'B',summary:'A concrete approach',urgency:'This quarter',deliveryShape:'Small release',successMeasure:'Completion time below 30 seconds',assumptions:null,counterEvidence:null,
   accounts:['dimensions-a1','dimensions-a2'].map(account),evidence:[support4,support2,contrary],
   metrics:{affectedRequesterCount:2,affectedAccountCount:2,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T00:30:00Z'}},
  {id:empty.id,title:'No support yet',summary:'A concrete approach',urgency:'This quarter',deliveryShape:'Small release',successMeasure:'Completion time below 30 seconds',assumptions:null,counterEvidence:null,accounts:[],evidence:[],
   metrics:{affectedRequesterCount:0,affectedAccountCount:0,supportingCount:0,contradictingCount:0,latestSupportAt:null}},
 ]
 // Full projections reject extra score or rank fields, including inside metrics.
 const inBaselineOrder=(items:typeof expected)=>baseline.map(id=>items.find(candidate=>candidate.id===id)!)
 expect(brief.bets).toEqual(inBaselineOrder(expected))
 const assertStoredBets=async(records=expected)=>{
  const stored=(await env.DB.prepare('SELECT * FROM candidate_bets WHERE decision_id=? ORDER BY id').bind(d.id).all()).results
  expect(stored).toEqual([...records].sort((x,y)=>x.id.localeCompare(y.id)).map(candidate=>({
   id:candidate.id,decision_id:d.id,title:candidate.title,summary:candidate.summary,urgency:candidate.urgency,delivery_shape:candidate.deliveryShape,success_measure:candidate.successMeasure,
   assumptions:null,counter_evidence:null,created_at:expect.any(String),updated_at:expect.any(String),
  })))
 }
 await assertStoredBets()
 // Make B stronger in each changed dimension through the real mutation doors.
 const additions:{id:string;account:typeof expected[0]['accounts'][number];source:typeof support1}[]=[]
 for(const [index,date] of [[5,'2026-01-04T00:00:00Z'],[6,'2026-01-05T00:00:00Z']] as const){
  const name=`synthetic-penny-${index}`
  const addedAccount=await json(request('/api/operator/accounts','POST',{name,internalOwnerId:operatorId}),201)
  const added=await evidence({wording:name,observedAt:date,accountId:addedAccount.id})
  await link(added.id,b.id)
  additions.push({id:added.id,account:{id:addedAccount.id,slug:addedAccount.slug,name,revenueCents:null,health:null},source:{...source(added.id,name,date,null,null,'supporting'),account:{id:addedAccount.id,slug:addedAccount.slug,name}}})
 }
 await json(request(`/api/operator/decisions/${d.id}/bets/${b.id}`,'PATCH',{title:'B',summary:'A concrete approach',urgency:'Immediate',deliveryShape:'Small release',successMeasure:'Completion time below 30 seconds'}))
 const changed=await read()
 const strongerB={...expected[1],urgency:'Immediate',accounts:[...expected[1].accounts,...additions.map(item=>item.account)],evidence:[...additions.map(item=>item.source).reverse(),support4,support2,contrary],metrics:{affectedRequesterCount:2,affectedAccountCount:4,supportingCount:4,contradictingCount:1,latestSupportAt:'2026-01-05T00:00:00Z'}}
 expect(changed.bets).toEqual(inBaselineOrder([expected[0],strongerB,expected[2]]))
 await assertStoredBets([expected[0],strongerB,expected[2]])
 expect(changed.bets.map(candidate=>candidate.id)).toEqual(baseline)
 expect(changed.bets.find(candidate=>candidate.id===b.id)?.metrics).toEqual({affectedRequesterCount:2,affectedAccountCount:4,supportingCount:4,contradictingCount:1,latestSupportAt:'2026-01-05T00:00:00Z'})
 // Move all support to A, reversing the apparent strongest option again.
 for(const item of additions){await link(item.id,b.id,'supporting','DELETE');await link(item.id,a.id)}
 await link(e4.id,b.id,'supporting','DELETE');await link(e4.id,a.id)
 const finalBrief=await read()
 const strongerA={...expected[0],accounts:[...expected[0].accounts,...additions.map(item=>item.account)],evidence:[...additions.map(item=>item.source).reverse(),support4,support2,contrary,support1],metrics:{affectedRequesterCount:2,affectedAccountCount:5,supportingCount:5,contradictingCount:1,latestSupportAt:'2026-01-05T00:00:00Z'}}
 const weakerB={...expected[1],urgency:'Immediate',evidence:[support2,contrary],metrics:{affectedRequesterCount:2,affectedAccountCount:2,supportingCount:1,contradictingCount:1,latestSupportAt:'2026-01-03T10:00:00+10:00'}}
 expect(finalBrief.bets.map(candidate=>candidate.id)).toEqual(baseline)
 expect(finalBrief.bets).toEqual(inBaselineOrder([strongerA,weakerB,expected[2]]))
 await assertStoredBets([strongerA,weakerB,expected[2]])
 // Restore the original comparison through the same doors before sealing it.
 for(const item of additions)await link(item.id,a.id,'supporting','DELETE')
 await link(e4.id,a.id,'supporting','DELETE');await link(e4.id,b.id)
 await json(request(`/api/operator/decisions/${d.id}/bets/${b.id}`,'PATCH',{title:'B',summary:'A concrete approach',urgency:'This quarter',deliveryShape:'Small release',successMeasure:'Completion time below 30 seconds'}))
 expect((await read()).bets).toEqual(inBaselineOrder(expected))
 await assertStoredBets()
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 const snapshots=(await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE decision_revision_id=? ORDER BY candidate_bet_id').bind(result.revisionId).all()).results
 const expectedSnapshots=[...expected].sort((x,y)=>x.id.localeCompare(y.id)).map(candidate=>({
  id:expect.any(String),decision_revision_id:result.revisionId,candidate_bet_id:candidate.id,disposition:candidate.id===a.id?'selected':'declined',title:candidate.title,summary:candidate.summary,
  urgency:candidate.urgency,delivery_shape:candidate.deliveryShape,success_measure:candidate.successMeasure,
  affected_requester_count:candidate.metrics.affectedRequesterCount,affected_account_count:candidate.metrics.affectedAccountCount,supporting_count:candidate.metrics.supportingCount,contradicting_count:candidate.metrics.contradictingCount,latest_support_at:candidate.metrics.latestSupportAt,
  created_at:expect.any(String),updated_at:expect.any(String),
 }))
 expect(snapshots).toEqual(expectedSnapshots)
 const history=await json<DecisionHistory>(request(`/api/operator/decisions/${d.id}/history`))
 expect(history.revisions[0].bets).toEqual([a.id,...[b.id,empty.id].sort()].map(id=>{
  const candidate=expected.find(candidate=>candidate.id===id)!
  return {candidateBetId:id,disposition:id===a.id?'selected':'declined',title:candidate.title,summary:candidate.summary,urgency:candidate.urgency,deliveryShape:candidate.deliveryShape,successMeasure:candidate.successMeasure,...candidate.metrics}
 }))
 expect((await read()).bets).toEqual(inBaselineOrder(expected))
})
