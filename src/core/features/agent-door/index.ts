import { createAgentDoor, operatorAuthPeople } from '../../../../base/modules/agent-door/index.ts'
import type { PennyRuntime } from '../../app/runtime'
import { operatorAuth, authenticateOperator } from '../auth/operator'
import { localCredential, currentScopes } from './credentials'
import { pennyTrust } from './trust'
import { planningTools } from './planning-tools'
import { readTools } from './read-tools'
import { triageTools } from './triage-tools'

export const capabilities = ['tools','policy','pause','audit','idempotency'] as const
export const notTools = [
  { clauses: ['CAP-003','CAP-010','CAP-012','CAP-015','WIDGET-004'], reason: 'device' },
  { clauses: ['CAP-016','CAP-017','INT-005','INT-006','DELIV-002'], reason: 'connector' },
  { clauses: ['DATA-001','IMP-001','MIG-001'], reason: 'import-door' },
  { clauses: ['BASE-AGENT-003'], reason: 'installation' },
] as const
export function pennyAgentDoor(runtime: PennyRuntime) {
  return createAgentDoor({ seed: 'penny', name: 'Penny', specialist: 'feedback-triager', version: '0.2.2', db: runtime.database.binding, origin: runtime.configuration.appOrigin!, trust: pennyTrust(runtime), capabilities,
    people: operatorAuthPeople({ db: runtime.database.binding, session: async request => {
      const session = await operatorAuth(runtime).getSession(request)
      if (session) await authenticateOperator(runtime, request)
      return session
    } }),
    localCredentials: request => localCredential(runtime, request), currentScopes: principal => currentScopes(runtime, principal),
    tools: [...readTools, ...triageTools, ...planningTools], notTools: notTools.map(item => ({ clauses: [...item.clauses], reason: item.reason })),
  })
}
