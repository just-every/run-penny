/** Base checks the direct issuance count. D1's meta.changes also includes
 * Penny's audit/revision triggers, while SQLite changes() excludes them.
 * Read that count in the same guarded transaction, without changing Base SQL
 * or the changes() chain used by native reinvitation and revocation fences. */
export function invitationDatabase(db: D1Database): D1Database {
  const statements = new WeakMap<D1PreparedStatement, { statement: D1PreparedStatement; writes: boolean }>()
  function wrap(statement: D1PreparedStatement, writes: boolean): D1PreparedStatement {
    const wrapped = new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...values: unknown[]) => wrap(target.bind(...values), writes)
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    statements.set(wrapped, { statement, writes })
    return wrapped
  }
  return new Proxy(db, { get(target, key) {
    if (key === 'prepare') return (sql: string) => wrap(target.prepare(sql), /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql))
    if (key === 'batch') return async (input: D1PreparedStatement[]) => {
      const offsets: { index: number; writes: boolean }[] = [], batch: D1PreparedStatement[] = []
      for (const item of input) {
        const { statement, writes } = statements.get(item) ?? { statement: item, writes: false }
        offsets.push({ index: batch.length, writes })
        batch.push(statement)
        if (writes) batch.push(target.prepare('SELECT changes() AS direct_changes'))
      }
      const results = await target.batch(batch)
      return offsets.map(({ index, writes }) => writes
        ? { ...results[index], meta: { ...results[index].meta, changes: Number((results[index + 1].results[0] as { direct_changes: number }).direct_changes) } }
        : results[index])
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
