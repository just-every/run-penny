import type { Hono } from 'hono'
import { z } from 'zod'
import type { AppBindings } from '@/core/shared/bindings'
import type { PennyRuntime } from '@/core/app/runtime'
import { issueNativeLink, consumeNativeLink, authenticateNativeRequester, localAuthReady } from './native-service'
import { NativeError, digest } from '@/core/features/auth/native-tokens'
import { readOperatorSessionToken, OPERATOR_SESSION_COOKIE } from './session'
type Environment={Bindings:AppBindings;Variables:{runtime:PennyRuntime}}
const email=z.string().trim().toLowerCase().email().max(254)
const token=z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export function registerNativeAuthRoutes(app:Hono<Environment>):void {
  app.get('/api/auth/capabilities',c=>c.json({transport:localAuthReady(c.get('runtime'))?'local-outbox':'unavailable'}))
  app.post('/api/auth/magic-link',async c=>{
    const input=await parseInput(c.req.raw,z.object({email}).strict())
    await issueNativeLink(c.get('runtime'),'operator',input.email,null,clientIp(c.req.raw))
    return c.json({accepted:true},202)
  })
  app.get('/api/auth/magic-link/consume',async c=>{
    const parsed=token.safeParse(c.req.query('token'))
    if(!parsed.success) throw new NativeError('invalid_magic_link',401)
    const session=await consumeNativeLink(c.get('runtime'),'operator',parsed.data)
    c.header('Set-Cookie',`${OPERATOR_SESSION_COOKIE}=${session.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`)
    c.header('Referrer-Policy','no-referrer')
    return c.redirect('/app',302)
  })
  app.post('/api/auth/sign-out',async c=>{
    const session=readOperatorSessionToken(c.req.header('Cookie')??null)
    if(session) await c.env.DB.prepare('UPDATE operator_sessions SET revoked_at=?,updated_at=? WHERE token_hash=?').bind(new Date().toISOString(),new Date().toISOString(),await digest(session)).run()
    c.header('Set-Cookie',`${OPERATOR_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
    return c.body(null,204)
  })
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
