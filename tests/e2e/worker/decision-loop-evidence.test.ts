import { digest } from '../../../src/core/features/auth/native-tokens'
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,describe,expect,inject,it } from 'vitest'
import { seedLoop,request,json,evidence,decision,bet,link,row,operatorId,stamp } from './decision-loop-fixture'
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'));await seedLoop()})
describe('Writable evidence',()=>{
 for(const sourceType of ['sales_call','support_conversation','interview','email','free_text'])it(`[EVID-001][EVID-002] records exact ${sourceType} provenance without inferred optionals`,async()=>{
  const wording='  Original\nwords stay exactly.  ',observedAt='2026-10-08T09:15:00+10:00',sourceLabel=sourceType==='free_text'?'  Forum note  ':null
  const e=await evidence({sourceType,wording,observedAt,sourceLabel});expect(await row('evidence_items',e.id)).toMatchObject({source_type:sourceType,source_label:sourceLabel,observed_at:observedAt,named_speaker:null,account_id:null,requester_id:null,recorded_by_operator_id:operatorId,review_state:'unreviewed'});expect(await row('evidence_versions',e.versionId)).toMatchObject({wording})
 })
 it('[EVID-002] accepts only an existing explicit account and stores named speaker exactly',async()=>{
  await env.DB.prepare('INSERT INTO accounts(id,slug,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind('evidence-account','evidence-account','Account private',stamp,stamp).run()
  const e=await evidence({accountId:'evidence-account',namedSpeaker:'  Alex (customer)  '});expect(await row('evidence_items',e.id)).toMatchObject({account_id:'evidence-account',named_speaker:'  Alex (customer)  '})
  for(const extra of [{accountId:'missing'},{accountId:''},{wording:'  '},{observedAt:'2026-02-31'},{observedAt:'2026-10-08'},{observedAt:'2026-10-08T09:15'},{sourceType:'free_text',sourceLabel:' '}]){const r=await request('/api/operator/evidence','POST',{sourceType:'email',wording:'Valid words',observedAt:stamp,...extra});expect([400,422]).toContain(r.status)}
 })
 it('[EVID-003][EVID-004][DEC-001] links and reverses request/bet stances without changing any evidence bytes, then reviews and reverses',async()=>{
  const e=await evidence(),d=await decision(),b=await bet(d.id),before=await row('evidence_items',e.id),version=await row('evidence_versions',e.versionId)
  const created=await json(request(`/api/operator/evidence/${e.id}/request`,'POST',{title:'Request from evidence',description:'User supplied problem',boardSlug:'loop-board'}),201)
  const target=created.requestId??created.id
  expect(target).toBeTruthy()
  for(const stance of ['supporting','contradicting']){await link(e.id,b.id,stance);await json(request(`/api/operator/evidence/${e.id}/links`,'PUT',{target:'request',targetId:target,stance}));expect(await row('evidence_items',e.id)).toEqual(before);expect(await row('evidence_versions',e.versionId)).toEqual(version)}
  expect(await row('decisions',d.id)).toMatchObject({state:'ready'})
  const queue=await json<Record<string,unknown>[]>(request('/api/operator/decisions'));expect(queue.find(item=>item.id===d.id)).toMatchObject({lastAction:'decision.evidence_changed',evidenceCount:1})
  await link(e.id,b.id,'supporting','DELETE');expect(await row('decisions',d.id)).toMatchObject({state:'draft'})
  await json(request(`/api/operator/evidence/${e.id}/links`,'DELETE',{target:'request',targetId:target}));expect(await row('evidence_items',e.id)).toEqual(before)
  expect((await request(`/api/operator/evidence/${e.id}/review`,'POST',{reviewed:true,reason:' '})).status).toBe(422)
  await json(request(`/api/operator/evidence/${e.id}/review`,'POST',{reviewed:true,reason:'Read and considered'}));expect(await row('evidence_items',e.id)).toMatchObject({review_state:'reviewed',review_reason:'Read and considered'})
  await json(request(`/api/operator/evidence/${e.id}/review`,'POST',{reviewed:false}));expect(await row('evidence_items',e.id)).toMatchObject({review_state:'unreviewed',review_reason:null});expect(await row('evidence_versions',e.versionId)).toEqual(version)
 })
 it('[EVID-003][EVID-004] creates a linked decision from original evidence',async()=>{const e=await evidence(),before=await row('evidence_items',e.id);const d=await json(request(`/api/operator/evidence/${e.id}/decision`,'POST',{question:'Which solution?',ownerOperatorId:operatorId,betTitle:'First approach',approach:'An explicit user-supplied approach'}),201);expect(await row('decisions',d.id)).toMatchObject({state:'ready'});expect(await row('evidence_items',e.id)).toEqual(before)})
 it('[EVID-003][BASE-AUTH-001][BASE-AUTH-003] refuses unauthenticated, invalid-session and cross-origin writes without mutation',async()=>{
  const before=await env.DB.prepare('SELECT COUNT(*) AS n FROM evidence_items').first()
  const refusals:Record<string,string>[]=[{Cookie:''},{Cookie:'penny_operator_session=invalid'},{Origin:'https://hostile.invalid'},{'Sec-Fetch-Site':'cross-site'}]
  for(const headers of refusals){const r=await request('/api/operator/evidence','POST',{sourceType:'email',wording:'Must not persist',observedAt:stamp},headers);expect([401,403]).toContain(r.status)}
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM evidence_items').first()).toEqual(before)
 })
})

it('[EVID-003][BASE-AUTH-001] a valid requester identity cannot record operator evidence',async()=>{
 await env.DB.prepare('INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES(?,?,?,?)').bind('non-operator','Requester only',stamp,stamp).run()
 await env.DB.prepare('INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('non-operator-address','non-operator','requester-only@example.invalid',stamp,stamp,stamp).run()
 await env.DB.prepare('INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('requester-session','non-operator','non-operator-address',await digest('r'.repeat(43)),'2099-01-01',stamp,stamp,stamp).run()
 const headers={Cookie:'',Authorization:'Bearer '+'r'.repeat(43)}
 expect((await request('/api/public/identity/session','GET',undefined,headers)).status).toBe(200)
 expect((await request('/api/operator/evidence','POST',{sourceType:'email',wording:'Not operator evidence',observedAt:stamp},headers)).status).toBe(401)
})
