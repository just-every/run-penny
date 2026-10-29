import { NativeError } from '../auth/native-tokens'

/** Base retains exact outcomes and decision evidence. Until client-scoped
 * redaction and pending-execution fences are supplied, native erasure cannot
 * promise to remove those copies. Never clear policy/audit/replay stores. */
export async function assertAgentCustodyClear(db: D1Database) {
  const retained = await db.prepare(`SELECT EXISTS(SELECT 1 FROM agent_door_agents) OR EXISTS(SELECT 1 FROM agent_door_audit)
    OR EXISTS(SELECT 1 FROM agent_door_calls) OR EXISTS(SELECT 1 FROM agent_door_approvals)
    OR EXISTS(SELECT 1 FROM agent_door_reviews) AS retained`).first<number>('retained')
  if (retained) throw new NativeError('agent_retained_evidence_requires_review', 409, 'Agent decision evidence is retained. Client-scoped erasure of that evidence is not yet supported; no records were erased.')
}
