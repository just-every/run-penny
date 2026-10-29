import { createBusinessSettings } from '../../../../base/modules/business-settings/index.ts'
import type { PennyRuntime } from '../../app/runtime'
import { pennyTrust } from './trust'
import { operatorAuth } from '../auth/operator'

export const business = { settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } } } as const
export function pennyBusiness(runtime: PennyRuntime) {
  const trust = pennyTrust(runtime)
  return createBusinessSettings({ db: runtime.database.binding, trust: trust ? { v: 1, issuer: trust.issuer, audience: trust.appOrigin, subject: trust.installationId, keys: trust.publicKeys } : null, business, team: operatorAuth(runtime).businessTeam })
}
