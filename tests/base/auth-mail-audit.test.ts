import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { call, env, owner, mockMail, messages } from './support'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB,inject('migrations')); mockMail() })
afterEach(() => vi.restoreAllMocks())
const identities = [
  {path:'/api/auth/magic-link',email:'owner@penny.invalid',feature:'operator_magic_link'},
  {path:'/api/public/identity/email',email:'audit-recipient@example.test',feature:'requester_verification'},
] as const
const input = (identity: typeof identities[number]) => identity.feature === 'requester_verification' ? {email:identity.email,displayName:'Audit recipient'} : {email:identity.email}
const attempts = async () => (await env.DB.prepare('SELECT * FROM penny_auth_mail_attempts ORDER BY rowid').all<{id:string;feature:string;outcome:string;phase:string;started_at:string;finished_at:string|null}>()).results

it('[BASE-OPS-005] ordinary identity routes claim before transport and retain accepted, failed and unknown outcomes',async () => {
  await owner()
  for (const identity of identities) {
    for (const outcome of ['accepted','failed','unknown'] as const) {
      const before = (await attempts()).length
      let sent = false
      vi.mocked(fetch).mockImplementationOnce(async () => {
        const rows = await attempts(), claim = rows.at(-1)!
        expect(rows).toHaveLength(before+1)
        expect(claim).toMatchObject({feature:identity.feature,outcome:'unknown',phase:'started',finished_at:null})
        expect(Number.isFinite(Date.parse(claim.started_at))).toBe(true)
        sent = true
        if (outcome === 'unknown') throw new Error('Network outcome lost')
        return new Response(null,{status:outcome === 'accepted' ? 202 : 400})
      })
      const response = await call(identity.path,input(identity))
      expect(response.status).toBe(outcome === 'accepted' ? 202 : 503)
      expect(sent).toBe(true)
      const rows = await attempts()
      expect(rows).toHaveLength(before+1)
      expect(rows.at(-1)).toMatchObject({feature:identity.feature,outcome,phase:'finished'})
      expect(Number.isFinite(Date.parse(rows.at(-1)!.finished_at!))).toBe(true)
    }
  }
  const prior = await attempts(), calls = vi.mocked(fetch).mock.calls.length
  expect((await call('/api/auth/magic-link',{email:'not-an-operator@example.test'})).status).toBe(202)
  expect(await attempts()).toEqual(prior)
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls)
  const serialized = JSON.stringify(prior)
  for (const identity of identities) expect(serialized).not.toContain(identity.email)
  expect(serialized).not.toContain('https:')
})

it('[BASE-OPS-005] failed claim blocks both send routes; failed receipt preserves unknown and refuses acceptance',async () => {
  await owner()
  await env.DB.exec("CREATE TRIGGER test_identity_claim_failure BEFORE INSERT ON penny_auth_mail_attempts BEGIN SELECT RAISE(ABORT,'test_audit_failure'); END")
  for (const identity of identities) expect((await call(identity.path,input(identity))).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
  expect(await attempts()).toEqual([])
  await env.DB.exec('DROP TRIGGER test_identity_claim_failure')
  await env.DB.exec("CREATE TRIGGER test_identity_receipt_failure BEFORE UPDATE ON penny_auth_mail_attempts BEGIN SELECT RAISE(ABORT,'test_audit_failure'); END")
  for (const identity of identities) expect((await call(identity.path,input(identity))).status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(identities.length)
  const rows = await attempts()
  expect(rows).toHaveLength(identities.length)
  for (const identity of identities) {
    const row = rows.find(attempt => attempt.feature === identity.feature)!
    expect(row).toBeDefined()
    expect(row).toMatchObject({outcome:'unknown',phase:'started',finished_at:null})
    const url = new URL(messages.find(message => message.to === identity.email)!.url)
    if (identity.feature === 'operator_magic_link') {
      expect((await call('/auth/confirm',{token:url.searchParams.get('token')})).status).toBe(400)
    } else {
      expect((await call('/api/public/identity/email/verify',{token:new URLSearchParams(url.hash.slice(1)).get('token')})).status).toBe(401)
    }
  }
})

it('[BASE-OPS-005 DATA-003] ordinary mail history survives token deletion and requester erasure without personal content',async () => {
  const operator = await owner()
  for (const identity of identities) expect((await call(identity.path,input(identity))).status).toBe(202)
  const url = new URL(messages.find(message => message.to === identities[1].email)!.url)
  expect((await call('/api/public/identity/email/verify',{token:new URLSearchParams(url.hash.slice(1)).get('token')})).status).toBe(200)
  const id = await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(identities[1].email).first<string>('requester_id')
  expect(id).toBeTruthy()
  const before = await attempts(), target = {table:'requesters',id}
  let response = await call('/api/operator/data/erasure/preview',target,operator)
  while (response.status === 202) {
    const {continuation} = await response.json() as {continuation:string}
    response = await call('/api/operator/data/erasure/preview',{...target,continuation},operator)
  }
  expect(response.status).toBe(200)
  const plan = await response.json() as {planHash:string;blockedCopies:unknown[]}
  expect(plan.blockedCopies).toEqual([])
  expect((await call('/api/operator/data/erasure',{...target,planHash:plan.planHash},operator)).status).toBe(200)
  expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(id).first()).toBeNull()
  expect(await env.DB.prepare('SELECT id FROM native_magic_links WHERE email=?').bind(identities[1].email).first()).toBeNull()
  await env.DB.prepare('DELETE FROM oa_tokens').run()
  expect(await attempts()).toEqual(before)
  for (const identity of identities) expect(JSON.stringify(before)).not.toContain(identity.email)
})
