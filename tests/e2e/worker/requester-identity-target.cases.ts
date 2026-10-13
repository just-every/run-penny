import { expect, it } from 'vitest'
import { RequestOperatorRepository } from '../../../src/core/features/requests/operator-repository'
import { auth, boardGraph, call, change, env, pauseBeforeBatch, person } from './requester-final-fixture'

const mergeIdentity = (source:string,target:string,headers:Record<string,string>) => call(`/api/operator/requesters/${source}/merge`,{targetRequesterId:target},headers)
const identitySnapshot = async () => {
  const tables=['requesters','requester_addresses','native_requester_sessions','requester_identity_merges','request_votes','request_follows','request_vote_contributions','request_follow_contributions','requester_update_permissions','request_comments','request_content_submissions','audit_entries']
  return Promise.all(tables.map(async table=>(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))
}

it('[REQ-024] rejects retired merge endpoints without stranding addresses or old and new native sessions', async () => {
  const f=await boardGraph(1), [r]=f.requests, a=await person(),b=await person(),c=await person()
  await change(r.slug,'vote',c.token,{emailUpdates:true})
  expect((await mergeIdentity(a.id,b.id,f.headers)).status).toBe(200)
  const before=await identitySnapshot()
  for(const [source,target] of [[c.id,a.id],[a.id,b.id],[b.id,a.id]]) {
    const response=await mergeIdentity(source,target,f.headers)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({error:'identity_merge_changed'})
    expect(await identitySnapshot()).toEqual(before)
  }
  await change(r.slug,'vote',c.token)
  expect((await call('/api/public/identity/email',{email:c.email,displayName:'Returning requester'})).status).toBe(202)
  const link=(await env.DB.prepare("SELECT token FROM local_auth_outbox WHERE recipient=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(c.email).first<{token:string}>())!.token
  const fresh=await (await call('/api/public/identity/email/verify',{token:link})).json() as {token:string}
  await change(r.slug,'vote',fresh.token)
  expect((await mergeIdentity(c.id,b.id,f.headers)).status).toBe(200)
  const d=await person()
  expect((await mergeIdentity(b.id,d.id,f.headers)).status).toBe(200)
  for(const p of [a,b,c,d,{...c,token:fresh.token}]) {
    expect((await call('/api/public/identity/session',undefined,auth(p.token))).status).toBe(200)
    await change(r.slug,'vote',p.token)
  }
  expect((await env.DB.prepare('SELECT DISTINCT requester_id FROM native_requester_sessions WHERE requester_id IN (?,?,?)').bind(a.id,b.id,c.id).all()).results).toEqual([])
  expect((await env.DB.prepare('SELECT requester_id FROM request_votes WHERE request_id=?').bind(r.id).all()).results).toEqual([{requester_id:d.id}])
  expect((await env.DB.prepare('SELECT id FROM requester_update_permissions').all()).results).toHaveLength(1)
  expect((await env.DB.prepare('SELECT * FROM native_requester_sessions s JOIN requester_addresses a ON a.id=s.address_id WHERE s.requester_id!=a.requester_id').all()).results).toEqual([])
})

for (const race of ['target-retires','source-retires','reverse-merge'] as const)
it(`[REQ-024] ${race} between endpoint reads and batch atomically refuses the stale merge`,async()=>{
  const f=await boardGraph(1), a=await person(),b=await person(),c=await person(),now=new Date().toISOString()
  const regular=new RequestOperatorRepository({binding:env.DB})
  let afterOther:unknown
  const db=pauseBeforeBatch(async()=>{
    if(race==='target-retires')await regular.mergeRequesters(b.id,c.id,f.operator,now)
    if(race==='source-retires')await regular.mergeRequesters(a.id,c.id,f.operator,now)
    if(race==='reverse-merge')await regular.mergeRequesters(b.id,a.id,f.operator,now)
    afterOther=await identitySnapshot()
  })
  await expect(new RequestOperatorRepository({binding:db}).mergeRequesters(a.id,b.id,f.operator,now)).rejects.toMatchObject({status:409,code:'identity_merge_changed'})
  expect(await identitySnapshot()).toEqual(afterOther)
  for(const p of [a,b,c])await change(f.requests[0].slug,'vote',p.token)
  expect((await env.DB.prepare('SELECT * FROM requester_write_guards').all()).results).toEqual([])
})

it('[REQ-024] opposite simultaneous HTTP merges leave exactly one active survivor with usable sessions',async()=>{
  const f=await boardGraph(1),a=await person(),b=await person()
  const responses=await Promise.all([mergeIdentity(a.id,b.id,f.headers),mergeIdentity(b.id,a.id,f.headers)])
  expect(responses.map(r=>r.status).sort()).toEqual([200,409])
  expect((await env.DB.prepare('SELECT * FROM requester_identity_merges').all()).results).toHaveLength(1)
  for(const p of [a,b])await change(f.requests[0].slug,'vote',p.token)
  expect((await env.DB.prepare('SELECT * FROM request_votes').all()).results).toHaveLength(1)
  expect((await env.DB.prepare('SELECT * FROM requester_write_guards').all()).results).toEqual([])
})

it('[REQ-024] a late merge failure rolls back its guard, lineage, sessions and contributions',async()=>{
  const f=await boardGraph(1),a=await person(),b=await person()
  await change(f.requests[0].slug,'vote',a.token,{emailUpdates:true})
  const before=await identitySnapshot()
  await env.DB.prepare("CREATE TRIGGER fail_identity_merge_audit BEFORE INSERT ON audit_entries WHEN NEW.action='requester.merged' BEGIN SELECT RAISE(ABORT,'injected_merge_audit_failure'); END").run()
  try {
    await expect(new RequestOperatorRepository({binding:env.DB}).mergeRequesters(a.id,b.id,f.operator,new Date().toISOString())).rejects.toThrow('injected_merge_audit_failure')
    expect(await identitySnapshot()).toEqual(before)
    expect((await env.DB.prepare('SELECT * FROM requester_write_guards').all()).results).toEqual([])
  } finally { await env.DB.prepare('DROP TRIGGER fail_identity_merge_audit').run() }
})
