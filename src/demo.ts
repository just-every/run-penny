import { importPennySample } from './core/features/sample-data/service'
import { createDemoWorkspace } from './core/features/sample-data/demo-workspace'
import { seedDemoDelivery } from './core/features/sample-data/demo-delivery'
import { createDatabaseConnection } from './core/platform/database'
import type { AppBindings } from './core/shared/bindings'

/** A used workspace for local and hosted demos. Stable sample IDs and domain
 * publication checks make repeats preserve existing records and answers. */
export async function seedDemo(env: AppBindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  const database = createDatabaseConnection(env.DB)
  const sample = createDemoWorkspace(now)
  // Import one connected topic at a time to stay below D1's statement binding
  // limit. Shared context inserts are idempotent through Penny's sample importer.
  for (const [index] of sample.decisions.entries()) {
    await importPennySample(database, {
      ...sample, evidence: sample.evidence.slice(index * 3, index * 3 + 3),
      requests: [sample.requests[index]], decisions: [sample.decisions[index]], roadmapItems: [sample.roadmapItems[index]],
    }, sample.evidence[index * 3].observedAt)
  }
  await seedDemoDelivery(database, sample, now)
  const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE email = ? AND role = 'owner'").bind(ownerEmail.toLowerCase()).first<{ id: string }>()
  if (!owner) throw new Error('The demo owner does not exist yet')
  await env.DB.prepare('INSERT INTO oa_first_run (singleton, completed_by, completed_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO NOTHING').bind(owner.id, now.getTime()).run()
}

/** The hosted demo's front starts each container with Base's names for the owner
 * and session secret (modules/demo-host/container.mjs); Penny reads its own.
 * Only under RER_DEMO=1, which `rer deploy` refuses to carry. */
export function withDemoBindings(bindings: AppBindings): AppBindings {
  if (bindings.RER_DEMO !== '1') return bindings
  return {
    ...bindings,
    OPERATOR_EMAIL: bindings.OWNER_EMAIL ?? bindings.OPERATOR_EMAIL,
    AUTH_SECRET: bindings.AUTH_SECRET ?? bindings.SESSION_SECRET,
  }
}
