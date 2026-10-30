import { createBusinessSettings } from '../../../../base/modules/business-settings/index.ts'
import type { PennyRuntime } from '../../app/runtime'
import { operatorAuth } from '../auth/operator'

export const business = { settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } } } as const
export function pennyBusiness(runtime: PennyRuntime) {
  return createBusinessSettings({ db: runtime.database.binding, trust: runtime.bindings.RER_BUSINESS_TRUST, business, team: operatorAuth(runtime).businessTeam })
}
