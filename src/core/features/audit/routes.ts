import type { Hono } from 'hono'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { operatorSession } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'
import { sessionReadGuard } from '../integrations/keys'
import { readDatabase } from '../integrations/read-database'
import { auditInput } from './input'
import { auditCsv, readAudit } from './reader'

export function registerAuditRoutes(app: Hono<OperatorMutationEnvironment>) {
  for (const format of ['list', 'json', 'csv'] as const) {
    const path = format === 'list' ? '/api/operator/audit' : `/api/operator/audit/export.${format}`
    app.get(path, async c => {
      c.header('Cache-Control', 'private, no-store')
      c.header('X-Content-Type-Options', 'nosniff')
      const runtime = c.get('runtime'), session = await operatorSession(runtime, c.req.raw)
      if (!session) throw new NativeError('unauthenticated', 401)
      if (!['owner', 'admin'].includes(session.operator.role)) throw new NativeError('audit_role_required', 403)
      const guard = sessionReadGuard(session)
      guard.sql += " AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role IN ('owner','admin'))"
      guard.params.push(session.operatorId)
      const page = await readAudit(readDatabase(runtime.database.binding, guard), await auditInput(c.req.url))
      if (format === 'list') return c.json(page)
      c.header('Content-Disposition', `attachment; filename="penny-audit.${format}"`)
      c.header('X-Audit-Total', String(page.total))
      if (page.nextCursor) c.header('X-Audit-Next-Cursor', page.nextCursor)
      if (format === 'json') return c.json(page)
      c.header('Content-Type', 'text/csv; charset=utf-8')
      return c.body(auditCsv(page.items))
    })
  }
}
