import { expect,it } from 'vitest'
import { assertWinner,call,env,moderationFixture,pauseBeforeBatch,repairDatabase,subjects, type Verdict } from './moderation-winner-fixture'
repairDatabase()
for(const type of subjects)for(const [stale,winner] of [['rejected','approved'],['approved','rejected'],['approved','approved'],['rejected','rejected']] as [Verdict,Verdict][])
it(`[REQ-020 REQ-030] ${type}: ${winner} wins before paused ${stale}, with one verdict and chosen notice`,async()=>{
  const f=await moderationFixture(type)
  const db=pauseBeforeBatch(async()=>{expect((await call(f.path,f.input(winner),f.headers)).status).toBe(200)})
  await expect(f.decide(db,stale)).rejects.toMatchObject({code:type.endsWith('_edit')?'not_found':'moderation_conflict'})
  await assertWinner(f,winner)
  expect((await call(f.path,f.input(winner),f.headers)).status).toBe(type.endsWith('_edit')?404:409)
  await assertWinner(f,winner)
})
for(const type of subjects)for(const verdict of ['approved','rejected'] as const)
it(`[REQ-030 DATA-001] ${type} ${verdict} rolls back public content, verdict and notice on late audit failure`,async()=>{
  const f=await moderationFixture(type)
  const tables=[f.table,'requests','request_comments','request_content_submissions','request_comment_edits','request_moderation_events','notification_outbox','audit_entries']
  const snapshot=async()=>Promise.all(tables.map(async table=>(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))
  const before=await snapshot()
  await env.DB.prepare("CREATE TRIGGER fail_moderation_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.moderated' BEGIN SELECT RAISE(ABORT,'forced_moderation_audit_failure'); END").run()
  try{await expect(f.decide(env.DB,verdict)).rejects.toThrow('forced_moderation_audit_failure');expect(await snapshot()).toEqual(before)}
  finally{await env.DB.prepare('DROP TRIGGER fail_moderation_audit').run()}
  expect((await call(f.path,f.input(verdict),f.headers)).status).toBe(200)
  await assertWinner(f,verdict)
})

for(const type of subjects.filter(type=>type!=='attachment'))
it(`[REQ-019 REQ-030] ${type} rejection records its verdict but queues no internal-board notice`,async()=>{
  const f=await moderationFixture(type)
  await env.DB.prepare("UPDATE boards SET visibility='internal' WHERE slug=?").bind(f.board).run()
  expect((await call(f.path,{...f.input('rejected'),reason:'Private internal rationale'},f.headers)).status).toBe(200)
  expect((await env.DB.prepare('SELECT verdict FROM request_moderation_events WHERE subject_type=? AND subject_id=?').bind(type,f.id).all()).results).toEqual([{verdict:'rejected'}])
  expect((await env.DB.prepare('SELECT id FROM notification_outbox WHERE subject_id=?').bind(f.id).all()).results).toEqual([])
  expect((await call(`/api/public/requests/${f.r.slug}`)).status).toBe(404)
})

for(const type of ['request_edit','comment_edit'] as const)
it(`[REQ-030] ${type} reopened after a competing rejection cannot reuse the previous pending selection`,async()=>{
  const f=await moderationFixture(type)
  const db=pauseBeforeBatch(async()=>{
    expect((await call(f.path,f.input('rejected'),f.headers)).status).toBe(200)
    const appeal=await call(`/api/public/requests/${f.r.slug}/appeals`,{subjectType:type,subjectId:f.id,body:'Additional context'}, {Authorization:`Bearer ${f.owner.token}`})
    expect(appeal.status).toBe(201)
    const row=(await env.DB.prepare('SELECT id FROM request_moderation_appeals WHERE subject_id=?').bind(f.id).first<{id:string}>())!
    expect((await call(`/api/operator/appeals/${row.id}/review`,{resolution:'reopen',reason:'Review new context'},f.headers)).status).toBe(200)
  })
  await expect(f.decide(db,'approved')).rejects.toMatchObject({code:'not_found',status:404})
  expect((await env.DB.prepare('SELECT verdict FROM request_moderation_events WHERE subject_id=?').bind(f.id).all()).results).toEqual([{verdict:'rejected'}])
  expect(await env.DB.prepare(`SELECT moderation_state FROM ${f.table} WHERE id=?`).bind(f.id).first()).toEqual({moderation_state:'awaiting_review'})
  expect((await env.DB.prepare('SELECT id FROM notification_outbox WHERE subject_id=?').bind(f.id).all()).results).toHaveLength(1)
  const response=await call(`/api/public/requests/${f.r.slug}`)
  const text=await response.text();expect(text).not.toContain('Winning revision')
  expect((await call(f.path,f.input('approved'),f.headers)).status).toBe(200)
  expect((await env.DB.prepare('SELECT verdict FROM request_moderation_events WHERE subject_id=? ORDER BY rowid').bind(f.id).all()).results).toEqual([{verdict:'rejected'},{verdict:'approved'}])
  expect(await (await call(`/api/public/requests/${f.r.slug}`)).text()).toContain('Winning revision')
})
