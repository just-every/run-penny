import sample from '../sample-data/penny.v1.json'
import { importPennySample } from './core/features/sample-data/service'
import { createDatabaseConnection } from './core/platform/database'
import type { AppBindings } from './core/shared/bindings'

/** Demo data for `rer demo` and the hosted demo (Base modules/demo runs it once,
 * after the owner exists): Penny's own sample workspace (accounts, evidence,
 * requests, a decision, roadmap and a draft release) and the owner's finished
 * first run. Every sample insert is ON CONFLICT DO NOTHING, so a repeat is a no-op. */
export async function seedDemo(env: AppBindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  await importPennySample(createDatabaseConnection(env.DB), sample, now.toISOString())
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
