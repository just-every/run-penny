import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, expect, inject, it } from 'vitest'
import type { OperatorDecisionBrief, OperatorEvidenceCard } from '../../../src/core/shared/api/operator'
import { seedLoop, request, json, evidence, decision, bet, link, commitInput } from './decision-loop-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})

it('[EVID-002][DEC-003][DEC-004] preserves and orders every accepted fractional precision in inbox, brief and committed comparison',async()=>{
 const d=await decision(),a=await bet(d.id);await bet(d.id,'Alternative')
 const observations=Array.from({length:9},(_,index)=>`2026-10-08T00:00:00.${'1'.repeat(index+1)}Z`),ids:string[]=[]
 for(const observedAt of observations){const e=await evidence({observedAt});ids.push(e.id);await link(e.id,a.id)}
 const inbox=await json<OperatorEvidenceCard[]>(request('/api/operator/evidence'))
 expect(inbox.filter(item=>ids.includes(item.id)).map(item=>item.observedAt)).toEqual([...observations].reverse())
 const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.metrics.latestSupportAt).toBe(observations[8])
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 expect(await env.DB.prepare('SELECT latest_support_at FROM decision_bet_snapshots WHERE decision_revision_id=? AND candidate_bet_id=?').bind(result.revisionId,a.id).first()).toEqual({latest_support_at:observations[8]})
})

it('[EVID-002][DEC-003][DEC-004][BASE-OPS-002] preserves legacy date-only and zone-free strings and resolves equal instants by evidence identity',async()=>{
 const d=await decision(),a=await bet(d.id);await bet(d.id,'Alternative')
 const records=[]
 for(const observedAt of ['2026-10-08','2026-10-08T00:00:00.099','2026-10-08T00:00:00.1Z','2026-10-08T09:00:00.100000000+09:00']){
  const e=await evidence();await env.DB.prepare('UPDATE evidence_items SET observed_at=? WHERE id=?').bind(observedAt,e.id).run();await link(e.id,a.id);records.push({id:e.id,observedAt})
 }
 const equal=records.slice(2).sort((left,right)=>left.id.localeCompare(right.id)),expected=[...equal,records[1],records[0]]
 const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.evidence.map(item=>({id:item.id,observedAt:item.observedAt}))).toEqual(expected.map(item=>({id:item.id,observedAt:item.observedAt})))
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 expect(await env.DB.prepare('SELECT latest_support_at FROM decision_bet_snapshots WHERE decision_revision_id=? AND candidate_bet_id=?').bind(result.revisionId,a.id).first()).toEqual({latest_support_at:equal[0].observedAt})
 for(const record of records)expect(await env.DB.prepare('SELECT observed_at FROM evidence_items WHERE id=?').bind(record.id).first()).toEqual({observed_at:record.observedAt})
})
