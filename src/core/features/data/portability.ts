import {assertViewExport,viewExportCreator} from '../views/archive'
import {assertOriginalFiles} from './original-files'
import type { Context, Hono } from 'hono'
import { createPortabilityHandler, excludedTable } from '@runeditrun/rer/modules/portability'
import { abortPortabilitySnapshot, abortPortabilityActor, portabilitySnapshotStatus } from '../../../../scripts/portability/cleanup.mjs'
import type { PennyRuntime } from '../../app/runtime'
import type { Session } from '../../../../base/modules/operator-auth/index.mjs'
import type { AppBindings } from '../../shared/bindings'
import { operatorAuth } from '../auth/operator'
import { NativeError } from '../auth/native-tokens'
import { finish, readErasureJournal, reserve, schemaHeaders, checkSchemaHeaders, schemaPart, state } from './archive'
import { assertDataAuthority } from './authority'
import { assertPlatformLedger } from './platform-ledger'
import { claimPortabilityRunner } from './portability-lock'
import { policy, LOCAL_DATA_LIMITS } from '../../../../scripts/portability/policy'
import { verifyExport } from '../../../../scripts/portability/verify'

type Environment = { Bindings: AppBindings; Variables: { runtime: PennyRuntime } }
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } })
/** Base's export protocol, under Penny's existing durable maintenance fence. */
export function registerPortabilityRoutes(app: Hono<Environment>) {
 app.all('/api/portability/*', hostedExport)
}
/** The signed-in owner's own hosted export that still holds the data lock, so
 * the Data page can resume or abort it through the same guarded routes. */
export async function ownHostedExport(db: D1Database, operation: { kind: string; payload_json: string } | null, session: Session | null): Promise<{ jobId: string | null; phase: string | null; completed: number } | null> {
 if (operation?.kind !== 'export' || session?.kind !== 'native' || session.operator.role !== 'owner') return null
 const actor = (JSON.parse(operation.payload_json) as { portabilityActor?: string }).portabilityActor
 if (!actor?.startsWith(session.operatorId + ':')) return null
 const job = await db.prepare("SELECT id,phase,completed FROM rer_portability_jobs WHERE kind='export' AND actor=? AND phase<>'aborted'").bind(actor).first<{ id: string; phase: string; completed: number }>()
 return { jobId: job?.id ?? null, phase: job?.phase ?? null, completed: job?.completed ?? 0 }
}
async function hostedExport(c: Context<Environment>): Promise<Response> {
 const request = c.req.raw, url = new URL(request.url), runtime = c.get('runtime'), origin = runtime.configuration.appOrigin
 if (url.origin !== origin || request.headers.has('host') && request.headers.get('host') !== new URL(origin!).host) return reply('not_found', 404)
 const match = /^\/api\/portability\/exports(?:\/([a-zA-Z0-9-]+)(?:\/(advance|download|abort))?)?$/.exec(url.pathname)
 if (!match) return reply('not_found', 404)
 if (request.headers.get('Sec-Fetch-Site') === 'cross-site' || request.headers.has('Origin') && request.headers.get('Origin') !== origin || !['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== origin) return reply('forbidden_origin', 403)
 const auth = operatorAuth(runtime), session = await auth.getSession(request)
 if (!session || session.kind !== 'native' || session.operator.role !== 'owner') return reply('native_owner_session_required', 401)
 const privateCreator=await viewExportCreator(c.env.DB,session.operatorId)
 const db = c.env.DB, jobId = match[1], action = match[2], creating = !jobId && request.method === 'POST'
 const job = jobId ? await db.prepare("SELECT actor,phase FROM rer_portability_jobs WHERE id=? AND kind='export'").bind(jobId).first<{actor:string;phase:string}>() : null
 if (jobId && (!job || !job.actor.startsWith(session.operatorId + ':'))) return reply('job_not_found', 404)
 let operationId: string | undefined, actor = job?.actor ?? session.operatorId + ':' + crypto.randomUUID()
 let runner: Awaited<ReturnType<typeof claimPortabilityRunner>> | undefined
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
  } else if (creating) {await assertViewExport(db,privateCreator);operationId = await reserve(db, 'export', { portabilityActor: actor }, session)}
  else return reply('method_not_allowed', 405)
  runner = await claimPortabilityRunner(db, operationId!, session)
  const guarded = runner.db
  if (jobId && action === 'abort' && request.method === 'POST') {
   const result = await abortPortabilitySnapshot(guarded, jobId)
   await finish(guarded, operationId!, 'complete', session)
   return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  const headers = await schemaHeaders(db)
  checkSchemaHeaders(headers)
  await assertPlatformLedger(db)
  // The data lock holds every row still from creation to abort, so the row limit is checked once, in one round trip.
  if (creating) {
   const tables = await schemaPart(db, headers.filter(table => !excludedTable(table.name)))
   const counts = await db.batch(tables.map(table => db.prepare(`SELECT count(*) n FROM "${table.name}"`)))
   if (counts.reduce((sum, result) => sum + (result.results[0] as { n: number }).n, 0) > LOCAL_DATA_LIMITS.rows) throw new NativeError('archive_limit', 413)
   await assertOriginalFiles(guarded,c.env.FILES)
  }
  const journal = await readErasureJournal(db), productPolicy = policy(journal,privateCreator)
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
  // Every archive leaves through download, so the bytes sent are the bytes verified.
  if (jobId && action === 'download') {
   const bytes = new Uint8Array(await response.arrayBuffer())
   await verifyExport(guarded, new Blob([bytes]).stream(), journal)
   await assertDataAuthority(guarded, session)
   const headers = new Headers(response.headers)
   headers.set('Content-Disposition', 'attachment; filename="penny.rer"')
   return new Response(bytes, { status: response.status, headers })
  }
  await assertDataAuthority(guarded, session)
  return response
 } catch (error) {
  if (creating && runner && operationId) {
   try { await abortPortabilityActor(runner.db, actor); await finish(runner.db, operationId, 'aborted', session) }
   catch { return reply('portability_cleanup_required', 409) }
  }
  return reply(error instanceof NativeError ? error.code : 'portability_export_refused', error instanceof NativeError ? error.status : 409)
 } finally {
  if (runner) await runner.release()
 }
}
