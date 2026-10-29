import { ToolRefusal, type ToolContext } from '../../../../base/modules/agent-door/index.ts'
import { guardedDatabase, type AuthorityGuard } from '../integrations/guarded-database'
import { readDatabase } from '../integrations/read-database'

/** Token claims never choose a product actor. Both identities are persisted native IDs. */
export async function nativeContext(ctx: ToolContext, write = false) {
  const person = await ctx.db.prepare(`SELECT n.version,p.id,p.display_name AS displayName FROM oa_operators n
    JOIN penny_agent_people a ON a.native_operator_id=n.id JOIN operators p ON p.id=a.actor_id
    WHERE n.id=? AND n.status='active'`).bind(ctx.person.id).first<{ version: number; id: string; displayName: string }>()
  if (!person) throw new ToolRefusal('unauthenticated')
  const guard: AuthorityGuard = { sql: "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND version=?)", params: [ctx.person.id, person.version] }
  if (ctx.clientId?.startsWith('penny-api/')) {
    guard.sql += ` AND EXISTS(SELECT 1 FROM integration_tokens t JOIN penny_api_issuers i ON i.token_id=t.id
      WHERE t.namespace='penny-api' AND t.id=? AND i.native_operator_id=? AND i.operator_version=? AND t.revoked_at IS NULL
      AND (t.expires_at IS NULL OR t.expires_at>unixepoch('subsec')*1000)
      AND NOT EXISTS(SELECT value FROM json_each(?) WHERE value NOT IN(SELECT value FROM json_each(t.scopes))))`
    guard.params.push(ctx.clientId.slice('penny-api/'.length), ctx.person.id, person.version, JSON.stringify(ctx.scopes))
  }
  guard.sql += " AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')"
  if (!write) return { db: readDatabase(ctx.db, guard), actor: person.id, displayName: person.displayName }
  // Fence a policy/consent/Pause change occurring after door classification, in the
  // native service's own transaction, alongside current membership and custody.
  const state = await ctx.db.prepare('SELECT envelope,local_document,local_paused FROM agent_door_state WHERE id=1').first<{ envelope: string | null; local_document: string | null; local_paused: number }>()
  if (!state || state.local_paused) throw new ToolRefusal('agents_paused')
  if (state.envelope) {
    const envelope = JSON.parse(state.envelope)
    if (envelope.paused) throw new ToolRefusal('agents_paused')
    if (envelope.exp * 1000 <= ctx.now() || !envelope.document) throw new ToolRefusal('policy_unavailable')
    if (envelope.revoked?.consents?.includes(ctx.consent)) throw new ToolRefusal('consent_revoked')
    if (envelope.revoked?.agents?.includes(ctx.agent.id)) throw new ToolRefusal('unauthenticated')
    const admission = await ctx.db.prepare("SELECT json_extract(row,'$.revision') AS revision FROM agent_door_audit WHERE id=?").bind(ctx.operationId).first<{revision:number}>()
    if (!admission || admission.revision !== envelope.revision) throw new ToolRefusal('policy_changed')
  }
  guard.sql += ` AND EXISTS(SELECT 1 FROM data_state WHERE singleton=1 AND phase='idle')
    AND EXISTS(SELECT 1 FROM agent_door_state WHERE id=1 AND envelope IS ? AND local_document IS ? AND local_paused=0)
    AND EXISTS(SELECT 1 FROM agent_door_agents WHERE id=? AND sponsor=? AND revoked=0)`
  guard.params.push(state.envelope, state.local_document, ctx.agent.id, ctx.person.id)
  const attribution = () => [ctx.db.prepare(`INSERT INTO penny_agent_attribution(singleton,agent_id,agent_name,sponsor_native_id,prepared_by,approvers_json,operation_id) VALUES(1,?,?,?,?,?,?)`)
    .bind(ctx.agent.id, ctx.agent.name, ctx.person.id, ctx.actor.label, JSON.stringify(ctx.approvers), ctx.operationId)]
  const guarded = guardedDatabase(ctx.db, guard, attribution)
  // Delete transient attribution in the same batch. Existing native audit inserts
  // get attribution through the additive trigger, retaining their real event type.
  const statements = new WeakMap<object, D1PreparedStatement>()
  const batch = async (input: D1PreparedStatement[]) => {
    const result = await guarded.batch([...input.map(item => statements.get(item) ?? item), guarded.prepare('DELETE FROM penny_agent_attribution WHERE singleton=1')])
    return result.slice(0, -1)
  }
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = {
      bind: (...args: unknown[]) => wrap(statement.bind(...args)),
      all: async () => (await batch([statement]))[0], run: async () => (await batch([statement]))[0],
      first: async (column?: string) => { const row = (await batch([statement]))[0].results[0] ?? null; return column && row ? (row as Record<string, unknown>)[column] : row },
      raw: () => { throw new ToolRefusal('operation_unavailable') },
    } as D1PreparedStatement
    statements.set(wrapped, statement); return wrapped
  }
  const db = new Proxy(guarded, { get(target, key) {
    if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql))
    if (key === 'batch') return batch
    const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value
  } })
  return { db, actor: person.id, displayName: ctx.actor.label }
}

export async function nativeAudit(ctx: ToolContext, tool: string, id: string | null) {
  const { db, actor } = await nativeContext(ctx, true), now = new Date().toISOString()
  await db.prepare(`INSERT INTO audit_entries(id,actor_type,actor_id,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at)
    VALUES(?,'operator',?,'agent.tool','agent_operation',?,?,?,?,?)`)
    .bind(crypto.randomUUID(), actor, id ?? ctx.operationId, JSON.stringify({ tool, preparedBy: ctx.actor, approvers: ctx.approvers }), now, now, now).run()
}
