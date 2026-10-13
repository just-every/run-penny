import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '@/core/shared/bindings'
import type { PennyRuntime } from '@/core/app/runtime'
import { issueNativeLink, consumeNativeLink, authenticateNativeRequester } from './native-service'
import { mailTransport } from './mail'
import { NativeError } from './native-tokens'
import {requireRequesterIdentity,existingVerifiedHostIdentity} from './requester'
import {mailReady} from './mail'
import {verifyHostClaims} from './host-claims'
import {hostFrameOrigins} from './host-frames'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
const email=z.string().trim().toLowerCase().email().max(254)
const token=z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export function registerNativeAuthRoutes(app:Hono<Environment>):void {
  app.get('/api/public/identity/host/frames',c=>c.json({origins:hostFrameOrigins(c.get('runtime'))}))
  app.post('/api/public/identity/host',async c=>{
    const runtime=c.get('runtime'),claims=await verifyHostClaims(runtime,c.req.header('X-Penny-Identity')??'',c.req.header('X-Penny-Identity-Signature')??'')
    if(c.req.header('Origin')!==runtime.configuration.appOrigin||c.req.header('Authorization'))return c.json({error:'requester_identity_required'},401)
    await parseInput(c.req.raw,z.object({}).strict())
    const existing=!mailReady(runtime)?await existingVerifiedHostIdentity(runtime,c.req.raw):undefined
    if(existing===null)throw new NativeError('mail_unavailable',503)
    const person=await requireRequesterIdentity(runtime,c.req.raw,existing)
    return c.json({displayName:person.displayName,expiresAt:Date.parse(claims.issuedAt)+24*60*60*1000})
  })
  app.get('/api/auth/capabilities',c=>c.json({transport:mailTransport(c.get('runtime'))}))
  app.post('/api/public/identity/email',async c=>{
    const input=await parseInput(c.req.raw,z.object({email,displayName:z.string().trim().min(1).max(160),pendingToken:token.optional()}).strict())
    await issueNativeLink(c.get('runtime'),'requester',input.email,input.displayName,clientIp(c.req.raw),input.pendingToken)
    return c.json({accepted:true},202)
  })
  app.post('/api/public/identity/email/verify',async c=>{
    const input=await parseInput(c.req.raw,z.object({token}).strict())
    const session=await consumeNativeLink(c.get('runtime'),'requester',input.token)
    return c.json({token:session.token,displayName:session.displayName,rejectedPendingActions:session.rejectedPendingActions})
  })
  app.get('/api/public/identity/session',async c=>{
    const identity=await authenticateNativeRequester(c.get('runtime'),bearer(c.req.raw))
    return c.json({displayName:identity.displayName})
  })
}
export function bearer(request:Request):string|null { return /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization')??'')?.[1]??null }
export function clientIp(request:Request):string {return request.headers.get('CF-Connecting-IP')??'local'}
export async function parseInput<T>(request:Request,schema:z.ZodType<T>,maxBytes=32768):Promise<T>{
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new NativeError('validation_failed',400)
  const reader=request.body?.getReader()
  if(!reader) throw new NativeError('validation_failed',400)
  let bytes=0,text=''
  const decoder=new TextDecoder()
  try {
    while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength
      if(bytes>maxBytes){await reader.cancel();throw new NativeError('validation_failed',400)}
      text+=decoder.decode(part.value,{stream:true})
    }
    text+=decoder.decode()
  } finally { reader.releaseLock() }
  try {return schema.parse(JSON.parse(text))} catch {throw new NativeError('validation_failed',400)}
}
