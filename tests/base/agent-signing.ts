import { document_sha256, validateDocument } from '../../base/modules/agent-door/policy/document.ts'

interface Context {
  signer: { issuer: string; installationId: string; kid: string; privateKey: CryptoKey }
  origin: string; business: string; person: { sub: string; email: string }; agentId: string; consent: string
  surface: { specialist: string; tools: { scope: string }[] }
}
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const json = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)))
export async function signJws(privateKey: CryptoKey, kid: string, typ: string, payload: unknown) {
  const input = json({ alg: 'ES256', typ, kid }) + '.' + json(payload)
  return input + '.' + encode(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(input))))
}
export const autonomousPolicy = () => ({ schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1', rules: [{ id: 'all', class: '*', do: 'autonomous' }], spend: { none: true } })
export async function accessToken(context: Context, overrides: { scope?: string } = {}) {
  const iat = Math.floor(Date.now() / 1000), { signer } = context
  return signJws(signer.privateKey, signer.kid, 'at+jwt', {
    iss: signer.issuer, aud: context.origin + '/mcp', sub: context.person.sub, email: context.person.email,
    act: { sub: context.agentId, name: 'Synthetic Penny agent', specialist: context.surface.specialist }, client_id: 'synthetic-penny-1',
    scope: context.surface.tools.map(tool => tool.scope).join(' '), business: context.business, consent: context.consent,
    jti: crypto.randomUUID(), iat, exp: iat + 300, ...overrides,
  })
}
export async function policyEnvelope(context: Context, document: unknown) {
  const { signer } = context, iat = Math.floor(Date.now() / 1000)
  const revision_signature = await signJws(signer.privateKey, signer.kid, 'rer-agent-policy-revision+jwt', { business: context.business, revision: 1, document_sha256: await document_sha256(validateDocument(document)) })
  return { policy: await signJws(signer.privateKey, signer.kid, 'rer-agent-policy+jwt', {
    v: 1, iss: signer.issuer, aud: context.origin, sub: signer.installationId, business: context.business, seq: 1, revision: 1,
    paused: false, catalogue: 'rer-agent-classes/1', document, revision_signature, iat, exp: iat + 300,
  }) }
}
