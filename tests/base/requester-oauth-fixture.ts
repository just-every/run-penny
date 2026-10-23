import {explicitConsentBoard} from './explicit-consent-board'
import {expect,inject,vi} from 'vitest'
import {reset,applyD1Migrations} from 'cloudflare:test'
import {createPennyApi} from '@/core/app/api'
import {opaqueToken,digest} from '@/core/features/auth/native-tokens'
import {pkceChallenge} from '@/core/features/auth/oauth-routes'
import {env,origin,owner} from './support'
import type {Archive} from '@/core/features/data/archive'
export async function proveRequesterOAuth(){
 await reset();const migrations=inject('migrations') as {name:string;queries:string[]}[]
 await applyD1Migrations(env.DB,migrations.filter(row=>Number(row.name.slice(0,4))<89))
 const app=createPennyApi(),operator=await owner()
 const oldOwners=(await env.DB.prepare('SELECT * FROM oa_operators').all()).results
 await applyD1Migrations(env.DB,migrations);await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.prepare('SELECT * FROM oa_operators').all()).results).toEqual(oldOwners)
 // Google answers as a Workspace account whose hosted domain is the address's own, unless a case sets another.
 let email='synthetic-penny-google@example.test',verified=true,primary=true,edgeCalls=0,expireInFlight=false,hostedDomain:string|undefined|null=null
 const edge={send:async(wire:{url:string;method:string;body:string})=>{
  edgeCalls++
  if(wire.url.endsWith('/token')||wire.url.endsWith('/access_token')){expect(wire.method).toBe('POST');const form=new URLSearchParams(wire.body);expect(form.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);return {status:200,headers:{},body:JSON.stringify({access_token:'synthetic-penny-access',token_type:'bearer'})}}
  expect(wire.method).toBe('GET')
  if(expireInFlight)vi.setSystemTime(Date.now()+11*60000)
  if(wire.url==='https://openidconnect.googleapis.com/v1/userinfo')return {status:200,headers:{},body:JSON.stringify({email,email_verified:verified,hd:hostedDomain===null?email.split('@')[1]:hostedDomain,name:email.split('@')[0]})}
  expect(wire.url).toBe('https://api.github.com/user/emails')
  return {status:200,headers:{},body:JSON.stringify([{email,verified,primary}])}
 }}
 const bindings={...env,REQUESTER_GOOGLE_CLIENT_ID:'synthetic-penny-google-client',REQUESTER_GOOGLE_CLIENT_SECRET:'synthetic-penny-google-secret',REQUESTER_GITHUB_CLIENT_ID:'synthetic-penny-github-client',REQUESTER_GITHUB_CLIENT_SECRET:'synthetic-penny-github-secret',PENNY_LEARNING_EGRESS:edge}
 let ip=90
 const call=async(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST',configured=true)=>{
  const response=await app.fetch(new Request(origin+path,{method,headers:{Origin:origin,'CF-Connecting-IP':`192.0.2.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),configured?bindings:env)
  expect(response.headers.has('Set-Cookie')).toBe(false)
  return response
 }
 const read=async<T>(response:Promise<Response>,status=200):Promise<T>=>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
 expect(await read(call('/api/portal/oauth/providers'))).toEqual({providers:[]})
 expect((await call('/api/operator/settings/requester-oauth',{google:true,github:false},operator,'PUT',false)).status).toBe(409)
 await read(call('/api/operator/settings/requester-oauth',{google:true,github:true},operator,'PUT'))
 const started=async(provider='google',pendingToken?:string)=>{
  const verifier=opaqueToken(),result=await read<{state:string;url:string}>(call(`/api/portal/oauth/${provider}/start`,{challenge:await pkceChallenge(verifier),...(pendingToken?{pendingToken}:{})}))
  const url=new URL(result.url);expect(url.searchParams.get('redirect_uri')).toBe(origin+`/api/portal/oauth/${provider}/callback`)
  return {...result,verifier,code:'synthetic-penny-code'}
 }
 const complete=(state:Awaited<ReturnType<typeof started>>,provider='google')=>call(`/api/portal/oauth/${provider}/callback`,{state:state.state,code:state.code,verifier:state.verifier})
 await read<{slug:string}>(call('/api/operator/boards',{name:'Synthetic feedback',slug:'synthetic-penny-feedback',visibility:'public'},operator),201)
 await explicitConsentBoard('synthetic-penny-feedback',async(path,method,body)=>call(path,body,operator,method))
 const request=await read<{id:string;slug:string}>(call('/api/operator/requests',{title:'Synthetic Penny export',description:'Export reports',boardSlug:'synthetic-penny-feedback',evidenceIds:[]},operator),201)
 await env.DB.prepare("UPDATE requests SET public_title=title,public_description=description,public_state='open',moderation_state='approved',published_at=? WHERE id=?").bind(new Date().toISOString(),request.id).run()
 const pendingToken=opaqueToken()
 expect((await call(`/api/public/requests/${request.slug}/vote`,{emailUpdates:false},{'X-Penny-Pending-Token':pendingToken})).status).toBe(202)
 const state=await started('google',pendingToken)
 const returned=await call(`/api/portal/oauth/google/callback?state=${state.state}&code=synthetic-penny-code`);expect(returned.status).toBe(303)
 const session=await read<{token:string}>(complete(state))
 expect(await env.DB.prepare('SELECT count(*) n FROM request_votes').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT verified_at FROM requester_addresses WHERE email=?').bind(email).first('verified_at')).toBeTruthy()
 expect((await call('/api/public/identity/session',undefined,{Authorization:`Bearer ${session.token}`})).status).toBe(200)
 expect((await call('/api/operator/evidence',undefined,{Authorization:`Bearer ${session.token}`})).status).toBe(401)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_update_permissions').first('n')).toBe(0)
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN('penny_public_admission') ORDER BY name").all<{name:string}>()).results
 const snapshot=async()=>Promise.all(tables.map(async({name})=>(await env.DB.prepare(`SELECT * FROM "${name}"`).all()).results))
 const invalid=await started(),expired=await started()
 await env.DB.prepare("UPDATE penny_requester_oauth_states SET expires_at='2000-01-01' WHERE state_hash=?").bind(await digest(expired.state)).run()
 const before=await snapshot(),calls=edgeCalls
 for(const [candidate,provider]of [[state,'google'],[{...invalid,state:opaqueToken()},'google'],[invalid,'github'],[{...invalid,verifier:opaqueToken()},'google'],[expired,'google']] as const){expect((await complete(candidate,provider)).status).toBe(401);expect(await snapshot()).toEqual(before)}
 expect(edgeCalls).toBe(calls)
 const beforeSlow=(await env.DB.prepare('SELECT * FROM native_requester_sessions').all()).results
 const slow=await started();expireInFlight=true
 try{expect((await complete(slow)).status).toBe(401)}finally{expireInFlight=false;vi.useRealTimers()}
 expect((await env.DB.prepare('SELECT * FROM native_requester_sessions').all()).results).toEqual(beforeSlow)
 email='synthetic-penny-github@example.test'
 const held=opaqueToken(),heldHeaders={'X-Penny-Pending-Token':held}
 expect((await call(`/api/public/requests/${request.slug}/follow`,{},heldHeaders)).status).toBe(202)
 expect((await call(`/api/public/requests/${request.slug}/comments`,{body:'Synthetic Penny comment held for verification'},heldHeaders)).status).toBe(202)
 expect((await call('/api/public/requests',{title:'Synthetic Penny held submission',description:'A synthetic pending report request',boardSlug:'synthetic-penny-feedback',idempotencyKey:'synthetic-penny-held-submission',emailUpdates:false},heldHeaders)).status).toBe(202)
 expect(await read(complete(await started('github',held),'github'))).toMatchObject({rejectedPendingActions:0})
 expect(await env.DB.prepare('SELECT count(*) n FROM request_follows').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM request_comments WHERE body=?').bind('Synthetic Penny comment held for verification').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests WHERE title=?').bind('Synthetic Penny held submission').first('n')).toBe(1)
 const votesBeforeFallback=await env.DB.prepare('SELECT count(*) n FROM request_votes').first('n')
 // Unverified addresses, and verified Google addresses outside Gmail or their own Workspace domain, take the emailed link.
 for(const [index,[provider,providerVerified,hosted]] of ([['google',false,null],['github',false,null],['google',true,undefined],['google',true,'other.example.test']] as const).entries()){
  verified=providerVerified;hostedDomain=hosted;email=`synthetic-penny-unverified-${provider}-${index}@example.test`
  const queued=opaqueToken();expect((await call(`/api/public/requests/${request.slug}/vote`,{emailUpdates:false},{'X-Penny-Pending-Token':queued})).status).toBe(202)
  expect(await read(complete(await started(provider,queued),provider),202)).toEqual({fallback:true,emailLinkSent:true})
  expect(await env.DB.prepare('SELECT 1 FROM requester_addresses WHERE email=?').bind(email).first()).toBeNull()
  expect(await env.DB.prepare('SELECT 1 FROM native_magic_links WHERE email=? AND consumed_at IS NULL').bind(email).first()).toBeTruthy()
 }
 hostedDomain=null;verified=false
 expect(await env.DB.prepare('SELECT count(*) n FROM request_votes').first('n')).toBe(votesBeforeFallback)
 primary=false;expect(await read(complete(await started('github'),'github'),202)).toEqual({fallback:true,emailLinkSent:false});primary=true;verified=true
 email='owner@penny.invalid';const operatorRequester=await read<{token:string}>(complete(await started()))
 expect((await call('/api/operator/settings/operators',undefined,{Authorization:`Bearer ${operatorRequester.token}`})).status).toBe(401)
 const nativeOperators=await env.DB.prepare('SELECT count(*) n FROM oa_operators').first('n')
 await env.DB.prepare("INSERT INTO oa_domain_rules(domain,provider_id,created_by,created_at) SELECT 'sso.example.test','synthetic-penny-enterprise',id,? FROM oa_operators WHERE role='owner'").bind(Date.now()).run()
 email='synthetic-penny-sso@sso.example.test'
 const ssoRequester=await read<{token:string}>(complete(await started()))
 expect((await call('/api/operator/evidence',undefined,{Authorization:`Bearer ${ssoRequester.token}`})).status).toBe(401)
 expect(await env.DB.prepare('SELECT count(*) n FROM oa_operators').first('n')).toBe(nativeOperators)
 await env.DB.prepare('UPDATE requesters SET blocked_at=? WHERE id=(SELECT requester_id FROM requester_addresses WHERE email=?)').bind(new Date().toISOString(),email).run()
 expect((await complete(await started())).status).toBe(403)
 const portable=await read<{archive:Archive}>(call('/api/operator/data/export',undefined,operator))
 expect(portable.archive.tables.penny_requester_oauth.every(row=>row.enabled===0)).toBe(true)
 expect(portable.archive.tables).not.toHaveProperty('penny_requester_oauth_states')
 for(const value of [bindings.REQUESTER_GOOGLE_CLIENT_SECRET,bindings.REQUESTER_GITHUB_CLIENT_SECRET,bindings.REQUESTER_GOOGLE_CLIENT_ID,bindings.REQUESTER_GITHUB_CLIENT_ID])expect(JSON.stringify(portable)).not.toContain(value)
 await read(call('/api/operator/settings/requester-oauth',{google:false,github:false},operator,'PUT'))
 expect(await read(call('/api/portal/oauth/providers'))).toEqual({providers:[]})
 expect((await complete(invalid)).status).toBe(403)
 // Restore into a fresh installation; installation secrets and unfinished
 // authorization records never travel, and both portable switches stay off.
 await reset();await applyD1Migrations(env.DB,migrations)
 const destination=await owner()
 let response=await call('/api/operator/data/import',portable,destination)
 expect([200,202],await response.clone().text()).toContain(response.status)
 let result=await response.json() as {status:string;operationId:string}
 for(let step=0;result.status!=='complete'&&step<50;step++){response=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},destination);expect([200,202],await response.clone().text()).toContain(response.status);result=await response.json() as typeof result}
 expect(result.status).toBe('complete')
 expect(await read(call('/api/portal/oauth/providers',undefined,{},'GET',false))).toEqual({providers:[]})
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_requester_oauth_states').first('n')).toBe(0)
 const erasedEmail='synthetic-penny-google@example.test',person=await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(erasedEmail).first('requester_id')
 const preview=await read<{planHash:string;blockedCopies:unknown[]}>(call('/api/operator/data/erasure/preview',{table:'requesters',id:person},destination))
 expect(preview.blockedCopies).toEqual([])
 response=await call('/api/operator/data/erasure',{table:'requesters',id:person,planHash:preview.planHash},destination)
 expect([200,202],await response.clone().text()).toContain(response.status);result=await response.json() as typeof result
 for(let step=0;result.status!=='complete'&&step<50;step++){response=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},destination);expect([200,202],await response.clone().text()).toContain(response.status);result=await response.json() as typeof result}
 expect(result.status).toBe('complete')
 expect(JSON.stringify(await read(call('/api/operator/data/export',undefined,destination)))).not.toContain(erasedEmail)
}
