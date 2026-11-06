import { expect } from 'vitest'
import { call, env, messages, origin } from './support'
import { createPennyRuntime } from '@/core/app/runtime'
import { pennyAgentDoor } from '@/core/features/agent-door'
import { pennyBusiness } from '@/core/features/agent-door/business'
import { accessToken, autonomousPolicy, policyEnvelope, signJws } from './agent-signing'

export async function json<T>(response: Promise<Response>, status = 200): Promise<T> {
  const result = await response
  expect(result.status, await result.clone().text()).toBe(status)
  return result.json() as Promise<T>
}
export async function signIn(email: string) {
  await json(call('/api/auth/magic-link', { email }), 202)
  const token = new URL(messages.findLast(message => message.to === email)!.url).searchParams.get('token')
  const response = await call('/auth/confirm', { token })
  expect(response.status).toBe(303)
  return { Cookie: response.headers.get('Set-Cookie')!.split(';')[0] }
}
export async function invite(cookie: { Cookie: string }, number: number) {
  const email = `synthetic-penny-${number}` + '@' + 'example.test'
  await json(call('/api/operator/settings/operators', { email }, cookie), 202)
  const token = new URL(messages.findLast(message => message.to === email)!.url).searchParams.get('token')
  const response = await call('/auth/confirm', { token })
  expect(response.status).toBe(303)
  const nativeId = (await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<string>('id'))!
  return { email, nativeId, cookie: { Cookie: response.headers.get('Set-Cookie')!.split(';')[0] } }
}

export async function agentCapture(email: string) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const key = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const signer = { issuer: 'https://synthetic-penny-1.invalid', installationId: 'synthetic-penny-1', kid: 'synthetic-penny-1', privateKey: pair.privateKey }
  const runtime = createPennyRuntime({ ...env, RER_OWNER_CLAIM_ISSUER: signer.issuer, RER_OWNER_CLAIM_INSTALLATION_ID: signer.installationId, RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify({ [signer.kid]: key }) })
  const door = pennyAgentDoor(runtime), now = Math.floor(Date.now() / 1000)
  const post = (path: string, body: unknown, headers = {}) => new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const settings = await signJws(pair.privateKey, signer.kid, 'rer-business-settings+jwt', { v: 1, iss: signer.issuer, aud: origin, sub: signer.installationId, business: 'synthetic-penny-1', email, owner_id: 'synthetic-penny-owner', jti: crypto.randomUUID(), iat: now, exp: now + 300, rev: 1, values: {}, logo: null, team: null })
  expect((await pennyBusiness(runtime).handle(post('/api/rer/business-settings', { settings })))?.status).toBe(200)
  const context = { signer, origin, business: 'synthetic-penny-1', person: { sub: 'synthetic-penny-owner', email }, agentId: 'synthetic-penny-agent', surface: { specialist: 'feedback-triager', tools: [{ scope: 'evidence:write' }] }, consent: 'synthetic-penny-consent' }
  const { policy } = await policyEnvelope(context, autonomousPolicy())
  expect((await door.handle(post('/api/rer/agent-policy', { policy })))?.status).toBe(200)
  const token = await accessToken(context)
  const response = await door.handle(post('/mcp', { jsonrpc: '2.0', id: 'synthetic-penny-1', method: 'tools/call', params: { name: 'penny.evidence.capture', arguments: { sourceType: 'free_text', sourceLabel: 'Synthetic capture', wording: 'synthetic-penny-private-agent-wording', observedAt: '2026-10-29T12:00:00Z', idempotency_key: crypto.randomUUID() } } }, { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', Authorization: `Bearer ${token}` }))
  expect(response?.status).toBe(200)
  const text = await response!.text()
  const result = JSON.parse(text.startsWith('data:') ? text.split('\n').find(line => line.startsWith('data:'))!.slice(5) : text)
  expect(result.result?.structuredContent?.id, text).toBeTruthy()
  return { id: context.agentId, evidenceId: result.result.structuredContent.id as string }
}

// Parse the downloaded bytes, including quoted multiline cells and doubled quotes.
export function csvRows(text: string): string[][] {
  const rows: string[][] = [], row: string[] = []
  let value = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const character = text[i]
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted
    } else if (!quoted && (character === ',' || character === '\r')) {
      row.push(value); value = ''
      if (character === '\r') { expect(text[++i]).toBe('\n'); rows.push([...row]); row.length = 0 }
    } else value += character
  }
  expect(quoted).toBe(false)
  expect(value).toBe('')
  return rows
}
