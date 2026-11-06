import { z } from 'zod'
import { publicRequestFiltersSchema } from '../../portal/routes'
import { proxyVoteSchema } from '../../requests/proxy-votes'
import { apiScopes } from '../keys'
import { createIntegrationRequest, integrationApproval, integrationComment, integrationRelease, integrationSlug, integrationStatus } from './inputs'
import { releaseResponses, responses } from './responses'

type Schema = Record<string, unknown>
const jsonSchema = (schema: z.ZodType): Schema => {
  const { $schema: _dialect, ...result } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  return result
}
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name })
const content = (name: string) => ({ 'application/json': { schema: ref(name) } })
const inputs = {
  CreateRequest: createIntegrationRequest, CreateComment: integrationComment,
  PublishStatus: integrationStatus, CreateRelease: integrationRelease,
  Approval: integrationApproval, RecordProxyVote: proxyVoteSchema,
}
const schemas: Record<string, Schema> = Object.fromEntries(Object.entries({ ...inputs, ...responses, ...releaseResponses }).map(([name, schema]) => [name, jsonSchema(schema)]))
// These cross-field and URL refinements cannot be emitted by Zod's JSON Schema converter.
const createProperties = schemas.CreateRequest.properties as Record<string, Schema>
createProperties.evidenceIds.uniqueItems = true
const releaseProperties = schemas.CreateRelease.properties as Record<string, Schema>
releaseProperties.publicationDate.format = 'date'
releaseProperties.setupUrl = { anyOf: [{ const: '' }, { type: 'string', format: 'uri', pattern: '^https?://' }] }
const proxyProperties = schemas.RecordProxyVote.properties as Record<string, Schema>
proxyProperties.sourceUrl.pattern = '^[Hh][Tt][Tt][Pp][Ss]?:'
proxyProperties.sourceUrl.not = { pattern: '^[Hh][Tt][Tt][Pp][Ss]?://[^/?#]*@' }
schemas.RecordProxyVote.oneOf = [
  { required: ['requesterId'], not: { required: ['contact'] } },
  { required: ['contact'], not: { required: ['requesterId'] } },
]
schemas.RecordProxyVote.description = 'Select exactly one active requesterId or new contact. A source URL uses HTTP or HTTPS without embedded credentials. Importance requires the board setting. No identity verification or email permission is granted.'
schemas.CreateRequest.description = 'Evidence identifiers must be distinct and exist. Creates held wording awaiting native moderation; this operation does not publish it.'
schemas.CreateRelease.description = 'A valid calendar publication date is required. Setup URL is empty or HTTP or HTTPS. Tags must exist; targets must have current approved request mappings. Creates a draft attributed to the key issuer.'
schemas.PublishStatus.description = 'Explicit approval and an idempotency key are required. Repeating the same action reuses its result; changed wording under that key is refused. ETA is a month or quarter.'

type Scope = typeof apiScopes[number]
type Parameter = { name: string; in: 'path' | 'query'; required?: boolean; schema: Schema; description?: string }
const slug: Parameter = { name: 'slug', in: 'path', required: true, schema: jsonSchema(integrationSlug) }
function operation(operationId: string, summary: string, scope: Scope, output: string, status = 200, input?: keyof typeof inputs, parameters: Parameter[] = []) {
  const projection = operationId === 'findProxyContacts' ? 'Customer lookup returns private active contact choices; keep this votes:write key on the server.' : 'Request, board and release reads expose approved public projections.'
  return {
    operationId, summary, security: [{ integrationKey: [] }], 'x-required-scopes': [scope],
    description: `Requires a current installation key with ${scope}. Missing, expired, revoked and insufficient-scope keys all return 401. Origin, when supplied, must match this installation; cross-site requests are refused. ${projection}`,
    parameters,
    ...(input ? { requestBody: { required: true, description: 'JSON body, at most 32 KiB. Text fields are trimmed before validation; unknown fields are refused.', content: content(input) } } : {}),
    responses: {
      [status]: { description: 'Successful native operation.', content: content(output) },
      '400': { description: 'Invalid body, path or supported query. Empty request-list query values are ignored.', content: content('Error') },
      '401': { description: 'Key absent, invalid, expired, revoked, lacking the required scope or without a current issuer.', content: content('Error') },
      '403': { description: 'Origin or native authority refused.', content: content('Error') },
      '404': { description: 'Resource unavailable to this operation, or unknown route or method.', content: content('Error') },
      '409': { description: 'Conflicting idempotency key, changed custody or unavailable current state.', content: content('Error') },
      '422': { description: 'Referenced records or publication prerequisites are not satisfied.', content: content('Error') },
      '503': { description: 'Required authority, storage or service unavailable; no successful result is claimed.', content: content('Error') },
    },
  }
}
const filters = jsonSchema(publicRequestFiltersSchema).properties as Record<string, Schema>
const queryParameters: Parameter[] = Object.entries(filters).map(([name, schema]) => ({ name, in: 'query', schema }))

/** Only existing scoped REST operations are described. Operator administration and future resource families are outside this document. */
export const integrationOpenApi = {
  openapi: '3.1.0', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'Penny native integration API', version: '1',
    description: 'Existing scoped REST operations only. Lists are returned as arrays; pagination and additional operator resource families are not implemented. Request lists accept only the documented filters. Other list operations ignore extra query values. Issue keys through authenticated native integration settings. Keys do not admit operator pages, exports or configuration. Publication needs explicit approval and existing native prerequisites.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/boards': { get: operation('listBoards', 'List public boards', 'requests:read', 'Boards') },
    '/api/v1/requests': {
      get: operation('listRequests', 'List approved requests', 'requests:read', 'Requests', 200, undefined, queryParameters),
      post: operation('createRequest', 'Create a held request', 'requests:write', 'CreatedRequest', 201, 'CreateRequest'),
    },
    '/api/v1/requests/{slug}': { get: operation('getRequest', 'Read an approved request or canonical lookup', 'requests:read', 'Request', 200, undefined, [slug]) },
    '/api/v1/requests/{slug}/comments': {
      get: operation('listComments', 'List approved comments', 'comments:read', 'Comments', 200, undefined, [slug]),
      post: operation('createComment', 'Publish an approved operator comment', 'comments:write', 'CreatedComment', 201, 'CreateComment', [slug]),
    },
    '/api/v1/requests/{slug}/status-updates': {
      get: operation('listStatusUpdates', 'List published status updates', 'status:read', 'StatusUpdates', 200, undefined, [slug]),
      post: operation('publishStatus', 'Publish an approved status update', 'status:write', 'PublishedStatus', 200, 'PublishStatus', [slug]),
    },
    '/api/v1/proxy-vote-contacts': { get: operation('findProxyContacts', 'Find active proxy-vote customers, at most 25', 'votes:write', 'Contacts', 200, undefined, [{ name: 'q', in: 'query', schema: { type: 'string', maxLength: 200 } }]) },
    '/api/v1/requests/{slug}/proxy-votes': { post: operation('recordProxyVote', 'Record attributed customer demand without granting consent', 'votes:write', 'ProxyVote', 200, 'RecordProxyVote', [slug]) },
    '/api/v1/releases': {
      get: operation('listReleases', 'List published current releases', 'releases:read', 'Releases'),
      post: operation('createRelease', 'Create a release draft', 'releases:write', 'CreatedRelease', 201, 'CreateRelease'),
    },
    '/api/v1/releases/{slug}': { get: operation('getRelease', 'Read a published current release', 'releases:read', 'Release', 200, undefined, [slug]) },
    '/api/v1/releases/{slug}/publish': { post: operation('publishRelease', 'Publish an explicitly approved release with current Shipped targets', 'releases:write', 'PublishedRelease', 200, 'Approval', [slug]) },
  },
  components: {
    securitySchemes: { integrationKey: { type: 'http', scheme: 'bearer', bearerFormat: 'installation integration key', description: 'Reveal-once key issued by this installation. Each operation names its required native scope in x-required-scopes. Insufficient scope returns 401.' } },
    schemas,
  },
}
