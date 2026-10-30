import { applyD1Migrations, reset } from 'cloudflare:test'
import { expect, inject, it } from 'vitest'
import { env, owner, origin, call } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { pennyAgentDoor } from '@/core/features/agent-door'
import { pennyBusiness } from '@/core/features/agent-door/business'
import { accessToken, autonomousPolicy, policyEnvelope, signJws } from './agent-signing'

it('[BASE-AGENT-003 SURFACE-002] evidence resource readback uses native projection and current caller authority', async () => {
  await reset(); await applyD1Migrations(env.DB, inject('migrations'))
  const cookie = await owner()
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const key = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const signer = { issuer: 'https://synthetic-penny-1.invalid', installationId: 'synthetic-penny-1', kid: 'synthetic-penny-1', privateKey: pair.privateKey }
  const runtime = createPennyRuntime({ ...env, RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: key }) })
  const door = pennyAgentDoor(runtime), now = Math.floor(Date.now() / 1000)
  const post = (path: string, body: unknown, headers = {}) => new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const settings = await signJws(pair.privateKey, signer.kid, 'rer-business-settings+jwt', { v: 1, iss: signer.issuer, aud: origin, sub: signer.installationId, business: 'synthetic-penny-1', email: 'owner@penny.invalid', owner_id: 'synthetic-penny-owner', jti: crypto.randomUUID(), iat: now, exp: now + 300, rev: 1, values: {}, logo: null, team: null })
  const paired = await pennyBusiness(runtime).handle(post('/api/rer/business-settings', { settings }))
  expect(paired?.status, await paired?.clone().text()).toBe(200)
  const context = { signer, origin, business: 'synthetic-penny-1', revision: 0, seq: 0, person: { sub: 'synthetic-penny-owner', email: 'owner@penny.invalid' }, agentId: 'synthetic-penny-agent', surface: { specialist: 'feedback-triager', tools: [{ scope: 'evidence:write' }, { scope: 'evidence:read' }] }, consent: 'synthetic-penny-consent' }
  const { policy } = await policyEnvelope(context, autonomousPolicy())
  expect((await door.handle(post('/api/rer/agent-policy', { policy })))?.status).toBe(200)
  const token = await accessToken(context), narrow = await accessToken(context, { scope: 'evidence:write' })
  const rpc = async (method: string, params: unknown, credential = token) => {
    const response = await door.handle(post('/mcp', { jsonrpc: '2.0', id: crypto.randomUUID(), method, params }, { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', Authorization: `Bearer ${credential}` }))
    expect(response).not.toBeNull()
    const text = await response!.text()
    const body = JSON.parse(text.startsWith('data:') ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5) : text)
    return { status: response!.status, ...body }
  }
  const write = await rpc('tools/call', { name: 'penny.evidence.capture', arguments: { sourceType: 'free_text', sourceLabel: 'Synthetic interview', wording: 'A searchable feedback queue is needed.', observedAt: '2026-10-29T12:00:00Z', idempotency_key: crypto.randomUUID() } })
  const result = write.result?.structuredContent
  expect(result?.id, JSON.stringify(write)).toBeTruthy()
  const link = write.result.content.find((item: { type: string }) => item.type === 'resource_link')
  expect(link?.uri).toBeTruthy()
  const templates = await rpc('resources/templates/list', {})
  expect(templates.result.resourceTemplates.some((item: { uriTemplate: string }) => link.uri.startsWith(item.uriTemplate.split('{')[0]))).toBe(true)
  const read = await rpc('resources/read', { uri: link.uri })
  const record = JSON.parse(read.result.contents[0].text)
  const native = await (await call('/api/operator/evidence', undefined, cookie)).json() as { items: { id: string; wording: string }[] }
  expect(record).toMatchObject(native.items.find(item => item.id === result.id)!)
  expect(record.versions).toEqual(await (await call(`/api/operator/evidence/${result.id}/versions`, undefined, cookie)).json())
  expect(read.result.contents[0]._meta['com.runeditrun/untrusted']).toBe(true)
  const denied = await rpc('resources/read', { uri: link.uri }, narrow)
  expect(denied.status).toBe(403)
  expect(denied.error.data.code).toBe('insufficient_scope')
  expect(denied.result).toBeUndefined()
  const update = await rpc('tools/call', { name: 'penny.evidence.update', arguments: { id: result.id, operation: 'review', reason: 'Checked the source.', idempotency_key: crypto.randomUUID() } })
  expect(update.result.content.find((item: { type: string }) => item.type === 'resource_link').uri).toBe(link.uri)
  expect(JSON.parse((await rpc('resources/read', { uri: link.uri })).result.contents[0].text).reviewState).toBe('reviewed')
  const missing = await rpc('resources/read', { uri: 'penny://evidence/synthetic-penny-missing' })
  expect(missing.error.data.code).toBe('resource_unavailable')
  // Simulate current native membership changing while the signed token is still valid.
  await env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) SELECT 'synthetic-penny-backup-owner','backup@penny.invalid','Backup owner','owner','active',created_at FROM oa_operators WHERE email='owner@penny.invalid'").run()
  await env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE email='owner@penny.invalid'").run()
  const revoked = await rpc('resources/read', { uri: link.uri })
  expect(revoked.status).toBe(401)
  expect(revoked.result).toBeUndefined()
})
