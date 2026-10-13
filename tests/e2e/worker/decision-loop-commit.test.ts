import type { OperatorPage } from '../../../src/core/features/workspace/list-query'
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,describe,expect,inject,it } from 'vitest'
import type { OperatorDecisionBrief } from '../../../src/core/shared/api/operator'
import { seedLoop,request,json,evidence,decision,bet,link,row,ready,commitInput,operatorId,stamp } from './decision-loop-fixture'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})
const snapshots=async(id:string)=>(await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE decision_revision_id=? ORDER BY candidate_bet_id').bind(id).all()).results
describe('Accountable commitment',()=>{
 it('[DEC-001][DEC-003][DEC-004][DEC-005] derives hand-computable dimensions and immutable current-version snapshots',async()=>{
  const {d,a,b,e}=await ready()
  await env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind('metric-account','metric-account','Metric account',stamp,stamp).run()
  await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind('metric-requester','Metric requester',stamp,stamp).run()
  await env.DB.prepare('UPDATE evidence_items SET account_id=?,requester_id=?,observed_at=? WHERE id=?').bind('metric-account','metric-requester','2026-10-08T10:00:00+10:00',e.id).run()
  const latest=await evidence({accountId:'metric-account',observedAt:'2026-10-08T00:30:00Z'}),counter=await evidence({accountId:'metric-account'})
  await env.DB.prepare('UPDATE evidence_items SET requester_id=? WHERE id=?').bind('metric-requester',latest.id).run()
  await link(latest.id,a.id);await link(counter.id,a.id,'contradicting');await link(e.id,b.id)
  const version='metric-current-version';await env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at) VALUES(?,?,2,?,?,?,?)').bind(version,e.id,'Latest original wording',operatorId,stamp,stamp).run()
  const brief=await json<OperatorDecisionBrief>(request(`/api/operator/decisions/${d.slug}`));expect(brief).toMatchObject({state:'ready',evidenceCount:3,accountCount:1});expect(brief.bets.find(item=>item.id===a.id)?.metrics).toEqual({supportingCount:2,contradictingCount:1,affectedAccountCount:1,affectedRequesterCount:1,latestSupportAt:'2026-10-08T00:30:00Z'})
  const evidenceBefore=await row('evidence_items',e.id),versionBefore=await row('evidence_versions',version)
  const result=await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)))
  expect(await row('decisions',d.id)).toMatchObject({state:'committed',selected_candidate_bet_id:a.id});expect(await row('roadmap_items',result.itemId)).toMatchObject({status:'planned',candidate_bet_id:a.id})
  const before=await snapshots(result.revisionId);expect(before).toHaveLength(2);expect(before.find(s=>s.candidate_bet_id===a.id)).toMatchObject({disposition:'selected',supporting_count:2,contradicting_count:1,affected_account_count:1,affected_requester_count:1,latest_support_at:'2026-10-08T00:30:00Z',urgency:'This quarter',delivery_shape:'Small release',success_measure:'Completion time below 30 seconds'});expect(before.find(s=>s.candidate_bet_id===b.id)).toMatchObject({disposition:'declined'})
  expect((await env.DB.prepare('SELECT evidence_version_id FROM decision_evidence_snapshots WHERE decision_revision_id=? AND evidence_id=?').bind(result.revisionId,e.id).all()).results.every(s=>s.evidence_version_id===version)).toBe(true)
  await env.DB.prepare('INSERT INTO evidence_versions(id,evidence_id,version_number,wording,edited_by_operator_id,created_at,updated_at) VALUES(?,?,3,?,?,?,?)').bind('post-commit-version',e.id,'Later wording version',operatorId,stamp,stamp).run();
  expect((await env.DB.prepare('SELECT evidence_version_id FROM decision_evidence_snapshots WHERE decision_revision_id=? AND evidence_id=?').bind(result.revisionId,e.id).all()).results.every(s=>s.evidence_version_id===version)).toBe(true)
  await link(e.id,a.id,'supporting','DELETE');await link(latest.id,b.id,'contradicting');expect(await snapshots(result.revisionId)).toEqual(before);expect(await row('evidence_items',e.id)).toEqual(evidenceBefore);expect(await row('evidence_versions',version)).toEqual(versionBefore);expect(await row('decisions',d.id)).toMatchObject({state:'committed'})
  await env.DB.prepare("UPDATE decisions SET state='review_due' WHERE id=?").bind(d.id).run();await link(counter.id,a.id,'supporting','DELETE');expect(await row('decisions',d.id)).toMatchObject({state:'review_due'})
 })
 for(const [field,label] of [['selectedCandidateBetId','Selected bet'],['rationale','Rationale'],['ownerOperatorId','Owner'],['confidence','Confidence'],['reviewAt','Review date']])it(`[DEC-004] names missing ${label} and makes no mutations`,async()=>{
  const {d,a}=await ready(),input:Record<string,unknown>=commitInput(a.id);delete input[field];const before=await row('decisions',d.id);const response=await request(`/api/operator/decisions/${d.id}/commit`,'POST',input);expect(response.status).toBe(422);expect(await response.text()).toContain(label);expect(await row('decisions',d.id)).toEqual(before);expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toEqual([])
 })
 it('[DEC-004] requires a viable-alternative explanation for one bet, rejects foreign choices and invalid dates',async()=>{
  const d=await decision(),a=await bet(d.id),e=await evidence();await link(e.id,a.id)
  const input=commitInput(a.id);const response=await request(`/api/operator/decisions/${d.id}/commit`,'POST',input);expect(response.status).toBe(422);expect(await response.text()).toContain('No viable alternative reason')
  for(const change of [{reviewAt:'2026-02-31'},{selectedCandidateBetId:'foreign'},{ownerOperatorId:'unknown'}])expect((await request(`/api/operator/decisions/${d.id}/commit`,'POST',{...input,noViableAlternativeReason:'Only workable approach',...change})).status).toBe(422)
  await json(request(`/api/operator/decisions/${d.id}/commit`,'POST',{...input,noViableAlternativeReason:'Only workable approach'}))
 })
 it('[DEC-005] late failure rolls back revision, snapshots, item, state and activity',async()=>{
  const {d,a}=await ready(),before=await row('decisions',d.id),auditBefore=(await env.DB.prepare('SELECT * FROM audit_entries WHERE entity_id=? ORDER BY id').bind(d.id).all()).results
  await env.DB.exec("CREATE TRIGGER test_commit_failure BEFORE INSERT ON audit_entries WHEN NEW.action='decision.committed' BEGIN SELECT RAISE(ABORT,'injected late failure'); END")
  try{expect((await request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id))).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER test_commit_failure')}
  expect(await row('decisions',d.id)).toEqual(before);expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toEqual([]);expect((await env.DB.prepare('SELECT * FROM roadmap_items WHERE decision_id=?').bind(d.id).all()).results).toEqual([]);expect((await env.DB.prepare('SELECT * FROM decision_bet_snapshots WHERE candidate_bet_id IN (?,?)').bind(a.id,(await env.DB.prepare('SELECT id FROM candidate_bets WHERE decision_id=? AND id!=?').bind(d.id,a.id).first<{id:string}>())!.id).all()).results).toEqual([]);expect((await env.DB.prepare('SELECT * FROM audit_entries WHERE entity_id=? ORDER BY id').bind(d.id).all()).results).toEqual(auditBefore)
 })
 it('[DEC-004][DEC-005] serializes duplicate/conflicting commits, leaves declined items byte-identical, and prevents stale bet edits',async()=>{
  const {d,a,b}=await ready();const itemId='declined-'+b.id
  await env.DB.prepare("INSERT INTO roadmap_items(id,slug,decision_id,candidate_bet_id,title,summary,status,delivery_notes,created_at,updated_at) VALUES(?,?,?,?,?,?,'shipped','Keep every column',?,?)").bind(itemId,itemId,d.id,b.id,'Declined internal','Do not rewrite',stamp,stamp).run();const declined=await row('roadmap_items',itemId)
  const responses=await Promise.all([request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)),request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id))]);expect(responses.map(r=>r.status)).toEqual([200,200]);expect(await responses[0].json()).toEqual(await responses[1].json());expect(await row('roadmap_items',itemId)).toEqual(declined)
  expect((await request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(b.id))).status).toBe(409);expect((await request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'Changed',summary:'Changed'})).status).toBe(409)
  expect((await env.DB.prepare('SELECT id FROM roadmap_items WHERE candidate_bet_id=?').bind(a.id).all()).results).toHaveLength(1)
 })
 it('[DEC-001][DEC-005] concurrent edit and evidence relink produce one coherent stored snapshot',async()=>{
  const {d,a,e}=await ready()
  const results=await Promise.all([request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)),request(`/api/operator/decisions/${d.id}/bets/${a.id}`,'PATCH',{title:'Current approach',summary:'Current summary'}),request(`/api/operator/evidence/${e.id}/links`,'DELETE',{target:'bet',targetId:a.id})])
  expect([200,409,422]).toContain(results[0].status);expect([200,409]).toContain(results[1].status);expect(results[2].status).toBe(200)
  if(results[0].status===200){const result=await results[0].json() as {revisionId:string;itemId:string};const snapshot=(await snapshots(result.revisionId)).find(s=>s.candidate_bet_id===a.id)!;expect(await row('roadmap_items',result.itemId)).toMatchObject({title:snapshot.title,summary:snapshot.summary});expect((await env.DB.prepare('SELECT * FROM decision_evidence_snapshots WHERE decision_revision_id=?').bind(result.revisionId).all()).results.length).toBeGreaterThan(0)}else expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toHaveLength(0)
 })
})

it('[DEC-001] queue retains all states with distinct evidence, owner and latest action',async()=>{
 const draft=await decision('Draft without evidence'),r=await ready(),c=await ready(),review=await ready()
 await json(request(`/api/operator/decisions/${c.d.id}/commit`,'POST',commitInput(c.a.id)))
 await env.DB.prepare("UPDATE decisions SET state='review_due' WHERE id=?").bind(review.d.id).run()
 await link(r.e.id,r.b.id)
 const list=await json<OperatorPage<OperatorDecisionBrief>>(request('/api/operator/decisions'))
 for(const [id,state] of [[draft.id,'draft'],[r.d.id,'ready'],[c.d.id,'committed'],[review.d.id,'review_due']])expect(list.items.find(d=>d.id===id)).toMatchObject({state,owner:{id:operatorId}})
 expect(list.items.find(d=>d.id===r.d.id)).toMatchObject({evidenceCount:1,lastAction:'decision.evidence_changed'})
})

it('[DEC-001][DEC-004][DEC-005] a concurrent blank-question edit cannot create a committed blank brief',async()=>{
 const {d,a}=await ready();const results=await Promise.all([request(`/api/operator/decisions/${d.id}/commit`,'POST',commitInput(a.id)),request(`/api/operator/decisions/${d.id}`,'PATCH',{question:'',ownerOperatorId:operatorId})]);expect([200,409,422]).toContain(results[0].status);expect([200,409]).toContain(results[1].status)
 const current=await row('decisions',d.id);if(current!.state==='committed')expect(current!.question).toBe('Which approach solves the problem?');else {expect(current!.state).toBe('draft');expect((await env.DB.prepare('SELECT * FROM decision_revisions WHERE decision_id=?').bind(d.id).all()).results).toHaveLength(0)}
})
