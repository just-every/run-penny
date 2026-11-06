import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeAll, expect, inject, it, vi } from 'vitest'
import type { OperatorDecisionBrief } from '../../src/core/shared/api/operator'
import { seedLoop, request, json, evidence, bet, link, row, commitInput, operatorId, stamp, publicRequest, approve } from './decision-loop-fixture'

import { call, mockMail, requester } from './support'

afterEach(() => vi.restoreAllMocks())

beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')); await seedLoop() })

it('[DEC-001][DEC-002] retains confidence, review dates and per-bet assumptions and reads current eligible requesters through approved mappings', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:'',confidence:'low',reviewAt:'2026-11-12'}),201)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft',owner_operator_id:null})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'',owner:null,confidence:'low',reviewAt:'2026-11-12',bets:[]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:null,confidence:'medium',reviewAt:'2026-12-03'}))
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'Which approach?',owner:null,confidence:'medium',reviewAt:'2026-12-03',state:'draft'})
 const a=await json(request(`/api/operator/decisions/${d.id}/bets`,'POST',{title:'Approach A',summary:'A concrete approach',assumptions:'People can complete the task independently'}),201),b=await bet(d.id,'Approach B'),e=await evidence();await link(e.id,a.id)
 expect((await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).bets).toMatchObject([{id:a.id,assumptions:'People can complete the task independently'},{id:b.id,assumptions:null}])
 await json(request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'Approach A',summary:'An edited approach',assumptions:'The workflow needs no training'}))
 await json(request(`/api/operator/decisions/${d.id}/bets/${b.id}`,'PATCH',{title:'Approach B',summary:'A different approach',assumptions:'Training is available'}))
 await json(request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'Approach A',summary:'Another edit without changing assumptions'}))
 expect((await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).bets).toMatchObject([{id:a.id,assumptions:'The workflow needs no training'},{id:b.id,assumptions:'Training is available'}])
 await json(request(`/api/operator/decisions/${d.id}/bets/${b.id}`,'PATCH',{title:'Approach B',summary:'A different approach',assumptions:null}))
 expect((await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).bets).toMatchObject([{id:a.id,assumptions:'The workflow needs no training'},{id:b.id,assumptions:null}])
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId,confidence:'high',reviewAt:'2027-01-14'}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'Which approach?',owner:{id:operatorId},confidence:'high',reviewAt:'2027-01-14',evidenceCount:1,bets:[{id:a.id},{id:b.id}]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'',ownerOperatorId:operatorId,confidence:'high',reviewAt:null}))
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'',owner:{id:operatorId},confidence:'high',reviewAt:null,evidenceCount:1,bets:[{id:a.id},{id:b.id}]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 await link(e.id,a.id,'supporting','DELETE')
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 await link(e.id,a.id)
 mockMail()
 const first=await requester('Mapped requester one'),second=await requester('Mapped requester two'),unmapped=await requester('Unmapped requester')
 const r1=await publicRequest(),r2=await publicRequest(),other=await publicRequest()
 for(const [person,r] of [[first,r1],[first,r2],[second,r2],[unmapped,other]] as const)expect((await call(`/api/public/requests/${r.slug}/follow`,{},person)).status).toBe(204)
 const read=async()=>await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect((await read()).eligibleRequesters).toEqual([])
 const committed=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 await approve(committed.itemId,[r1.id,r2.id])
 const identities=(await env.DB.prepare('SELECT id,display_name AS displayName FROM requesters WHERE display_name IN (?,?) ORDER BY display_name,id').bind('Mapped requester one','Mapped requester two').all<{id:string;displayName:string}>()).results
 expect((await read()).eligibleRequesters).toEqual(identities)
 expect((await call(`/api/public/requests/${r1.slug}/follow`,{muted:true},first,'PATCH')).status).toBe(204)
 expect((await read()).eligibleRequesters).toEqual(identities)
 expect((await call(`/api/public/requests/${r2.slug}/follow`,undefined,first,'DELETE')).status).toBe(204)
 expect((await read()).eligibleRequesters).toEqual([identities[1]])
 expect((await call(`/api/public/requests/${r1.slug}/follow`,{muted:false},first,'PATCH')).status).toBe(204)
 expect((await read()).eligibleRequesters).toEqual(identities)
 expect((await call('/api/public/requester/notifications',{muted:true},second,'PATCH')).status).toBe(200)
 expect((await read()).eligibleRequesters).toEqual([identities[0]])
 expect((await call('/api/public/requester/notifications',{muted:false},second,'PATCH')).status).toBe(200)
 expect((await read()).eligibleRequesters).toEqual(identities)
 const permissions=(await env.DB.prepare('SELECT * FROM requester_update_permissions ORDER BY id').all()).results
 await read();await read()
 expect((await env.DB.prepare('SELECT * FROM requester_update_permissions ORDER BY id').all()).results).toEqual(permissions)
 expect((await call(`/api/operator/decisions/${d.slug}`)).status).toBe(401)
 await json(request(`/api/operator/roadmap/${committed.itemId}/withdraw`,'POST',{}))
 expect((await read()).eligibleRequesters).toEqual([])
 await approve(committed.itemId,[r2.id])
 expect((await read()).eligibleRequesters).toEqual([identities[1]])
 expect(await read()).toMatchObject({id:d.id,slug:d.slug,bets:[{id:a.id,assumptions:'The workflow needs no training'},{id:b.id,assumptions:null}]})
 expect((await request(`/api/operator/requesters/${identities[1].id}/block`,'POST',{})).status).toBe(200)
 expect((await read()).eligibleRequesters).toEqual([])
 expect((await request(`/api/operator/requesters/${identities[1].id}/block`,'DELETE')).status).toBe(204)
 expect((await read()).eligibleRequesters).toEqual([identities[1]])
 const root={table:'requesters',id:identities[1].id}
 const preview=await json(request('/api/operator/data/erasure/preview','POST',root))
 expect(await json(request('/api/operator/data/erasure','POST',{...root,planHash:preview.planHash}))).toMatchObject({status:'complete'})
 expect((await read()).eligibleRequesters).toEqual([])
 expect((await call(`/api/public/requests/${r2.slug}/follow`,{},second)).status).toBe(401)
 expect((await read()).eligibleRequesters).toEqual([])

})

it('[DEC-003][DEC-004] compares distinct stored relations, null provenance, shared evidence and offset instants without summing duplicate accounts', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:'Compare the evidence',ownerOperatorId:operatorId}),201),a=await bet(d.id,'A'),b=await bet(d.id,'B'),empty=await bet(d.id,'No support yet')
 for(const id of ['dimensions-a1','dimensions-a2','dimensions-a3'])await env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,stamp,stamp).run()
 for(const id of ['dimensions-r1','dimensions-r2'])await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,id,stamp,stamp).run()
 const e1=await evidence({wording:'Independent supporting observation one',accountId:'dimensions-a1',observedAt:'2026-01-01T00:00:00Z'}),e2=await evidence({wording:'Independent supporting observation two',accountId:'dimensions-a1',observedAt:'2026-01-03T10:00:00+10:00'}),e3=await evidence({wording:'Independent contradicting observation',accountId:'dimensions-a2',observedAt:'2026-01-02T00:00:00Z'}),e4=await evidence({observedAt:'2026-01-03T00:30:00Z'})
 for(const e of [e1,e2])await env.DB.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind('dimensions-r1',e.id).run()
 await env.DB.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind('dimensions-r2',e3.id).run()
 for(const account of ['dimensions-a1','dimensions-a3'])await env.DB.prepare('INSERT INTO candidate_bet_account_links(candidate_bet_id,account_id,created_at) VALUES(?,?,?)').bind(a.id,account,stamp).run()
 for(const e of [e1,e2])await link(e.id,a.id)
 for(const e of [e2,e4])await link(e.id,b.id)
 for(const candidate of [a,b])await link(e3.id,candidate.id,'contradicting')
 await link(e2.id,a.id)
 await json(request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'A',summary:'Updated approach',urgency:'Now',deliveryShape:'One small release',successMeasure:'Completion in ten seconds'}))
 const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect(brief).toMatchObject({evidenceCount:4,accountCount:3})
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.accounts.map(account=>account.id).sort()).toEqual(['dimensions-a1','dimensions-a2','dimensions-a3'])
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.evidence.map(item=>({id:item.id,wording:item.wording,stance:item.stance}))).toEqual([
  {id:e2.id,wording:'Independent supporting observation two',stance:'supporting'},
  {id:e3.id,wording:'Independent contradicting observation',stance:'contradicting'},
  {id:e1.id,wording:'Independent supporting observation one',stance:'supporting'},
 ])

 expect(brief.bets.find(candidate=>candidate.id===a.id)).toMatchObject({urgency:'Now',deliveryShape:'One small release',successMeasure:'Completion in ten seconds',metrics:{affectedRequesterCount:2,affectedAccountCount:3,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T10:00:00+10:00'}})
 expect(brief.bets.find(candidate=>candidate.id===b.id)?.metrics).toEqual({affectedRequesterCount:2,affectedAccountCount:2,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T00:30:00Z'})
 expect(brief.bets.find(candidate=>candidate.id===empty.id)?.metrics).toEqual({affectedRequesterCount:0,affectedAccountCount:0,supportingCount:0,contradictingCount:0,latestSupportAt:null})
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 const snapshots=(await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE decision_revision_id=?').bind(result.revisionId).all()).results
 expect(snapshots.find(candidate=>candidate.candidate_bet_id===a.id)).toMatchObject({affected_requester_count:2,affected_account_count:3,supporting_count:2,contradicting_count:1,latest_support_at:'2026-01-03T10:00:00+10:00',urgency:'Now',delivery_shape:'One small release',success_measure:'Completion in ten seconds'})
 expect(snapshots.find(candidate=>candidate.candidate_bet_id===empty.id)).toMatchObject({affected_requester_count:0,affected_account_count:0,supporting_count:0,contradicting_count:0,latest_support_at:null})
})
