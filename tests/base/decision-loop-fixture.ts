import { exports } from 'cloudflare:workers'
import { createPennyApp } from '../../src/core/app/worker'
import { createUlid } from '../../src/core/shared/ulid'
import { env, origin, owner } from './support'

export { env }
export const stamp = '2026-10-08T00:00:00.000Z'
export const operatorId = 'loop-operator', boardId = 'loop-board'
let cookie = ''
const app = createPennyApp({ runtimeConfiguration: {
 operatorAllowlist: ['owner@penny.invalid'], workspaceTimezone: 'Australia/Brisbane', publicOriginAllowlist: [origin],
} })

export async function seedLoop() {
 await env.DB.prepare('INSERT OR IGNORE INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)')
  .bind(operatorId, 'owner@penny.invalid', 'Loop owner', stamp, stamp).run()
 await env.DB.prepare('INSERT OR IGNORE INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
  .bind(boardId, 'loop-board', 'Loop board', 'public', 0, stamp, stamp).run()
 cookie = (await owner()).Cookie
}

export async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
 return app.fetch(new Request(origin + path, {
  method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
 }), env)
}
export function document(path: string) {
 return exports.default.fetch(new Request(origin + path, { headers: { Accept: 'text/html', Cookie: cookie } }))
}
export async function json<T = Record<string, string>>(response: Promise<Response>, status = 200): Promise<T> {
 const result = await response
 if (result.status !== status) throw new Error(`Expected ${status}, got ${result.status}: ${await result.text()}`)
 return result.json() as Promise<T>
}
export function evidence(extra: Record<string, unknown> = {}) {
 return json(request('/api/operator/evidence', 'POST', { sourceType: 'interview', wording: 'Original evidence ' + createUlid(), observedAt: stamp, ...extra }), 201)
}
export function decision(question = 'Which approach solves the problem?') {
 return json(request('/api/operator/decisions', 'POST', { question, ownerOperatorId: operatorId }), 201)
}
export function bet(id: string, title = 'Candidate approach') {
 return json(request(`/api/operator/decisions/${id}/bets`, 'POST', { title, summary: 'A concrete approach', urgency: 'This quarter', deliveryShape: 'Small release', successMeasure: 'Completion time below 30 seconds' }), 201)
}
export function link(evidenceId: string, betId: string, stance = 'supporting', method = 'PUT') {
 return json(request(`/api/operator/evidence/${evidenceId}/links`, method, { target: 'bet', targetId: betId, stance }))
}
export function commitInput(selected: string) {
 return { selectedCandidateBetId: selected, rationale: 'Measured choice', ownerOperatorId: operatorId, confidence: 'medium', reviewAt: '2026-12-01' }
}
export async function ready() {
 const d = await decision(), a = await bet(d.id, 'Approach A'), b = await bet(d.id, 'Approach B'), e = await evidence()
 await link(e.id, a.id)
 return { d, a, b, e }
}
export async function committed() {
 const data = await ready()
 const result = await json<{ itemId: string; revisionId: string; slug: string }>(request(`/api/operator/decisions/${data.d.id}/commit`, 'POST', commitInput(data.a.id)))
 return { ...data, ...result }
}
export async function publicRequest() {
 const id = createUlid(), slug = `request-${id.toLowerCase()}`
 await env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,public_title,public_description,published_at,created_at,updated_at) VALUES(?,?,?,'Safe request','Safe problem','approved','open','Safe request','Safe problem',?,?,?)")
  .bind(id, slug, boardId, stamp, stamp, stamp).run()
 return { id, slug }
}
export function approve(itemId: string, requestIds: string[] = []) {
 return json(request(`/api/operator/roadmap/${itemId}/approve`, 'POST', { publicTitle: 'Safe roadmap title', publicSummary: 'Safe roadmap problem', boardSlug: 'loop-board', requestIds }))
}
export function row(table: string, id: string) {
 return env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first()
}
