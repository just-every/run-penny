import type { PennyRuntime } from '../../app/runtime'
import type { Principal } from '../../../../base/modules/agent-door/index.ts'
import { D1SqlDatabase } from '../../../../base/modules/integrations/core/database.ts'
import { IntegrationsRepository } from '../../../../base/modules/integrations/core/repository.ts'
import { TokenService } from '../../../../base/modules/integrations/core/tokens.ts'
import { sha256 } from '../../../../base/modules/integrations/core/crypto.ts'
import { devAdmitted } from '../auth/dev-admission'

const namespace = 'penny-api'
export async function localCredential(runtime: PennyRuntime, request: Request) {
  const match = /^Bearer (int_[a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')
  if (!match) return null
  const db = runtime.database.binding, hash = await sha256(match[1])
  const issuer = await db.prepare(`SELECT t.id,i.native_operator_id FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id
    JOIN oa_operators n ON n.id=i.native_operator_id WHERE t.namespace=? AND t.token_hash=? AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at>?) AND n.status='active' AND n.version=i.operator_version`).bind(namespace, hash, Date.now()).first<{ id: string; native_operator_id: string }>()
  if (!issuer) return null
  const dev = await db.prepare("SELECT 1 FROM oa_dev_credentials WHERE credential='integration_tokens' AND id=?").bind(issuer.id).first()
  if (dev && !await devAdmitted(request)) return null
  const service = new TokenService(new IntegrationsRepository(new D1SqlDatabase(db), namespace), {
    grant: async () => { throw new Error('Native key issuance requires its person door') }, administer: async () => { throw new Error('Native key administration requires its person door') },
  })
  const metadata = await service.authorize(match[1], [], { requestId: crypto.randomUUID(), resource: 'mcp' })
  if (!metadata) return null
  return { sponsor: { id: issuer.native_operator_id }, agent: { id: `penny-key-${metadata.id}`, name: metadata.name, specialist: 'feedback-triager' }, scopes: metadata.scopes, clientId: `penny-api/${metadata.id}` }
}
export async function currentScopes(runtime: PennyRuntime, principal: Principal) {
  if (!principal.clientId?.startsWith('penny-api/')) return principal.scopes
  const row = await runtime.database.binding.prepare(`SELECT t.scopes FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id
    JOIN oa_operators n ON n.id=i.native_operator_id WHERE t.namespace=? AND t.id=? AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at>?) AND n.id=? AND n.status='active' AND n.version=i.operator_version`)
    .bind(namespace, principal.clientId.slice('penny-api/'.length), Date.now(), principal.person.id).first<{ scopes: string }>()
  return row ? JSON.parse(row.scopes) as string[] : []
}
