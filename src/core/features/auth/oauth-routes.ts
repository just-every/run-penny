import {z} from 'zod'
import type {Hono} from 'hono'
import type {OperatorMutationEnvironment} from '@/core/app/operator-mutations'
import {createUlid} from '@/core/shared/ulid'
import {parseInput,clientIp} from './native-routes'
import {digest,NativeError,opaqueToken,takeRateLimit} from './native-tokens'
import {oauthProvider,oauthEndpoints,oauthCredential,oauthEnabled,oauthIdentity} from './oauth-provider'
import {bindPendingRequesterActions} from '../requests/pending-actions'
import {issueNativeLink} from './native-service'
import {mintVerifiedRequester} from './verified-requester'
const opaque=z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const code=z.string().min(1).max(4096).regex(/^[^\r\n\x00]+$/)
export async function pkceChallenge(verifier:string){return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export function registerOAuthRoutes(app:Hono<OperatorMutationEnvironment>){
 app.get('/api/portal/oauth/providers',async c=>{c.header('Cache-Control','no-store');return c.json({providers:(await Promise.all(oauthProvider.options.map(async provider=>await oauthEnabled(c.get('runtime'),provider)?provider:null))).filter(Boolean)})})
 app.post('/api/portal/oauth/:provider/start',async c=>{
  const provider=oauthProvider.parse(c.req.param('provider')),runtime=c.get('runtime'),db=runtime.database.binding
  c.header('Cache-Control','no-store')
  if(!await oauthEnabled(runtime,provider))throw new NativeError('oauth_provider_disabled',403)
  const input=await parseInput(c.req.raw,z.object({challenge:opaque,pendingToken:opaque.optional()}).strict())
  await takeRateLimit(db,'requester_oauth_start',clientIp(c.req.raw),10,60000)
  const state=opaqueToken(),now=new Date().toISOString(),expires=new Date(Date.now()+600000).toISOString()
  await db.batch([db.prepare('DELETE FROM penny_requester_oauth_states WHERE expires_at<=?').bind(now),db.prepare('INSERT INTO penny_requester_oauth_states(state_hash,provider,challenge,pending_token,expires_at) VALUES(?,?,?,?,?)').bind(await digest(state),provider,input.challenge,input.pendingToken??null,expires)])
  const url=new URL(oauthEndpoints[provider].authorize)
  url.search=new URLSearchParams({client_id:oauthCredential(runtime,provider)!.id,redirect_uri:new URL(`/api/portal/oauth/${provider}/callback`,runtime.configuration.appOrigin).href,response_type:'code',scope:oauthEndpoints[provider].scope,state,code_challenge:input.challenge,code_challenge_method:'S256'}).toString()
  return c.json({url:url.href,state})
 })
 app.get('/api/portal/oauth/:provider/callback',async c=>{
  c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer')
  const provider=oauthProvider.parse(c.req.param('provider')),runtime=c.get('runtime'),state=opaque.parse(c.req.query('state')),authorizationCode=code.parse(c.req.query('code'))
  if(!await oauthEnabled(runtime,provider))throw new NativeError('oauth_provider_disabled',403)
  if(!await runtime.database.binding.prepare('SELECT 1 FROM penny_requester_oauth_states WHERE state_hash=? AND provider=? AND expires_at>? AND claim_id IS NULL').bind(await digest(state),provider,new Date().toISOString()).first())throw new NativeError('oauth_state_invalid',401)
  // The browser proves possession before the server exchanges this code. Neither
  // the code nor a requester token is persisted in a URL query or cookie.
  return c.redirect('/portal/verify#'+new URLSearchParams({oauth:provider,state,code:authorizationCode}).toString(),303)
 })
 app.post('/api/portal/oauth/:provider/callback',async c=>{
  c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer')
  const runtime=c.get('runtime'),db=runtime.database.binding,provider=oauthProvider.parse(c.req.param('provider'))
  if(!await oauthEnabled(runtime,provider))throw new NativeError('oauth_provider_disabled',403)
  const input=await parseInput(c.req.raw,z.object({state:opaque,code,verifier:opaque}).strict()),hash=await digest(input.state),challenge=await pkceChallenge(input.verifier),now=new Date().toISOString()
  const state=await db.prepare('SELECT pending_token AS pendingToken FROM penny_requester_oauth_states WHERE state_hash=? AND provider=? AND challenge=? AND expires_at>? AND claim_id IS NULL').bind(hash,provider,challenge,now).first<{pendingToken:string|null}>()
  if(!state)throw new NativeError('oauth_state_invalid',401)
  const claim=createUlid(),reserved=await db.prepare('UPDATE penny_requester_oauth_states SET claim_id=? WHERE state_hash=? AND provider=? AND challenge=? AND expires_at>? AND claim_id IS NULL RETURNING 1').bind(claim,hash,provider,challenge,now).all()
  if(reserved.results.length!==1)throw new NativeError('oauth_state_invalid',401)
  try{
   const identity=await oauthIdentity(runtime,provider,input.code,input.verifier)
   if(!await db.prepare('SELECT 1 FROM penny_requester_oauth_states WHERE state_hash=? AND claim_id=? AND expires_at>? AND EXISTS(SELECT 1 FROM penny_requester_oauth WHERE provider=? AND enabled=1)').bind(hash,claim,new Date().toISOString(),provider).first())throw new NativeError('oauth_state_invalid',401)
   if(!identity.verified){
    if(identity.email)await issueNativeLink(runtime,'requester',identity.email,identity.displayName,clientIp(c.req.raw),state.pendingToken??undefined)
    return c.json({fallback:true,emailLinkSent:!!identity.email},202)
   }
   const email=identity.email!
   if(await db.prepare('SELECT 1 FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=? AND r.blocked_at IS NOT NULL').bind(email).first())throw new NativeError('requester_blocked',403)
   const pendingEmailHash=state.pendingToken?await digest(`${state.pendingToken}:${email}`):null
   if(state.pendingToken&&await bindPendingRequesterActions(runtime.database,state.pendingToken,pendingEmailHash!,now)==='identity_mismatch')throw new NativeError('pending_identity_mismatch',409)
   const gate='EXISTS(SELECT 1 FROM penny_requester_oauth_states WHERE state_hash=? AND claim_id=? AND completed=1)'
   const update=db.prepare(`UPDATE penny_requester_oauth_states SET completed=1 WHERE state_hash=? AND claim_id=? AND completed=0 AND expires_at>? AND EXISTS(SELECT 1 FROM penny_requester_oauth WHERE provider=? AND enabled=1) AND NOT EXISTS(SELECT 1 FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=? AND r.blocked_at IS NOT NULL) RETURNING 1`).bind(hash,claim,new Date().toISOString(),provider,email)
   return c.json(await mintVerifiedRequester(runtime,{email,displayName:identity.displayName,pendingHash:state.pendingToken?await digest(state.pendingToken):null,pendingEmailHash},gate,[hash,claim],update))
  }finally{await db.prepare('DELETE FROM penny_requester_oauth_states WHERE state_hash=? AND claim_id=?').bind(hash,claim).run()}
 })
}
