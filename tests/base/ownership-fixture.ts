import { expect } from 'vitest'
import { call, env, messages } from './support'
import type { OwnershipCatalog, OwnershipQueue } from '../../src/core/features/ownership/types'

export type Cookie = { Cookie: string }
export async function good<T = Record<string, string>>(path: string, body?: unknown, headers: Record<string, string> = {}, method = body === undefined ? 'GET' : 'POST', expected: number | number[] = 200): Promise<T> {
 const result = await call(path, body, headers, method)
 expect(Array.isArray(expected) ? expected : [expected], await result.clone().text()).toContain(result.status)
 return result.json() as Promise<T>
}
export const catalog = (cookie: Cookie) => good<OwnershipCatalog>('/api/operator/ownership/catalog', undefined, cookie)
export const queue = (cookie: Cookie) => good<OwnershipQueue>('/api/operator/ownership/queue', undefined, cookie)
export const assign = (entity: 'boards' | 'requests' | 'evidence', id: string, operatorId: string | null, cookie: Cookie) => good(`/api/operator/ownership/${entity}/${id}`, { operatorId }, cookie, 'PATCH')
export async function peer(cookie: Cookie, email = 'assigned-peer@example.test') {
 await good('/api/operator/settings/operators', { email }, cookie, 'POST', 202)
 const token = new URL(messages.findLast(message => message.to === email)!.url).searchParams.get('token')!
 const response = await call('/auth/confirm', { token })
 expect(response.status).toBe(303)
 const admitted = { Cookie: response.headers.get('Set-Cookie')!.split(';')[0] }
 const native = await good<{ operators: { id: string; email: string }[] }>('/api/operator/settings/operators', undefined, admitted)
 await catalog(admitted)
 const id = await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind(email).first<string>('id')
 expect(id).toBeTruthy()
 return { cookie: admitted, id: id!, nativeId: native.operators.find(operator => operator.email === email)!.id }
}
export async function capture(cookie: Cookie, boardSlug: string, title = 'Assigned customer request') {
 const request = await good<{ id: string; slug: string }>('/api/operator/requests', { title, description: 'Private customer context', boardSlug }, cookie, 'POST', 201)
 const evidence = await good<{ id: string }>('/api/operator/evidence', { sourceType: 'interview', wording: 'A customer needs this workflow', observedAt: '2026-10-18T00:00:00Z', boardSlug }, cookie, 'POST', 201)
 return { request, evidence }
}
