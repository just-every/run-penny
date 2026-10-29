import type { Trust } from '../../../../base/modules/agent-door/index.ts'
import type { PennyRuntime } from '../../app/runtime'

/** The installed native owner-claim ring is also the company agent authority. */
export function pennyTrust(runtime: PennyRuntime): Trust | null {
  const env = runtime.bindings
  const issuer = env.RER_OWNER_CLAIM_ISSUER, installationId = env.RER_OWNER_CLAIM_INSTALLATION_ID ?? env.RER_INSTALLATION_ID
  if (![issuer, env.RER_OWNER_CLAIM_PUBLIC_KEYS].some(Boolean)) return null
  if (!issuer || !installationId || !env.RER_OWNER_CLAIM_PUBLIC_KEYS || !runtime.configuration.appOrigin) throw new Error('Incomplete native owner-claim trust')
  return { issuer, installationId, appOrigin: runtime.configuration.appOrigin, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) }
}
