import {expect} from 'vitest'
import {withDevIdentity} from '../../base/modules/operator-auth/dev/index.mjs'
// @ts-expect-error The query keeps this real wrapper in Vitest's transformed module graph.
import {withDevIdentity as transformedDevIdentity} from '../../base/modules/operator-auth/dev/index.mjs?vitest'
import {createPennyApi} from '../../src/core/app/api'
import {devAuthConfig,devBindings} from '../../src/core/features/auth/dev-identity'
import type {AppBindings} from '../../src/core/shared/bindings'
import {call,env,messages,mockMail} from './support'

const origin='http://127.0.0.1:8787',api=createPennyApi()
const handler={fetch:async(request:Request,bindings:AppBindings):Promise<Response>=>api.fetch(request,bindings)}
// The built Worker's ESModule rule externalizes .mjs imports. Base's native
// imports and the transformed Penny adapter therefore hold separate module
// instances here. Run the real key-gated wrapper in each graph, as the single
// wrapper does for both consumers in the actual Vite dev bundle.
const transformedWrapper:typeof withDevIdentity=transformedDevIdentity
const transformed=transformedWrapper<AppBindings,typeof handler>(handler,{bindings:devBindings,config:devAuthConfig})
const worker=withDevIdentity<AppBindings,typeof transformed>(transformed,{bindings:devBindings,config:devAuthConfig})

export async function clearUpgradeDevAdmission(){
 // The real wrapper clears its registered gate when no dev key is configured.
 await worker.fetch(new Request(origin+'/auth/session'),{...env,RER_DEV_KEY:undefined})
}

// These credentials are issued by the real auth and integration routes on the
// predecessor schema. Only mail delivery is replaced at the network edge.
export async function priorUpgradeAuthority(operator:Record<string,string>) {
 mockMail()
 async function signIn(){
  expect((await call('/api/auth/magic-link',{email:'owner@penny.invalid'})).status).toBe(202)
  const token=new URL(messages.at(-1)!.url).searchParams.get('token')!
  const response=await call('/auth/confirm',{token})
  expect(response.status).toBe(303)
  const headers={Cookie:response.headers.get('Set-Cookie')!.split(';')[0]}
  const session=await call('/auth/session',undefined,headers)
  expect(session.status).toBe(200)
  const identity=await session.json() as {id:string;kind:string}
  expect(identity.kind).toBe('native')
  return {headers,id:identity.id}
 }
 const revoked=await signIn(),expired=await signIn()
 expect((await call('/api/auth/sign-out',{},revoked.headers)).status).toBe(204)
 // Advance just this genuine session past its expiry, without changing the
 // clock for unrelated historical publication or delivery records.
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=? WHERE id=?').bind(Date.now()-1,expired.id).run()
 async function issue(headers:Record<string,string>){
  const response=await call('/api/operator/integrations/keys',{name:'Upgrade ordinary credential',scopes:['requests:read']},headers)
  expect(response.status,await response.clone().text()).toBe(201)
  return await response.json() as {token:string;credential:{id:string}}
 }
 const ordinary=await issue(operator),revokedKey=await issue(operator)
 expect((await call('/api/operator/integrations/keys/'+revokedKey.credential.id,{},operator,'DELETE')).status).toBe(200)

 const devKey='synthetic-upgrade-dev-key-012345678901234567890123456789'
 const local={...env,PENNY_ENVIRONMENT:'local',APP_ORIGIN:origin,MAIL_PROVIDER:'development',SENDGRID_API_KEY:undefined,RESEND_API_KEY:undefined,RER_DEV_KEY:devKey}
 const gated={'x-rer-dev-key':devKey}
 async function localCall(path:string,body?:unknown,headers:Record<string,string>={}){
  return worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),local)
 }
 const entered=await localCall('/auth/dev/enter?as=owner',undefined,gated)
 expect(entered.status,await entered.clone().text()).toBe(303)
 const devSession={Cookie:entered.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>!value.startsWith('rer_dev_gate')).join('; ')}
 const issued=await localCall('/api/operator/integrations/keys',{name:'Upgrade dev credential',scopes:['requests:read']},{...devSession,...gated})
 expect(issued.status,await issued.clone().text()).toBe(201)
 const dev=await issued.json() as {token:string;credential:{id:string}}
 expect(await env.DB.prepare("SELECT id FROM oa_dev_credentials WHERE credential='integration_tokens' AND id=?").bind(dev.credential.id).first('id')).toBe(dev.credential.id)
 expect(await env.DB.prepare("SELECT id FROM oa_dev_credentials WHERE credential='integration_tokens' AND id=?").bind(ordinary.credential.id).first()).toBeNull()
 // Issuance is transient transaction custody, never a persisted permission.
 expect(await env.DB.prepare('SELECT count(*) n FROM penny_api_issuance').first('n')).toBe(0)

 return async()=>{
  expect((await call('/auth/session',undefined,operator)).status).toBe(200)
  for(const headers of [revoked.headers,expired.headers])expect((await call('/auth/session',undefined,headers)).status).toBe(401)
  expect((await call('/api/v1/requests',undefined,{Authorization:'Bearer '+ordinary.token})).status).toBe(200)
  expect((await call('/api/v1/requests',undefined,{Authorization:'Bearer '+revokedKey.token})).status).toBe(401)
  expect((await localCall('/auth/session',undefined,{...devSession,...gated})).status).toBe(200)
  expect((await localCall('/auth/session',undefined,devSession)).status).toBe(401)
  const devHeaders={Authorization:'Bearer '+dev.token}
  expect((await localCall('/api/v1/requests',undefined,{...devHeaders,...gated})).status).toBe(200)
  expect((await localCall('/api/v1/requests',undefined,devHeaders)).status).toBe(401)
  expect((await call('/api/v1/requests',undefined,devHeaders)).status).toBe(401)
  await clearUpgradeDevAdmission()
 }
}
