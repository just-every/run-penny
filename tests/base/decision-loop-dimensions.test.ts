import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, expect, inject, it } from 'vitest'
import type { OperatorDecisionBrief } from '../../src/core/shared/api/operator'
import { seedLoop, request, json, evidence, bet, link, row, commitInput, operatorId, stamp } from './decision-loop-fixture'

beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')); await seedLoop() })

it('[DEC-001][DEC-002] retains confidence and review-date edits on the same brief while requiring question, owner, a bet and linked evidence for readiness', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:'',confidence:'low',reviewAt:'2026-11-12'}),201)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft',owner_operator_id:null})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'',owner:null,confidence:'low',reviewAt:'2026-11-12',bets:[]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:null,confidence:'medium',reviewAt:'2026-12-03'}))
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'Which approach?',owner:null,confidence:'medium',reviewAt:'2026-12-03',state:'draft'})
 const a=await bet(d.id),e=await evidence();await link(e.id,a.id)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId,confidence:'high',reviewAt:'2027-01-14'}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'Which approach?',owner:{id:operatorId},confidence:'high',reviewAt:'2027-01-14',evidenceCount:1,bets:[{id:a.id}]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'',ownerOperatorId:operatorId,confidence:'high',reviewAt:null}))
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 expect(await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))).toMatchObject({id:d.id,slug:d.slug,question:'',owner:{id:operatorId},confidence:'high',reviewAt:null,evidenceCount:1,bets:[{id:a.id}]})
 await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'Which approach?',ownerOperatorId:operatorId}))
 expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
 await link(e.id,a.id,'supporting','DELETE')
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
})

it('[DEC-003][DEC-004] compares distinct stored relations, null provenance, shared evidence and offset instants without summing duplicate accounts', async () => {
 const d=await json(request('/api/operator/decisions','POST',{question:'Compare the evidence',ownerOperatorId:operatorId}),201),a=await bet(d.id,'A'),b=await bet(d.id,'B'),empty=await bet(d.id,'No support yet')
 for(const id of ['dimensions-a1','dimensions-a2','dimensions-a3'])await env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,id,id,stamp,stamp).run()
 for(const id of ['dimensions-r1','dimensions-r2'])await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind(id,id,stamp,stamp).run()
 const e1=await evidence({accountId:'dimensions-a1',observedAt:'2026-01-01T00:00:00Z'}),e2=await evidence({accountId:'dimensions-a1',observedAt:'2026-01-03T10:00:00+10:00'}),e3=await evidence({accountId:'dimensions-a2',observedAt:'2026-01-02T00:00:00Z'}),e4=await evidence({observedAt:'2026-01-03T00:30:00Z'})
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
 expect(brief.bets.find(candidate=>candidate.id===a.id)).toMatchObject({urgency:'Now',deliveryShape:'One small release',successMeasure:'Completion in ten seconds',metrics:{affectedRequesterCount:2,affectedAccountCount:3,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T10:00:00+10:00'}})
 expect(brief.bets.find(candidate=>candidate.id===b.id)?.metrics).toEqual({affectedRequesterCount:2,affectedAccountCount:2,supportingCount:2,contradictingCount:1,latestSupportAt:'2026-01-03T00:30:00Z'})
 expect(brief.bets.find(candidate=>candidate.id===empty.id)?.metrics).toEqual({affectedRequesterCount:0,affectedAccountCount:0,supportingCount:0,contradictingCount:0,latestSupportAt:null})
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 const snapshots=(await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE decision_revision_id=?').bind(result.revisionId).all()).results
 expect(snapshots.find(candidate=>candidate.candidate_bet_id===a.id)).toMatchObject({affected_requester_count:2,affected_account_count:3,supporting_count:2,contradicting_count:1,latest_support_at:'2026-01-03T10:00:00+10:00',urgency:'Now',delivery_shape:'One small release',success_measure:'Completion in ten seconds'})
 expect(snapshots.find(candidate=>candidate.candidate_bet_id===empty.id)).toMatchObject({affected_requester_count:0,affected_account_count:0,supporting_count:0,contradicting_count:0,latest_support_at:null})
})
