import { readAttachment } from './mutation-boundaries'
import { NativeError } from '@/core/features/auth/native-tokens'
import { recoverAttachment,releaseInterruptedAttachmentWriter } from './attachment-upload'
import { reviewAppeal } from './appeal-review'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { mutationFailure, parseMutationBody, requireOperator, type OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { createOperatorRequest, requestContext, postOperatorComment } from './operator-context'
import { RequestMergeRepository } from './merge-repository'
import { RequestOperatorRepository } from './operator-repository'
import { RequestLifecycleError } from './lifecycle-types'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(128)
const identifier = z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u)
const text = z.string().trim().min(1).max(20_000)
const moderationSchema = z.object({
  verdict: z.enum(['approved', 'rejected']),
  notifyAuthor:z.boolean().optional(),
  title: z.string().trim().min(1).max(280).optional(),
  description: text.optional(),
  publicAuthorDisplayName: z.string().trim().min(1).max(160).optional(),
  boardSlug: slug.optional(),
  reason: z.string().trim().min(1).max(2_000).optional(),
}).strict()
const simpleVerdictSchema = z.object({ body:text.optional(), notifyAuthor:z.boolean().optional(), verdict: z.enum(['approved', 'rejected']), reason: z.string().trim().min(1).max(2_000).optional(), publicAuthorDisplayName: z.string().trim().min(1).max(160).optional() }).strict()
const statusSchema = z.object({ status: z.enum(['open', 'under_review', 'declined']), body: text, pinned: z.boolean().optional().default(false), idempotencyKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional() }).strict()
const noteSchema = z.object({ body: text }).strict()
const boardCreateSchema = z.object({ slug, name: z.string().trim().min(1).max(160), visibility: z.enum(['public', 'internal']) }).strict()
const boardUpdateSchema = z.object({ name: z.string().trim().min(1).max(160).optional(), visibility: z.enum(['public', 'internal']).optional(), position: z.number().int().min(0).optional(), archived: z.boolean().optional() }).strict()
const mergeSchema = z.object({ targetSlug: slug }).strict()
const requesterMergeSchema = z.object({ targetRequesterId: identifier }).strict()
const moveSchema = z.object({ boardSlug: slug }).strict()

export function registerRequestOperatorRoutes(app: Hono<OperatorMutationEnvironment>): void {
  app.get('/api/operator/attachment-uploads',async context=>operatorMutation(context,async()=>context.json((await context.get('runtime').database.binding.prepare('SELECT id,request_id,original_filename,byte_size,created_at,writing FROM request_attachment_uploads ORDER BY created_at').all()).results)))
  app.post('/api/operator/attachment-uploads/:id/release-writer',async context=>operatorMutation(context,async()=>{if(!await parseMutationBody(context,z.object({priorWriterStopped:z.literal(true)}).strict()))return context.json({error:'prior_writer_confirmation_required'},400);await releaseInterruptedAttachmentWriter(context.get('runtime').database,context.req.param('id'));return context.json({ok:true})}))
  app.post('/api/operator/attachment-uploads/:id/recover',async context=>operatorMutation(context,async()=>{const runtime=context.get('runtime');const original=context.req.header('Content-Type')?.startsWith('multipart/form-data;')?await readAttachment(context.req.raw):undefined;await recoverAttachment(runtime.database,runtime.blobs,context.req.param('id'),original);return context.json({ok:true})}))
  app.get('/api/operator/attachments/:attachmentId',async context=>operatorMutation(context,async()=>{
    const runtime=context.get('runtime')
    const attachment=await runtime.database.binding.prepare('SELECT storage_key AS storageKey,content_type AS contentType,original_filename AS filename FROM attachments WHERE id=?').bind(context.req.param('attachmentId')).first<{storageKey:string;contentType:string;filename:string}>()
    if(!attachment)return context.json({error:'not_found'},404)
    const object=await runtime.blobs.get(attachment.storageKey)
    if(!object)return context.json({error:'not_found'},404)
    return new Response(object.body,{headers:{'Content-Type':attachment.contentType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
  }))
  app.post('/api/operator/appeals/:id/review',async context=>{
    const input=await parseMutationBody(context,z.object({resolution:z.enum(['reopen','dismiss']),reason:z.string().trim().min(1).max(2000)}).strict())
    if(!input)return invalid(context)
    return operatorMutation(context,async operator=>{await reviewAppeal(context.get('runtime').database,context.req.param('id'),operator.id,input.resolution,input.reason,now());return context.json({ok:true})})
  })
  app.post('/api/operator/requests/:slug/comments' ,async context=>{
    const input=await parseMutationBody(context,noteSchema);if(!input)return invalid(context)
    return operatorMutation(context,async operator=>context.json(await postOperatorComment(context.get('runtime').database,context.req.param('slug'),input.body,operator),201))
  })
  app.get('/api/operator/requests/:slug/context' , async context => operatorMutation(context, async () => context.json(await requestContext(context.get('runtime').database, context.req.param('slug')))))
  app.post('/api/operator/requests', async context => {
    const input = await parseMutationBody(context, z.object({ title: z.string().trim().min(1).max(280), description: text, boardSlug: slug, evidenceIds: z.array(identifier).max(100).default([]) }).strict())
    if (!input || new Set(input.evidenceIds).size !== input.evidenceIds.length) return invalid(context)
    return operatorMutation(context, async operator => context.json(await createOperatorRequest(context.get('runtime').database,input,operator.id),201))
  })
  app.post('/api/operator/requests/:slug/moderate' , async (context) => {
    const input = await parseMutationBody(context, moderationSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).moderateRequest({ ...input, slug: requestSlug.data, operatorId: operator.id, now: now() })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/edits/:editId/moderate', async (context) => {
    const input = await parseMutationBody(context, simpleVerdictSchema)
    const editId = identifier.safeParse(context.req.param('editId'))
    if (!input || !editId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).moderateRequestEdit({ ...input, editId: editId.data, operatorId: operator.id, now: now() })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/comments/:commentId/moderate', async (context) => {
    const input = await parseMutationBody(context, simpleVerdictSchema)
    const commentId = identifier.safeParse(context.req.param('commentId'))
    if (!input || !commentId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).moderateComment({ ...input, commentId: commentId.data, operatorId: operator.id, now: now() })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/comments/edits/:editId/moderate', async (context) => {
    const input = await parseMutationBody(context, simpleVerdictSchema)
    const editId = identifier.safeParse(context.req.param('editId'))
    if (!input || !editId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).moderateCommentEdit({ ...input, editId: editId.data, operatorId: operator.id, now: now() })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/:slug/status-updates', async (context) => {
    const input = await parseMutationBody(context, statusSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).publishStatusUpdate({
        ...input, slug: requestSlug.data, operatorId: operator.id, now: now(), appOrigin: context.get('runtime').configuration.appOrigin,
      })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/:slug/decline/reverse', async (context) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).reverseDecline(requestSlug.data, operator.id, now())
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/:slug/notes', async (context) => {
    const input = await parseMutationBody(context, noteSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).addNote(requestSlug.data, operator.id, input.body, now())
      return context.json({ ok: true }, 201)
    })
  })

  app.patch('/api/operator/requests/:slug/board', async (context) => {
    const input = await parseMutationBody(context, moveSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return invalid(context)
    return operatorMutation(context, async () => {
      await new RequestOperatorRepository(context.get('runtime').database).moveRequest(requestSlug.data, input.boardSlug, now())
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/:slug/merge', async (context) => {
    const input = await parseMutationBody(context, mergeSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestMergeRepository(context.get('runtime').database).merge(requestSlug.data, input.targetSlug, operator.id, now())
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requests/:slug/unmerge', async (context) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestMergeRepository(context.get('runtime').database).unmerge(requestSlug.data, operator.id, now())
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/attachments/:attachmentId/moderate', async (context) => {
    const input = await parseMutationBody(context, simpleVerdictSchema)
    const attachmentId = identifier.safeParse(context.req.param('attachmentId'))
    if (!input || !attachmentId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).moderateAttachment({ ...input, attachmentId: attachmentId.data, operatorId: operator.id, now: now() })
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/requesters/:requesterId/block', async (context) => {
    const requesterId = identifier.safeParse(context.req.param('requesterId'))
    if (!requesterId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).setRequesterBlocked(requesterId.data, true, operator.id, now())
      return context.json({ ok: true })
    })
  })

  app.delete('/api/operator/requesters/:requesterId/block', async (context) => {
    const requesterId = identifier.safeParse(context.req.param('requesterId'))
    if (!requesterId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).setRequesterBlocked(requesterId.data, false, operator.id, now())
      return context.body(null, 204)
    })
  })

  app.post('/api/operator/requesters/:requesterId/merge', async (context) => {
    const input = await parseMutationBody(context, requesterMergeSchema)
    const sourceRequesterId = identifier.safeParse(context.req.param('requesterId'))
    if (!input || !sourceRequesterId.success) return invalid(context)
    return operatorMutation(context, async (operator) => {
      await new RequestOperatorRepository(context.get('runtime').database).mergeRequesters(sourceRequesterId.data, input.targetRequesterId, operator.id, now())
      return context.json({ ok: true })
    })
  })

  app.post('/api/operator/boards', async (context) => {
    const input = await parseMutationBody(context, boardCreateSchema)
    if (!input) return invalid(context)
    return operatorMutation(context, async () => {
      await new RequestOperatorRepository(context.get('runtime').database).createBoard({ ...input, now: now() })
      return context.json({ ok: true }, 201)
    })
  })

  app.patch('/api/operator/boards/:slug', async (context) => {
    const input = await parseMutationBody(context, boardUpdateSchema)
    const boardSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !boardSlug.success) return invalid(context)
    return operatorMutation(context, async () => {
      await new RequestOperatorRepository(context.get('runtime').database).updateBoard({ ...input, slug: boardSlug.data, now: now() })
      return context.json({ ok: true })
    })
  })
}

async function operatorMutation(context: Context<OperatorMutationEnvironment>, action: (operator: NonNullable<Awaited<ReturnType<typeof requireOperator>>>) => Promise<Response>): Promise<Response> {
  const operator = await requireOperator(context)
  if (!operator) return context.json({ authenticated: false }, 401)
  try {
    return await action(operator)
  } catch (error) {
    if (error instanceof RequestLifecycleError || error instanceof NativeError) return context.json({ error: error.code }, error.status)
    return mutationFailure(context, error)
  }
}

function invalid(context: Context<OperatorMutationEnvironment>): Response {
  return context.json({ error: 'validation_failed', message: 'The request mutation is invalid.' }, 400)
}

function now(): string {
  return new Date().toISOString()
}
