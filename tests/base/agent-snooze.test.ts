import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, expect, inject, it, vi } from 'vitest'
import { env, owner, origin, call, mockMail } from './support'
import { good, peer } from './ownership-fixture'
import { createPennyRuntime } from '@/core/app/runtime'
import { pennyAgentDoor } from '@/core/features/agent-door'
import { pennyBusiness } from '@/core/features/agent-door/business'
import { accessToken, autonomousPolicy, signJws } from './agent-signing'
import { document_sha256, validateDocument } from '../../base/modules/agent-door/policy/document.ts'
import type { AgingSummary } from '@/core/features/triage/reminders'

afterEach(() => vi.restoreAllMocks())

it('snoozes and clears native evidence equally through HTTP and MCP with standard policy, attributed approval, once-only replay and unchanged-state refusals', async () => {
  await reset(); mockMail(); await applyD1Migrations(env.DB, inject('migrations'))
  const cookie = await owner(), email = 'owner' + String.fromCharCode(64) + 'penny.invalid'
  const session = await good<{ operator: { id: string } }>('/auth/session', undefined, cookie)
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const key = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const signer = { issuer: 'https://synthetic-penny-1.invalid', installationId: 'synthetic-penny-1', kid: 'synthetic-penny-1', privateKey: pair.privateKey }
  const runtime = createPennyRuntime({ ...env, RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: key }) })
  const door = pennyAgentDoor(runtime), business = 'synthetic-penny-1'
  const post = (path: string, body: unknown, headers = {}) => new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const seconds = () => Math.floor(Date.now() / 1000)
  const settings = await signJws(pair.privateKey, signer.kid, 'rer-business-settings+jwt', { v: 1, iss: signer.issuer, aud: origin, sub: signer.installationId, business, email, owner_id: 'synthetic-penny-owner', jti: crypto.randomUUID(), iat: seconds(), exp: seconds() + 300, rev: 1, values: {}, logo: null, team: null })
  expect((await pennyBusiness(runtime).handle(post('/api/rer/business-settings', { settings })))?.status).toBe(200)
  const context = { signer, origin, business, person: { sub: 'synthetic-penny-owner', email }, agentId: 'synthetic-penny-agent', surface: { specialist: 'feedback-triager', tools: [{ scope: 'evidence:write' }, { scope: 'evidence:read' }] }, consent: 'synthetic-penny-consent' }
  let seq = 0
  const adopt = async (document: unknown, consents: string[] = []) => {
    const revision = ++seq
    const revision_signature = await signJws(pair.privateKey, signer.kid, 'rer-agent-policy-revision+jwt', { business, revision, document_sha256: await document_sha256(validateDocument(document)) })
    const policy = await signJws(pair.privateKey, signer.kid, 'rer-agent-policy+jwt', { v: 1, iss: signer.issuer, aud: origin, sub: signer.installationId, business, seq, revision, paused: false, catalogue: 'rer-agent-classes/1', document, revision_signature, revoked: { agents: [], consents }, iat: seconds(), exp: seconds() + 300 })
    expect((await door.handle(post('/api/rer/agent-policy', { policy })))?.status).toBe(200)
  }
  await adopt(autonomousPolicy())
  const token = await accessToken(context), narrow = await accessToken(context, { scope: 'evidence:read' })
  const rpc = async (args: Record<string, unknown>, credential = token) => {
    const response = await door.handle(post('/mcp', { jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name: 'penny.evidence.update', arguments: args } }, { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', Authorization: `Bearer ${credential}` }))
    expect(response).not.toBeNull()
    const text = await response!.text()
    const body = JSON.parse(text.startsWith('data:') ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5) : text)
    return { status: response!.status, ...body }
  }
  const code = (answer: Awaited<ReturnType<typeof rpc>>) => answer.result?._meta?.['com.runeditrun/error']?.code ?? answer.error?.data?.code
  const standard = (answer: Awaited<ReturnType<typeof rpc>>, disposition: string) => {
    expect(answer.result._meta['com.runeditrun/decision']).toMatchObject({ disposition, classes: [{ class: 'standard', facts: { measure: 1 } }] })
    expect(answer.result._meta['com.runeditrun/decision'].classes).toHaveLength(1)
  }
  const args = (id: string, operation: string, extra = {}) => ({ id, operation, ...extra, idempotency_key: crypto.randomUUID() })
  const capture = () => good<{ id: string }>('/api/operator/evidence', { sourceType: 'free_text', sourceLabel: 'Synthetic triage', wording: 'Synthetic feedback needing follow-up.', observedAt: new Date().toISOString() }, cookie, 'POST', 201)
  const http = await capture(), mcp = await capture()
  const actor = await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(email).first<string>('id')
  expect(actor).toBeTruthy()
  expect(http.id).not.toBe(mcp.id)
  const until = new Date(Date.now() + 7 * 86400000).toISOString(), offset = until.replace('Z', '+00:00')
  const summary = () => good<AgingSummary>('/api/operator/triage', undefined, cookie)
  const activity = () => env.DB.prepare("SELECT * FROM audit_entries WHERE action IN ('triage.snoozed','triage.unsnoozed') ORDER BY id").all()
  const snapshot = async () => (await env.DB.batch(['penny_evidence_snoozes','evidence_items','evidence_versions'].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))).map(result => result.results).concat([(await activity()).results])
  await good(`/api/operator/triage/evidence/${http.id}/snooze`, { until: offset }, cookie, 'PATCH')
  const snooze = args(mcp.id, 'snooze', { until: offset }), done = await rpc(snooze)
  expect(done.result.structuredContent).toEqual({ id: mcp.id, ok: true }); standard(done, 'autonomous')
  expect((await summary()).snoozed.map(({ id, untilAt }) => ({ id, untilAt })).sort((a, b) => a.id.localeCompare(b.id))).toEqual([http.id, mcp.id].sort().map(id => ({ id, untilAt: until })))
  const audits = (await activity()).results
  expect(audits.find(row => row.entity_id === http.id)).toMatchObject({ actor_type: 'operator', actor_id: actor, agent_id: null, action: 'triage.snoozed' })
  expect(audits.find(row => row.entity_id === mcp.id)).toMatchObject({ actor_type: 'operator', actor_id: actor, agent_id: context.agentId, sponsor_native_id: session.operator.id, action: 'triage.snoozed' })
  expect(String(audits.find(row => row.entity_id === mcp.id)!.prepared_by)).toContain(' for ')
  const beforeReplay = await snapshot()
  expect((await rpc(snooze)).result.structuredContent).toEqual(done.result.structuredContent)
  expect(await snapshot()).toEqual(beforeReplay)
  await good(`/api/operator/triage/evidence/${http.id}/snooze`, { until: null }, cookie, 'PATCH')
  const clear = args(mcp.id, 'unsnooze'), cleared = await rpc(clear)
  expect(cleared.result.structuredContent).toEqual({ id: mcp.id, ok: true }); standard(cleared, 'autonomous')
  expect((await summary()).snoozed).toEqual([])
  const clearedState = await snapshot()
  await rpc(snooze); await rpc(clear)
  expect(await snapshot()).toEqual(clearedState)
  expect((await summary()).snoozed).toEqual([])

  const past = new Date(Date.now() - 86400000).toISOString()
  for (const [value, expected] of [[past, 'snooze_must_be_future'], ['invalid-time', 'validation_failed']] as const) {
    const before = await snapshot()
    const refused = await call(`/api/operator/triage/evidence/${http.id}/snooze`, { until: value }, cookie, 'PATCH')
    expect(refused.status).toBe(400); expect(await refused.json()).toEqual({ error: expected })
    expect(code(await rpc(args(mcp.id, 'snooze', { until: value })))).toBe(value === past ? expected : 'invalid_arguments')
    expect(await snapshot()).toEqual(before)
  }
  const beforeRefusals = await snapshot()
  expect(code(await rpc(args(mcp.id, 'snooze')))).toBe('invalid_arguments')
  for (const operation of ['snooze', 'unsnooze']) {
    const absent = await call('/api/operator/triage/evidence/synthetic-penny-missing/snooze', { until: operation === 'snooze' ? until : null }, cookie, 'PATCH')
    expect(absent.status).toBe(404)
    expect(code(await rpc(args('synthetic-penny-missing', operation, { until })))).toBe('resource_unavailable')
    expect(code(await rpc(args(mcp.id, operation, { until }), narrow))).toBe('insufficient_scope')
  }
  expect(await snapshot()).toEqual(beforeRefusals)
  const personPost = async (path: string, body: unknown) => {
    const response = await door.handle(post(path, body, cookie))
    expect(response?.status, await response?.clone().text()).toBe(200)
    return response!.json() as Promise<Record<string, any>>
  }
  await personPost('/agents/api/pause', { paused: true })
  expect(code(await rpc(snooze))).toBe('agents_paused')
  expect(code(await rpc(args(mcp.id, 'unsnooze')))).toBe('agents_paused')
  expect(await snapshot()).toEqual(beforeRefusals)
  await personPost('/agents/api/pause', { paused: false })

  await adopt({ ...autonomousPolicy(), rules: [{ id: 'held', class: '*', do: 'approval', approver: ['person:synthetic-penny-owner'], wait: 'P1D' }] })
  for (const operation of ['snooze', 'unsnooze']) {
    const before = await snapshot(), input = args(mcp.id, operation, { until }), pending = await rpc(input)
    expect(code(pending)).toBe('approval_required'); standard(pending, 'approval')
    expect(await snapshot()).toEqual(before)
    const approvalId = pending.result._meta['com.runeditrun/error'].approval.id
    const response = await door.handle(new Request(origin + '/agents/api/approvals/' + approvalId, { headers: cookie }))
    expect(response?.status).toBe(200)
    const { approval } = await response!.json() as { approval: { revision: number; summary_sha256: string } }
    await personPost('/agents/api/approvals/' + approvalId + '/approve', { revision: approval.revision, summary_sha256: approval.summary_sha256 })
    const completed = await rpc(input)
    expect(completed.result.structuredContent).toEqual({ id: mcp.id, ok: true }); standard(completed, 'approval')
    expect((await summary()).snoozed.map(({ id, untilAt }) => ({ id, untilAt }))).toEqual(operation === 'snooze' ? [{ id: mcp.id, untilAt: until }] : [])
    const latest = (await activity()).results.filter(row => row.entity_id === mcp.id && row.action === (operation === 'snooze' ? 'triage.snoozed' : 'triage.unsnoozed')).at(-1)!
    expect(latest).toMatchObject({ actor_id: actor, agent_id: context.agentId, sponsor_native_id: session.operator.id })
    expect(JSON.parse(String(latest.approvers_json))).toEqual([expect.objectContaining({ id: session.operator.id })])
    const after = await snapshot(); await rpc(input); expect(await snapshot()).toEqual(after)
  }
  await adopt(autonomousPolicy(), [context.consent])
  const final = await snapshot()
  expect(code(await rpc(snooze))).toBe('unauthenticated')
  expect(code(await rpc(args(mcp.id, 'unsnooze')))).toBe('unauthenticated')
  expect(await snapshot()).toEqual(final)
  const freshToken = await accessToken({ ...context, consent: 'synthetic-penny-2' })
  expect((await rpc(args(mcp.id, 'unsnooze'), freshToken)).result.structuredContent).toEqual({ id: mcp.id, ok: true })
  await personPost('/agents/api/agents/' + context.agentId + '/revoke', {})
  const revokedState = await snapshot()
  expect(code(await rpc(args(mcp.id, 'snooze', { until }), freshToken))).toBe('unauthenticated')
  expect(await snapshot()).toEqual(revokedState)
  const doorRows = (await env.DB.prepare("SELECT row FROM agent_door_audit WHERE json_extract(row,'$.tool')='penny.evidence.update'").all<{ row: string }>()).results.map(row => JSON.parse(row.row))
  expect(doorRows.some(row => row.decision === 'autonomous' && row.outcome === 'done')).toBe(true)
  expect(doorRows.some(row => row.decision === 'approval' && row.outcome === 'pending')).toBe(true)
  expect(doorRows.filter(row => row.classes?.length).every(row => row.classes.length === 1 && row.classes[0].class === 'standard')).toBe(true)
  const successor = await peer(cookie, 'synthetic-penny-2' + String.fromCharCode(64) + 'example.test')
  const liveToken = await accessToken({ ...context, agentId: 'synthetic-penny-2', consent: 'synthetic-penny-2' })
  expect((await rpc(args(mcp.id, 'snooze', { until }), liveToken)).result.structuredContent).toEqual({ id: mcp.id, ok: true })
  await good('/api/operator/settings/operators/' + session.operator.id, { successorId: successor.nativeId }, cookie, 'DELETE')
  const removed = await snapshot()
  expect((await rpc(args(mcp.id, 'unsnooze'), liveToken)).status).toBe(401)
  expect((await call(`/api/operator/triage/evidence/${http.id}/snooze`, { until }, cookie, 'PATCH')).status).toBe(401)
  expect(await snapshot()).toEqual(removed)
})
