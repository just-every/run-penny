import type { Hono } from 'hono'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { operatorSession } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'
import { sessionReadGuard } from '../integrations/keys'
import { readDatabase } from '../integrations/read-database'
import { volumeInput } from './input'
import { readFeedbackVolume } from './reader'
import { volumeCsv } from './csv'

export function registerReportRoutes(app: Hono<OperatorMutationEnvironment>) {
  for (const format of ['json', 'csv'] as const) {
    const path = '/api/operator/reports/feedback-volume' + (format === 'csv' ? '.csv' : '')
    app.get(path, async c => {
      c.header('Cache-Control', 'private, no-store')
      c.header('X-Content-Type-Options', 'nosniff')
      const runtime = c.get('runtime'), session = await operatorSession(runtime, c.req.raw)
      if (!session) throw new NativeError('unauthenticated', 401)
      const report = await readFeedbackVolume(readDatabase(runtime.database.binding, sessionReadGuard(session)), volumeInput(c.req.url))
      if (format === 'json') return c.json(report)
      c.header('Content-Disposition', 'attachment; filename="penny-feedback-volume.csv"')
      c.header('Content-Type', 'text/csv; charset=utf-8')
      return c.body(volumeCsv(report))
    })
  }
}
