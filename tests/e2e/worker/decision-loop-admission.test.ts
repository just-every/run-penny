import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll, expect, inject, it } from 'vitest'
import type { OperatorDecisionBrief } from '../../../src/core/shared/api/operator'
import { commitDecision } from '../../../src/core/features/decisions/commit'
import { seedLoop, request, json, evidence, decision, bet, link, row, ready, commitInput, operatorId, stamp } from './decision-loop-fixture'

beforeAll(async () => { await applyD1Migrations(env.DB, inject('migrations')); await seedLoop() })

it('[DEC-001][DEC-004] whitespace-only questions stay draft when owner, candidate and evidence are present', async () => {
 const whitespace='\t\n\u00a0\u1680\u2000\u2028\u2029\u202f\u205f\u3000\ufeff'
 const d=await decision(whitespace),a=await bet(d.id),e=await evidence();await link(e.id,a.id)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 const response=await request(`/api/operator/decisions/${d.id}/commit`,'POST',{...commitInput(a.id),noViableAlternativeReason:'One available approach'})
 expect(response.status).toBe(422);expect(await response.text()).toContain('Question')
 expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toEqual([])
})

it('[DEC-001][DEC-004][DEC-005] whitespace question editing between commitment pre-read and its transaction cannot admit a blank commitment', async () => {
 const {d,a}=await ready()
 let intervened=false
 // This test delegates every SQL statement to the real Worker D1 binding. Its
 // only scheduling intervention is a real operator edit before commit's batch.
 const interleavedDb=new Proxy(env.DB,{
  get(target,key){
   if(key==='batch')return async(statements:D1PreparedStatement[])=>{
    if(!intervened){intervened=true;await json(request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'\t\n\u00a0',ownerOperatorId:operatorId}))}
    return target.batch(statements)
   }
   const value=Reflect.get(target,key)
   return typeof value==='function'?value.bind(target):value
  },
 })
 await expect(commitDecision(interleavedDb,d.id,{...commitInput(a.id),confidence:'medium'},operatorId,stamp)).rejects.toMatchObject({status:409})
 expect(intervened).toBe(true)
 expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
 for(const table of ['decision_revisions','roadmap_items'])expect((await env.DB.prepare(`SELECT * FROM ${table} WHERE decision_id=?`).bind(d.id).all()).results,table).toEqual([])
})

it('[EVID-002][DEC-003][DEC-004] live dimensions and atomic snapshots order all accepted fractional digits without changing provenance', async () => {
 const d=await decision(),a=await bet(d.id),b=await bet(d.id,'An alternative')
 const older='2026-10-08T00:00:00.000000001Z',newer='2026-10-08T00:00:00.000000002Z'
 const first=await evidence({observedAt:older}),second=await evidence({observedAt:newer})
 // Force the deterministic fallback order to oppose time order; otherwise an
 // accidentally favourable random ULID can conceal a collapsed timestamp key.
 const ordered=[first,second].sort((left,right)=>left.id.localeCompare(right.id))
 await env.DB.prepare('UPDATE evidence_items SET observed_at=? WHERE id=?').bind(older,ordered[0].id).run()
 await env.DB.prepare('UPDATE evidence_items SET observed_at=? WHERE id=?').bind(newer,ordered[1].id).run()
 for(const e of ordered)await link(e.id,a.id)
 const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.metrics.latestSupportAt).toBe(newer)
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.evidence.map(item=>item.observedAt)).toEqual([newer,older])
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 expect(await env.DB.prepare('SELECT latest_support_at FROM decision_bet_snapshots WHERE decision_revision_id=? AND candidate_bet_id=?').bind(result.revisionId,a.id).first()).toEqual({latest_support_at:newer})
 expect(await row('evidence_items',ordered[0].id)).toMatchObject({observed_at:older})
 expect(await row('evidence_items',ordered[1].id)).toMatchObject({observed_at:newer})
 expect(brief.bets.find(candidate=>candidate.id===b.id)?.metrics.latestSupportAt).toBeNull()
})

it('[EVID-002][DEC-003][DEC-004] fractional ordering carries whole-second and timezone boundaries while keeping exact supplied values', async () => {
 const d=await decision(),a=await bet(d.id);await bet(d.id,'Alternative')
 const observations=['2026-10-08T09:59:59.999999999+10:00','2026-10-08T00:00:00.000000001Z','2026-10-07T19:00:00.000000002-05:00']
 for(const observedAt of observations){const e=await evidence({observedAt});await link(e.id,a.id)}
 const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`))
 expect(brief.bets.find(candidate=>candidate.id===a.id)?.evidence.map(item=>item.observedAt)).toEqual([...observations].reverse())
 const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
 expect(await env.DB.prepare('SELECT latest_support_at FROM decision_bet_snapshots WHERE decision_revision_id=? AND candidate_bet_id=?').bind(result.revisionId,a.id).first()).toEqual({latest_support_at:observations[2]})
})
