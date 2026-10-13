import type { DevPersona } from '../../../../base/modules/operator-auth/dev/index.mjs'

// Local dev personas: real operators at <as>@dev.localhost, created only by local
// dev sign-in and suspended in exports. Penny operators are equals (OPS-001), so
// its one other identity is a teammate; Base still needs a role for it.
export function devPersonas(): DevPersona[] {
  return [{ as: 'teammate', role: 'member', displayName: 'Dev teammate' }]
}
export const devPersonaEmails = () => devPersonas().map(persona => `${persona.as}@dev.localhost`)
