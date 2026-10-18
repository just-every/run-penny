import { importanceInput,importanceValue } from './vote-importance'
import { requesterCommentAdmission } from '../categories/comment-policy'
import type { ExistingHostIdentity } from '@/core/features/auth/host-identity'
import { limitPublicWrite, readAttachment } from './mutation-boundaries'
import { parseInput } from '@/core/features/auth/native-routes'
import { NativeError } from '@/core/features/auth/native-tokens'
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import type { PennyRuntime } from '@/core/app/runtime'
import { hasRequesterIdentity, requireRequesterIdentity, RequesterIdentityError } from '@/core/features/auth/requester'
import type { AppBindings } from '@/core/shared/bindings'
import { holdPendingRequesterAction, type PendingRequesterAction } from './pending-actions'
import { RequestAttachmentService } from './attachment-service'
import { RequestLifecycleError } from './lifecycle-types'
import { RequestWriteRepository } from './write-repository'

interface PublicRequestRouteEnvironment {
  Bindings: AppBindings
  Variables: { runtime: PennyRuntime }
}

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(128)
const opaquePendingToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/u)
const text = z.string().trim().min(1).max(20_000)
const submissionSchema = z.object({
  title: z.string().trim().min(1).max(280),
  description: text,
  proposedSolution: z.string().trim().min(1).max(10_000).nullable().optional().default(null),
  impactStatement: z.string().trim().min(1).max(10_000).nullable().optional().default(null),
  boardSlug: slug,
  categoryId: z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u).nullable().optional(),
  emailUpdates: z.boolean().optional().default(false), subscriptionVersion:z.number().int().positive().optional(),
}).strict()
const voteSchema = z.object({ importance:importanceValue.optional(),emailUpdates: z.boolean().optional().default(false), subscriptionVersion:z.number().int().positive().optional() }).strict()
const commentSchema = z.object({ body: text }).strict()
const requestEditSchema = submissionSchema.pick({ title: true, description: true, proposedSolution: true, impactStatement: true })
const appealSchema = z.object({
  subjectType: z.enum(['request', 'request_edit', 'comment', 'comment_edit']),
  subjectId: z.string().trim().min(1).max(128),
  body: text,
}).strict()
const muteSchema = z.object({ muted: z.boolean() }).strict()

export function registerPublicRequestMutationRoutes(app: Hono<PublicRequestRouteEnvironment>): void {
  app.get('/api/public/attachments/:attachmentId', async (context) => {
    const attachmentId = z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u).safeParse(context.req.param('attachmentId'))
    if (!attachmentId.success) return context.json({ error: 'not_found' }, 404)
    const response = await new RequestAttachmentService(context.get('runtime').database, context.get('runtime').blobs).publicResponse(attachmentId.data)
    return response ?? context.json({ error: 'not_found' }, 404)
  })

  app.get('/api/public/requests/suggestions', async (context) => {
    const title = context.req.query('title')?.trim() ?? ''
    if (!title || title.length > 280) return context.json({ error: 'validation_failed', message: 'A valid request title is required.' }, 400)
    return context.json(await new RequestWriteRepository(context.get('runtime').database).suggest(title))
  })

  app.post('/api/public/requests/:slug/vote', async (context) => {
    const input = await parse(context.req.raw, voteSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return context.json({ error: 'validation_failed', message: 'The vote is invalid.' }, 400)
    const action: PendingRequesterAction = { type: 'vote', slug: requestSlug.data, emailUpdates: input.emailUpdates, subscriptionVersion:input.subscriptionVersion,importance:input.importance }
    const identity = await identityOrHold(context, action)
    if (identity instanceof Response) return identity
    try {
      await new RequestWriteRepository(context.get('runtime').database).vote(identity, action.slug, action.emailUpdates, now(),action.subscriptionVersion,action.importance)
      return context.body(null, 204)
    } catch (error) {
      return lifecycleFailure(context, error)
    }
  })

  app.patch('/api/public/requests/:slug/vote-importance',async context=>withIdentity(context,async identity=>{
    const input=await parse(context.req.raw,importanceInput),requestSlug=slug.safeParse(context.req.param('slug'))
    if(!input||!requestSlug.success)return context.json({error:'validation_failed'},400)
    await new RequestWriteRepository(context.get('runtime').database).setVoteImportance(identity,requestSlug.data,input.importance,now())
    return context.body(null,204)
  }))

  app.delete('/api/public/requests/:slug/vote', async (context) => withIdentity(context, async (identity) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return context.json({ error: 'validation_failed', message: 'The vote is invalid.' }, 400)
    await new RequestWriteRepository(context.get('runtime').database).removeVote(identity, requestSlug.data)
    return context.body(null, 204)
  }))

  app.post('/api/public/requests/:slug/follow', async (context) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return context.json({ error: 'validation_failed', message: 'The follow is invalid.' }, 400)
    const action: PendingRequesterAction = { type: 'follow', slug: requestSlug.data }
    const identity = await identityOrHold(context, action)
    if (identity instanceof Response) return identity
    try {
      await new RequestWriteRepository(context.get('runtime').database).follow(identity, action.slug, now())
      return context.body(null, 204)
    } catch (error) {
      return lifecycleFailure(context, error)
    }
  })

  app.delete('/api/public/requests/:slug/follow', async (context) => withIdentity(context, async (identity) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return context.json({ error: 'validation_failed', message: 'The follow is invalid.' }, 400)
    await new RequestWriteRepository(context.get('runtime').database).unfollow(identity, requestSlug.data)
    return context.body(null, 204)
  }))

  app.patch('/api/public/requests/:slug/follow', async (context) => withIdentity(context, async (identity) => {
    const input = await parse(context.req.raw, muteSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return context.json({ error: 'validation_failed', message: 'The follow preference is invalid.' }, 400)
    await new RequestWriteRepository(context.get('runtime').database).setFollowMute(identity, requestSlug.data, input.muted, now())
    return context.body(null, 204)
  }))

  app.post('/api/public/requests/:slug/comments', async (context) => {
    const input = await parse(context.req.raw, commentSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return context.json({ error: 'validation_failed', message: 'The comment is invalid.' }, 400)
    await requesterCommentAdmission(context.get('runtime').database,requestSlug.data)
    const action: PendingRequesterAction = { type: 'comment', slug: requestSlug.data, body: input.body }
    const identity = await identityOrHold(context, action)
    if (identity instanceof Response) return identity
    try {
      return context.json(await new RequestWriteRepository(context.get('runtime').database).comment(identity, action.slug, action.body, now()), 201)
    } catch (error) {
      return lifecycleFailure(context, error)
    }
  })

  app.patch('/api/public/requests/:slug', async (context) => withIdentity(context, async (identity) => {
    const input = await parse(context.req.raw, requestEditSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return context.json({ error: 'validation_failed', message: 'The request edit is invalid.' }, 400)
    return context.json(await new RequestWriteRepository(context.get('runtime').database).editOwnRequest(identity, requestSlug.data, input, now()))
  }))

  app.post('/api/public/requests/:slug/withdraw', async (context) => withIdentity(context, async (identity) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return context.json({ error: 'validation_failed', message: 'The request is invalid.' }, 400)
    await new RequestWriteRepository(context.get('runtime').database).withdraw(identity, requestSlug.data, now())
    return context.body(null, 204)
  }))

  app.post('/api/public/requests/:slug/attachments', async (context) => withIdentity(context, async (identity) => {
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!requestSlug.success) return context.json({ error: 'validation_failed', message: 'The attachment request is invalid.' }, 400)
    const file = await readAttachment(context.req.raw)
    return context.json(await new RequestAttachmentService(context.get('runtime').database, context.get('runtime').blobs).upload(identity, requestSlug.data, file, now()), 201)
  }))

  app.patch('/api/public/comments/:commentId', async (context) => withIdentity(context, async (identity) => {
    const input = await parse(context.req.raw, commentSchema)
    const commentId = z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u).safeParse(context.req.param('commentId'))
    if (!input || !commentId.success) return context.json({ error: 'validation_failed', message: 'The comment edit is invalid.' }, 400)
    return context.json(await new RequestWriteRepository(context.get('runtime').database).editOwnComment(identity, commentId.data, input.body, now()))
  }))

  app.post('/api/public/requests/:slug/appeals', async (context) => withIdentity(context, async (identity) => {
    const input = await parse(context.req.raw, appealSchema)
    const requestSlug = slug.safeParse(context.req.param('slug'))
    if (!input || !requestSlug.success) return context.json({ error: 'validation_failed', message: 'The appeal is invalid.' }, 400)
    await new RequestWriteRepository(context.get('runtime').database).appeal(identity, requestSlug.data, input.subjectType, input.subjectId, input.body, now())
    return context.json({ submitted: true }, 201)
  }))

  app.get('/api/public/requester/activity', async (context) => withIdentity(context, async (identity) => {
    return context.json(await new RequestWriteRepository(context.get('runtime').database).requesterActivity(identity))
  }))
}

export async function identityOrHold(context: Context<PublicRequestRouteEnvironment>, action: PendingRequesterAction, existingHost?: ExistingHostIdentity) {
  try {
    const identity=await requireRequesterIdentity(context.get('runtime'),context.req.raw,existingHost)
    await limitPublicWrite(context.get('runtime'),context.req.raw)
    if(action.type!=='submission')await limitPublicWrite(context.get('runtime'),context.req.raw,identity.requesterId)
    return identity
  } catch (error) {
    if (error instanceof RequesterIdentityError && error.status === 401 && !hasRequesterIdentity(context.req.raw)) {
      const pendingToken = opaquePendingToken.safeParse(context.req.header('X-Penny-Pending-Token'))
      if (pendingToken.success) {
        await limitPublicWrite(context.get('runtime'),context.req.raw)
        await holdPendingRequesterAction(context.get('runtime').database, pendingToken.data, action, now())
        return context.json({ error: 'requester_identity_required', actionHeld: true }, 202)
      }
    }
    return requesterFailure(context, error)
  }
}

async function withIdentity(context: Context<PublicRequestRouteEnvironment>, action: (identity: Awaited<ReturnType<typeof requireRequesterIdentity>>) => Promise<Response>): Promise<Response> {
  try {
    const identity=await requireRequesterIdentity(context.get('runtime'),context.req.raw)
    await limitPublicWrite(context.get('runtime'),context.req.raw)
    await limitPublicWrite(context.get('runtime'),context.req.raw,identity.requesterId)
    return await action(identity)
  } catch (error) {
    return lifecycleFailure(context, error)
  }
}

function requesterFailure(context: { json(body: unknown, status: 401 | 403 | 503): Response }, error: unknown): Response {
  if (error instanceof RequesterIdentityError) return context.json({ error: error.code }, error.status)
  throw error
}

function lifecycleFailure(context: { json(body: unknown, status: 400 | 403 | 404 | 409 | 410 | 401 | 503): Response }, error: unknown): Response {
  if (error instanceof RequesterIdentityError) return requesterFailure(context, error)
  if (error instanceof RequestLifecycleError) return context.json({ error: error.code }, error.status)
  throw error
}

async function parse<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  try { return await parseInput(request,schema) } catch(error) { if(error instanceof NativeError && error.status===400)return null;throw error }
}

function now(): string {
  return new Date().toISOString()
}
