import type { Context, Hono } from 'hono'
import { createPortability, createPortabilityHandler, excludedTable } from '@runeditrun/rer/modules/portability'
import { abortPortabilitySnapshot, abortPortabilityActor, portabilitySnapshotStatus } from '../../../../scripts/portability/cleanup.mjs'
import type { PennyRuntime } from '../../app/runtime'
import type { AppBindings } from '../../shared/bindings'
import { operatorAuth } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'
import { finish, readErasureJournal, reserve, schemaHeaders, checkSchemaHeaders, schemaPart, state } from './archive'
import { assertDataAuthority } from './authority'
import { claimPortabilityRunner } from './portability-lock'
import { policy, LOCAL_DATA_LIMITS } from '../../../../scripts/portability/policy'
import { verifyExport } from '../../../../scripts/portability/verify'

type Environment = { Bindings: AppBindings; Variables: { runtime: PennyRuntime } }
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
/** Base's export protocol, under Penny's existing durable maintenance fence. */
export function registerPortabilityRoutes(app: Hono<Environment>) {
 app.all('/api/portability/*', hostedExport)
}
async function hostedExport(c: Context<Environment>): Promise<Response> {
 const request = c.req.raw, url = new URL(request.url), runtime = c.get('runtime'), origin = runtime.configuration.appOrigin
 if (url.origin !== origin || request.headers.has('host') && request.headers.get('host') !== new URL(origin!).host) return reply('not_found', 404)
 const match = /^\/api\/portability\/exports(?:\/([a-zA-Z0-9-]+)(?:\/(advance|download|abort))?)?$/.exec(url.pathname)
 if (!match) return reply('not_found', 404)
 if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || request.headers.has('Origin') && request.headers.get('Origin') !== origin || !['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== origin) return reply('forbidden_origin', 403)
 const auth = operatorAuth(runtime), session = await auth.getSession(request)
 if (!session || session.kind !== 'native' || session.operator.role !== 'owner') return reply('native_owner_session_required', 401)
 const db = c.env.DB, jobId = match[1], action = match[2], creating = !jobId && request.method === 'POST'
 const job = jobId ? await db.prepare("SELECT actor,phase FROM rer_portability_jobs WHERE id=? AND kind='export'").bind(jobId).first<{actor:string;phase:string}>() : null
 if (jobId && (!job || !job.actor.startsWith(session.operatorId + ':'))) return reply('job_not_found', 404)
 let operationId: string | undefined, actor = job?.actor ?? session.operatorId + ':' + crypto.randomUUID()
 let runner: Awaited<ReturnType<typeof claimPortabilityRunner>> | undefined, streaming = false
 try {
  if (jobId) {
   const operation = await db.prepare("SELECT id FROM data_operations WHERE kind='export' AND json_extract(payload_json,'$.portabilityActor')=?").bind(actor).first<{ id: string }>()
   operationId = operation?.id
   if (request.method === 'GET' && !action || request.method === 'POST' && action === 'abort' && job?.phase === 'aborted' && !operationId) {
    const result = await portabilitySnapshotStatus(db, jobId)
    await assertDataAuthority(db, session)
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
   }
   const current = await state(db)
   if (!operationId || current?.lock_id !== operationId || current.phase !== 'locked') return reply('data_operation_changed', 409)
  } else if (creating) operationId = await reserve(db, 'export', { portabilityActor: actor }, session)
  else return reply('method_not_allowed', 405)
  runner = await claimPortabilityRunner(db, operationId!, session)
  const guarded = runner.db
  if (jobId && action === 'abort' && request.method === 'POST') {
   const result = await abortPortabilitySnapshot(guarded, jobId)
   await finish(guarded, operationId!, 'complete', session)
   return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  const headers = (await schemaHeaders(db)).filter(table => !excludedTable(table.name))
  checkSchemaHeaders(headers)
  const tables = await schemaPart(db, headers)
  let count = 0
  for (const table of tables) {
   count += (await db.prepare(`SELECT count(*) n FROM "${table.name}"`).first<number>('n'))!
   if (count > LOCAL_DATA_LIMITS.rows) throw new NativeError('archive_limit', 413)
  }
  const journal = await readErasureJournal(db), productPolicy = policy(journal)
  // The live lock is installation custody. The archived state is an idle target.
  const exportPolicy = { ...productPolicy, exportRow: (table: string, row: Parameters<NonNullable<typeof productPolicy.exportRow>>[1]) => table === 'data_state' ? { ...row, phase: 'idle', lock_id: null } : productPolicy.exportRow!(table, row) }
  const options = { db: guarded, buckets: { FILES: c.env.FILES }, policy: exportPolicy }
  const handler = await createPortabilityHandler({ ...options, appOrigin: origin!, authorize: async (incoming, operation) => {
   const current = await auth.getSession(incoming)
   return operation.operation === 'export' && current?.kind === 'native' && current.operator.role === 'owner' && current.id === session.id ? actor : null
  } })
  const response = await handler(request)
  if (!response) throw new NativeError('not_found', 404)
  if (!response.ok) {
   if (creating) { await abortPortabilityActor(guarded, actor); await finish(guarded, operationId!, 'aborted', session) }
   return response
  }
  // Base validates transport integrity; Penny also validates normalized product
  // records, originals, schema, held effects and the matching erasure journal.
  if (jobId && (action === 'download' || action === 'advance' && (await response.clone().json() as { phase: string }).phase === 'complete')) {
   const service = await createPortability(options)
   await verifyExport(guarded, await service.exports.download(jobId), journal)
  }
  await assertDataAuthority(guarded, session)
  if (action === 'download' && response.body) {
   response.headers.set('Content-Disposition', 'attachment; filename="penny.rer"')
   const reader = response.body.getReader(), release = runner.release
   streaming = true
   return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
     try { const item = await reader.read(); if (item.done) { await release(); controller.close() } else controller.enqueue(item.value) }
     catch (error) { await release(); controller.error(error) }
    },
    async cancel() { try { await reader.cancel() } finally { await release() } },
   }), { status: response.status, headers: response.headers })
  }
  return response
 } catch (error) {
  if (creating && runner && operationId) {
   try { await abortPortabilityActor(runner.db, actor); await finish(runner.db, operationId, 'aborted', session) }
   catch { return reply('portability_cleanup_required', 409) }
  }
  return reply(error instanceof NativeError ? error.code : 'portability_export_refused', error instanceof NativeError ? error.status : 409)
 } finally {
  if (runner && !streaming) await runner.release()
 }
}
