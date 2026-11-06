import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, expect, inject, it, vi } from 'vitest'
import { Validator, type Schema as JsonSchema } from '@cfworker/json-schema'
import { call, env } from './support'
import { releaseGraph } from './release-fixture'

type Schema = Record<string, unknown>
type Operation = {
  operationId: string; security: Record<string, string[]>[]; 'x-required-scopes': string[]
  parameters: { name: string; in: string; required?: boolean; schema: Schema }[]
  requestBody?: { content: { 'application/json': { schema: { $ref: string } } } }
  responses: Record<string, { content: { 'application/json': { schema: { $ref: string } } } }>
}
type Document = {
  openapi: string; servers: { url: string }[]; paths: Record<string, Record<string, Operation>>
  components: { schemas: Record<string, Schema>; securitySchemes: Record<string, { type: string; scheme: string }> }
}
afterEach(() => vi.restoreAllMocks())

it('[DATA-006] serves an offline OpenAPI contract and reconciles every documented operation with native allowed and unchanged-state refusal journeys', async () => {
  await reset(); await applyD1Migrations(env.DB, inject('migrations'))
  const g = await releaseGraph(1)
  expect((await call('/api/operator/boards/regression/categories', { name: 'synthetic-penny-category' }, g.operator)).status).toBe(201)
  const documentResponse = await call('/docs/openapi.json')
  expect(documentResponse.status).toBe(200)
  expect(documentResponse.headers.get('Content-Type')).toContain('application/json')
  expect(documentResponse.headers.get('Set-Cookie')).toBeNull()
  const document = await documentResponse.json() as Document
  expect(document.openapi).toMatch(/^3\.1\./)
  expect(document.servers).toEqual([{ url: '/' }])
  const schemaFor = (ref: string) => {
    expect(ref).toMatch(/^#\/components\/schemas\/[A-Za-z]+$/)
    const schema = document.components.schemas[ref.split('/').at(-1)!]
    expect(schema).toBeDefined()
    return schema
  }
  const validates = (schema: Schema, value: unknown, expected = true) => {
    const result = new Validator(schema as JsonSchema, '2020-12', false).validate(value)
    expect(result.valid, JSON.stringify(result.errors)).toBe(expected)
  }
  const issue = async (scopes: string[]) => {
    const response = await call('/api/operator/integrations/keys', { name: 'synthetic-penny-1', scopes }, g.operator)
    expect(response.status).toBe(201)
    const { token } = await response.json() as { token: string }
    return { Authorization: 'Bearer ' + token }
  }
  // Retain the earlier native publication journey here, within the same API
  // contract flow, so the broader proof replaces its registration.
  const issued = { headers: await issue(['requests:read', 'requests:write', 'comments:read', 'comments:write', 'status:read', 'status:write', 'releases:read', 'releases:write']) }
 const slug=g.requests[0].slug
 const publicationSnapshot=async()=>({requests:await env.DB.prepare('SELECT count(*) n FROM requests').first('n'),comments:await env.DB.prepare('SELECT count(*) n FROM request_comments').first('n'),updates:await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n'),permissions:await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')})
 const before=await publicationSnapshot()
 expect((await call('/api/v1/requests/'+slug+'/comments',{body:'Comment without approval'},issued.headers)).status).toBe(400)
 expect((await call('/api/v1/requests',{title:'New',description:'Body',boardSlug:'missing'},issued.headers)).status).toBe(404)
 expect((await call('/api/v1/requests',{title:'New',description:'Body',boardSlug:'regression',resource:'releases'},issued.headers)).status).toBe(400)
 expect(await publicationSnapshot()).toEqual(before)
 expect((await call('/api/v1/requests/'+slug+'/comments',{body:'Approved safe comment',approve:true},issued.headers)).status).toBe(201)
 const action={status:'under_review',body:'Approved public update',pinned:false,idempotencyKey:'native-api-update',approve:true}
 expect((await call('/api/v1/requests/'+slug+'/status-updates',action,issued.headers)).status).toBe(200)
 expect((await call('/api/v1/requests/'+slug+'/status-updates',action,issued.headers)).status).toBe(200)
 expect((await call('/api/v1/requests/'+slug+'/status-updates',{...action,body:'Different'},issued.headers)).status).toBe(409)
 expect(await env.DB.prepare('SELECT count(*) n FROM request_status_updates').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(before.permissions)
 const publicText=await (await call('/api/v1/requests/'+slug,undefined,issued.headers)).text()
 expect(publicText).toContain('Approved safe comment');expect(publicText).toContain('Approved public update');expect(publicText).not.toContain(g.recipient.email)
 expect((await call('/api/v1/releases/missing/publish',{approve:true},issued.headers)).status).toBe(404)
 const fresh=await call('/api/v1/requests',{title:'Private unreviewed wording',description:'Private context',boardSlug:'regression'},issued.headers)
 expect(fresh.status).toBe(201)
 expect(await (await call('/api/v1/requests',undefined,issued.headers)).text()).not.toContain('Private unreviewed wording')
  const scopes = [...new Set(Object.values(document.paths).flatMap(methods => Object.values(methods).flatMap(op => op['x-required-scopes'])))]
  const allowed = await issue(scopes), readOnly = await issue(['requests:read']), releaseOnly = await issue(['releases:read'])
  const snapshot = async () => (await env.DB.batch([
    'requests', 'request_comments', 'request_status_updates', 'request_vote_contributions', 'request_votes',
    'penny_proxy_votes', 'requesters', 'requester_addresses', 'requester_update_permissions',
    'releases', 'release_versions', 'release_recipient_snapshots', 'notification_outbox', 'audit_entries',
  ].map(table => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)))).map(result => result.results)
  const requestSlug = g.requests[0].slug
  let releaseSlug = '', proxyId = ''
  const { authorOperatorId: _author, ...releaseInput } = g.input
  const cases: Record<string, () => { slug?: string; query?: string; body?: unknown }> = {
    listBoards: () => ({}),
    listRequests: () => ({ query: '?board=regression&q=Public&sort=recent' }),
    createRequest: () => ({ body: { title: 'synthetic-penny-held', description: 'Held integration wording', boardSlug: 'regression' } }),
    getRequest: () => ({ slug: requestSlug }),
    listComments: () => ({ slug: requestSlug }),
    createComment: () => ({ slug: requestSlug, body: { body: 'synthetic-penny-comment', approve: true } }),
    listStatusUpdates: () => ({ slug: requestSlug }),
    publishStatus: () => ({ slug: requestSlug, body: { status: 'under_review', body: 'synthetic-penny-status', pinned: true, idempotencyKey: 'synthetic-penny-1', approve: true } }),
    findProxyContacts: () => ({ query: '?q=synthetic-penny-contact' }),
    recordProxyVote: () => ({ slug: requestSlug, body: { contact: { displayName: 'synthetic-penny-contact' }, source: 'synthetic-penny-source' } }),
    listReleases: () => ({}),
    createRelease: () => ({ body: { ...releaseInput, title: 'synthetic-penny-release' } }),
    getRelease: () => ({ slug: releaseSlug }),
    publishRelease: () => ({ slug: releaseSlug, body: { approve: true } }),
  }
  const order = ['createRequest', 'createComment', 'publishStatus', 'recordProxyVote', 'createRelease', 'publishRelease']
  const operations = Object.entries(document.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), operation })))
  expect(operations.map(({ operation }) => operation.operationId).sort()).toEqual(Object.keys(cases).sort())
  operations.sort((a, b) => {
    const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length
    return rank(a.operation.operationId) - rank(b.operation.operationId)
  })
  for (const { path, method, operation } of operations) {
    const input = cases[operation.operationId](), url = path.replace('{slug}', input.slug ?? '') + (input.query ?? '')
    const securityName = Object.keys(operation.security[0])[0]
    expect(document.components.securitySchemes[securityName]).toMatchObject({ type: 'http', scheme: 'bearer' })
    const wrongScope = operation['x-required-scopes'][0] === 'requests:read' ? releaseOnly : readOnly
    const before = await snapshot()
    for (const headers of [{}, wrongScope]) {
      const denied = await call(url, input.body, headers, method)
      expect(denied.status, operation.operationId + ' authority').toBe(401)
      validates(schemaFor(operation.responses[String(denied.status)].content['application/json'].schema.$ref), await denied.json())
      expect(await snapshot()).toEqual(before)
    }
    // Lists without filters have no invalid parameter. An unsupported method is
    // their invalid HTTP case; the contract does not invent query validation.
    const invalidUrl = operation.requestBody ? url : input.slug ? path.replace('{slug}', 'INVALID') : operation.operationId === 'findProxyContacts' ? path + '?q=' + 'x'.repeat(201) : operation.operationId === 'listRequests' ? path + '?sort=invalid' : url
    const invalidMethod = !operation.requestBody && invalidUrl === url ? 'PUT' : method
    const invalid = await call(invalidUrl, operation.requestBody ? {} : undefined, allowed, invalidMethod)
    expect(invalid.status, operation.operationId + ' invalid').toBe(invalidMethod === 'PUT' ? 404 : 400)
    validates(schemaFor(operation.responses[String(invalid.status)].content['application/json'].schema.$ref), await invalid.json())
    expect(await snapshot()).toEqual(before)
    for (const parameter of operation.parameters) {
      const value = parameter.in === 'path' ? input.slug : new URL('https://penny.test' + url).searchParams.get(parameter.name)
      if (value !== null && value !== undefined) validates(parameter.schema, value)
      else expect(parameter.required).not.toBe(true)
    }
    if (operation.requestBody) {
      const schema = schemaFor(operation.requestBody.content['application/json'].schema.$ref)
      validates(schema, input.body); validates(schema, {}, false)
    }
    const response = await call(url, input.body, allowed, method)
    expect(response.status, operation.operationId + ': ' + await response.clone().text()).toBe(method === 'POST' && ['createRequest', 'createComment', 'createRelease'].includes(operation.operationId) ? 201 : 200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    const result = await response.json() as Record<string, unknown>
    validates(schemaFor(operation.responses[String(response.status)].content['application/json'].schema.$ref), result)
    if (operation.operationId === 'createRelease') releaseSlug = String(result.slug)
    if (operation.operationId === 'recordProxyVote') { proxyId = String(result.requesterId); expect(result.created).toBe(true) }
    if (Array.isArray(result)) expect(result.length, operation.operationId + ' populated response').toBeGreaterThan(0)
    if (operation.operationId === 'getRequest') {
      expect(result).toMatchObject({ kind: 'found', request: { slug: requestSlug } })
      const detail = result.request as { comments: { body: string }[]; statusUpdates: { body: string; pinned: number }[] }
      expect(detail.comments).toContainEqual(expect.objectContaining({ body: 'synthetic-penny-comment' }))
      expect(detail.statusUpdates).toContainEqual(expect.objectContaining({ body: 'synthetic-penny-status', pinned: 1 }))
    }
    if (operation.operationId === 'getRelease') expect(result).toMatchObject({ slug: releaseSlug, title: 'synthetic-penny-release', body: releaseInput.body, isCurrent: true })
    if (operation.operationId === 'findProxyContacts') expect(result).toEqual([{ id: proxyId, displayName: 'synthetic-penny-contact', email: null }])
  }
  // Published projection, consent and namespace boundaries survive the document route.
  const listing = await (await call('/api/v1/requests', undefined, allowed)).text()
  expect(listing).not.toContain('synthetic-penny-held')
  expect(await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE requester_id=?').bind(proxyId).first()).toBeNull()
  expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions WHERE requester_id=?').bind(proxyId).first('n')).toBe(0)
  for (const path of ['/api/v1/unknown', '/docs/openapi-unknown.json']) expect((await call(path)).status).toBe(404)
  expect((await call('/docs')).status).toBe(200)
  expect((await call('/api/operator/requests', undefined, allowed)).status).toBe(401)
  const beforeOriginRefusal = await snapshot()
  expect((await call('/api/v1/requests', { title: 'refused', description: 'refused', boardSlug: 'regression' }, { ...allowed, Origin: 'https://other.test' })).status).toBe(403)
  expect(await snapshot()).toEqual(beforeOriginRefusal)
})
