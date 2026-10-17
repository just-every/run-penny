import { submissionBoard } from '../categories/category-policy'
import { mailReady } from '@/core/features/auth/mail'
import { existingVerifiedHostIdentity } from '@/core/features/auth/requester'
import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '@/core/shared/bindings'
import type { PennyRuntime } from '@/core/app/runtime'
import { currentOperator } from '@/core/features/auth/routes'
import { identityOrHold } from './public-routes'
import { parseInput } from '@/core/features/auth/native-routes'
import { NativeError,takeRateLimit } from '@/core/features/auth/native-tokens'
import { submitNativeRequest } from './native-submission'
import { decisionDatabase } from '../decisions/authority'
import { moderateNativeRequest } from './native-moderation'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
const title=z.string().trim().min(1).max(200),description=z.string().trim().min(1).max(10000),boardSlug=z.string().trim().min(1).max(160)
export function registerNativeRequestRoutes(app:Hono<Environment>):void{
  app.post('/api/public/requests',async c=>{
    const runtime=c.get('runtime')
    const input=await parseInput(c.req.raw,z.object({title,description,boardSlug,categoryId:z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u).nullable().optional(),proposedSolution:z.string().trim().max(5000).optional(),impactStatement:z.string().trim().max(5000).optional(),emailUpdates:z.boolean().optional(),idempotencyKey:z.string().min(16).max(128)}).strict())
    await submissionBoard(runtime.database,input.boardSlug,input.categoryId)
    // Existing verified identities need no new mail. First-time host provisioning
    // and anonymous holds retain the verification-transport admission boundary.
    const existingHost = !mailReady(runtime) && !/^Bearer [A-Za-z0-9_-]{43}$/.test(c.req.header('Authorization')??'')
      ? await existingVerifiedHostIdentity(runtime,c.req.raw) : undefined
    if(existingHost === null)throw new NativeError('mail_unavailable',503)
    const requester=await identityOrHold(c,{type:'submission',input:{...input,proposedSolution:input.proposedSolution??null,impactStatement:input.impactStatement??null,emailUpdates:input.emailUpdates??false}},existingHost)
    if(requester instanceof Response)return requester
    const address=await runtime.database.binding.prepare('SELECT id FROM requester_addresses WHERE requester_id=? AND email=? AND verified_at IS NOT NULL').bind(requester.requesterId,requester.verifiedEmail).first<{id:string}>()
    if(!address)throw new NativeError('requester_verification_required',401)
    const identity={id:requester.requesterId,addressId:requester.addressId??address.id,email:requester.verifiedEmail,displayName:requester.displayName,sessionId:requester.sessionId,verifiedAt:requester.verifiedAt,verificationSessions:requester.verificationSessions,hostEmailHash:requester.hostEmailHash,hostClaimHash:requester.hostClaimHash}
    await takeRateLimit(runtime.database.binding,'public_write_identity',identity.id,20,60000)
    return c.json(await submitNativeRequest(runtime.database,identity,input),201)
  })
  app.post('/api/operator/moderation/:slug',async c=>{
    const operator=await currentOperator(c);if(!operator)throw new NativeError('unauthenticated',401)
    const input=await parseInput(c.req.raw,z.discriminatedUnion('verdict',[
      z.object({verdict:z.literal('approved'),title,description,boardSlug,categoryId:z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/u).nullable().optional(),displayName:z.string().trim().min(1).max(160)}).strict(),
      z.object({verdict:z.literal('rejected'),notifyAuthor:z.boolean().optional(),reason:z.string().trim().min(1).max(2000)}).strict(),
    ]))
    const runtime=c.get('runtime'),binding=await decisionDatabase(runtime,c.req.raw)
    await moderateNativeRequest({...runtime,database:{...runtime.database,binding}},operator.id,c.req.param('slug'),input)
    return c.json({moderationState:input.verdict})
  })
}
