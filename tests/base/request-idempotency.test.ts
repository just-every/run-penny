import {applyD1Migrations,reset} from 'cloudflare:test'
import {afterEach,beforeEach,expect,inject,it,vi} from 'vitest'
import {call,env,messages,mockMail,owner,requester} from './support'
import {explicitConsentBoard} from './explicit-consent-board'

// Snapshot complete business rows, including identities and timestamps, rather
// than just counts. Session renewal and admission counters are separate custody.
async function custody():Promise<Record<string,Record<string,unknown>[]>>{
 const tables=(await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND
  (name='requests' OR name GLOB 'request_*' OR name GLOB 'evidence_*'
   OR name='requester_update_permissions' OR name GLOB 'notification_*') ORDER BY name`).all<{name:string}>()).results
 const rows=await env.DB.batch(tables.map(({name})=>env.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)))
 const audit=await env.DB.prepare("SELECT * FROM audit_entries WHERE action='request.submitted' ORDER BY rowid").all()
 return {...Object.fromEntries(tables.map(({name},index)=>[name,rows[index].results])),submissionAudit:audit.results}
}

beforeEach(async()=>{
 await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2030-01-01T12:00:00.000Z'))
})
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()})

it('[REQ-013] native submission replay preserves its graph, rejects changed bodies and expires private reservations after 30 days',async()=>{
 const operator=await owner(),displayName='synthetic-penny-private-person-1'
 const email=['synthetic-penny-private-address-1','example.test'].join('@')
 const person=await requester(displayName,email)
 expect((await call('/api/operator/boards',{name:'Submission replay',slug:'replay',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('replay',(path,method,body)=>call(path,body,operator,method))
 const input={boardSlug:'replay',idempotencyKey:'synthetic-penny-private-key-1',title:'synthetic-penny-private-title-1',description:'synthetic-penny-private-description-1',proposedSolution:'synthetic-penny-private-solution-1',impactStatement:'synthetic-penny-private-impact-1',emailUpdates:true}
 const submit=(body=input,authority=person)=>call('/api/public/requests',body,authority)
 const initial=await submit();expect(initial.status,await initial.clone().text()).toBe(201)
 const result=await initial.json() as {slug:string;moderationState:string}
 expect(result.moderationState).toBe('awaiting_review')
 const context=await call(`/api/operator/requests/${result.slug}/context`,undefined,operator)
 expect(context.status).toBe(200)
 const {requestId,demand}=await context.json() as {requestId:string;demand:{evidenceCount:number}}
 expect(demand.evidenceCount).toBe(1)
 const original=await custody()
 expect(original.requests).toHaveLength(1)
 expect(original.request_content_submissions).toHaveLength(1)
 expect(original.evidence_items).toHaveLength(1)
 expect(original.evidence_versions).toHaveLength(1)
 expect(original.request_evidence_links).toEqual([expect.objectContaining({request_id:requestId,evidence_id:original.evidence_items[0].id})])
 expect(original.request_evidence_contributions).toHaveLength(1)
 expect(original.request_vote_contributions).toHaveLength(1)
 expect(original.request_follow_contributions).toHaveLength(1)
 expect(original.requester_update_permissions).toHaveLength(1)
 expect(original.submissionAudit).toHaveLength(1)
 const linked=async()=>{
  const response=await call(`/api/operator/evidence/${original.evidence_items[0].id}/links`,undefined,operator)
  expect(response.status).toBe(200)
  return response.json()
 }
 const links=await linked()
 expect(links).toEqual([expect.objectContaining({target:'request',targetId:requestId,label:input.title})])
 const [reservation]=original.request_submission_keys
 expect(reservation).toMatchObject({request_id:requestId,evidence_id:original.evidence_items[0].id,created_at:'2030-01-01T12:00:00.000Z',expires_at:'2030-01-31T12:00:00.000Z'})
 expect(reservation.key_hash).toMatch(/^[a-f0-9]{64}$/)
 expect(reservation.body_hash).toMatch(/^[a-f0-9]{64}$/)
 for(const marker of [input.idempotencyKey,email,displayName,input.title,input.description,input.proposedSolution,input.impactStatement])expect(JSON.stringify(reservation)).not.toContain(marker)

 const mailCount=messages.length
 for(let attempt=0;attempt<2;attempt++){
  const replay=await submit();expect(replay.status).toBe(201);expect(await replay.json()).toEqual(result)
  expect(await custody()).toEqual(original)
  const readback=await call(`/api/operator/requests/${result.slug}/context`,undefined,operator)
  expect(readback.status).toBe(200);expect(await readback.json()).toMatchObject({requestId,demand})
  expect(await linked()).toEqual(links)
 }
 const conflict=await submit({...input,description:'synthetic-penny-changed-description-1'})
 expect(conflict.status).toBe(409);expect(await conflict.json()).toMatchObject({error:'idempotency_conflict'})
 expect(await custody()).toEqual(original);expect(messages).toHaveLength(mailCount)

 // Obtain a second session through email verification near the deadline. Key
 // expiry must not be confused with the first session's own idle deadline.
 vi.setSystemTime(new Date('2030-01-31T11:00:00.000Z'))
 const fresh=await requester(displayName,email)
 expect((await call('/api/public/identity/session',undefined,fresh)).status).toBe(200)
 // Reverification refreshes the address's permission custody timestamp. Take
 // the replay baseline after that independent identity operation.
 const renewed=await custody()
 expect(renewed.request_submission_keys).toEqual(original.request_submission_keys)
 expect(renewed.requests).toEqual(original.requests)
 expect(renewed.evidence_items).toEqual(original.evidence_items)
 expect(renewed.evidence_versions).toEqual(original.evidence_versions)
 vi.setSystemTime(new Date('2030-01-31T11:59:59.999Z'))
 const retained=await submit(input,fresh);expect(retained.status).toBe(201);expect(await retained.json()).toEqual(result)
 expect(await custody()).toEqual(renewed)
 vi.setSystemTime(new Date('2030-01-31T12:00:00.000Z'))
 const expired=await submit(input,fresh);expect(expired.status,await expired.clone().text()).toBe(201)
 const replacement=await expired.json() as typeof result
 expect(replacement.slug).not.toBe(result.slug)
 const after=await custody()
 for(const table of ['requests','request_content_submissions','evidence_items','evidence_versions','request_evidence_links','request_evidence_contributions','request_vote_contributions','request_follow_contributions','requester_update_permissions','submissionAudit'])expect(after[table],table).toHaveLength(2)
 expect(after.requests).toContainEqual(original.requests[0])
 expect(after.evidence_items).toContainEqual(original.evidence_items[0])
 expect(after.evidence_versions).toContainEqual(original.evidence_versions[0])
 expect(after.request_submission_keys).toEqual([expect.objectContaining({key_hash:reservation.key_hash,created_at:'2030-01-31T12:00:00.000Z',expires_at:'2030-03-02T12:00:00.000Z'})])
 expect(after.request_submission_keys[0].request_id).not.toBe(requestId)
 expect(after.request_submission_keys[0].evidence_id).not.toBe(reservation.evidence_id)
 const newReplay=await submit(input,fresh);expect(newReplay.status).toBe(201);expect(await newReplay.json()).toEqual(replacement)
 expect(await custody()).toEqual(after)
})
