import { previousNotificationGraph } from './previous-notification-fixture'
import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,expect,inject,it} from 'vitest'
import {Buffer} from 'node:buffer'
import {createPennyApi} from '@/core/app/api'
import {publicRatePolicy,publicWriteRatePolicy} from '@/core/app/public-rate'
import {digest} from '@/core/features/auth/native-tokens'
import {env,origin,owner,call} from './support'
import type {AppBindings} from '@/core/shared/bindings'
const issuer='https://management.example.test',installationId='test-penny-installation',claimIp='192.0.2.31'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
async function fixture(){
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey)
 // Installation identity also enables editor document headers, so managed
 // owner claims need the installation's management origin alongside its ID.
 const bindings={...env,RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({test:publicKey}),RER_INSTALLATION_ID:installationId,RER_MANAGEMENT_ORIGIN:issuer} as AppBindings
 const api=createPennyApi()
 const request=(body?:unknown,headers:Record<string,string>={})=>api.fetch(new Request(origin+'/auth/owner-claim',{method:body===undefined?'GET':'POST',headers:{Host:'penny.test',Origin:origin,'CF-Connecting-IP':claimIp,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings)
 async function signed(overrides:Record<string,unknown>={}){
  const now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:'ES256',typ:'rer-owner-claim+jwt',kid:'test'})).toString('base64url')
  const payload=Buffer.from(JSON.stringify({v:1,iss:issuer,aud:origin,installationId,email:'owner@penny.invalid',jti:crypto.randomUUID(),iat:now,exp:now+240,...overrides})).toString('base64url')
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(header+'.'+payload))
  return header+'.'+payload+'.'+Buffer.from(signature).toString('base64url')
 }
 return {request,signed}
}
async function authority(){return Object.fromEntries(await Promise.all(['oa_operators','oa_sessions','oa_bootstrap','oa_limits','oc_owner_claims'].map(async table=>[table,await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first('n')])))}
it('[BASE-ACCESS-004][OWN-001] rejects invalid claim credentials before authority writes and keeps confirmation read-only',async()=>{
 const {request,signed}=await fixture(),before=await authority(),confirmation=await request()
 const error=confirmation.status===200?undefined:((await confirmation.json()) as {error?:string}).error
 expect(confirmation.status,error).toBe(200);expect(await authority()).toEqual(before)
 for(const fields of [{aud:'https://foreign.example.test'},{iss:'https://foreign.example.test'},{email:'other@example.test'},{installationId:'other-installation'},{iat:1,exp:2}]){
  expect((await request({token:await signed(fields)})).status).toBe(403);expect(await authority()).toEqual(before)
 }
 const valid=await signed(),parts=valid.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1)
 expect((await request({token:parts.join('.')})).status).toBe(403)
 expect((await request({token:valid},{Origin:'https://foreign.example.test'})).status).toBe(403)
 expect(await authority()).toEqual(before)
})
it('[OWN-001][BASE-ACCESS-002] admits exactly one concurrent native owner, retains the session and refuses replay or a second claim',async()=>{
 const {request,signed}=await fixture(),token=await signed()
 const responses=await Promise.all([request({token,displayName:'Owner',returnTo:'/app'}),request({token,displayName:'Owner',returnTo:'/app'})])
 expect(responses.filter(r=>r.status===303)).toHaveLength(1)
 expect(responses.filter(r=>r.status===409||r.status===503)).toHaveLength(1)
 const successful=responses.find(r=>r.status===303)!,cookie=successful.headers.get('Set-Cookie')!.split(';')[0]
 expect((await call('/auth/session',undefined,{Cookie:cookie})).status).toBe(200)
 expect((await authority()).oa_operators).toBe(1);expect((await authority()).oa_sessions).toBe(1);expect((await authority()).oc_owner_claims).toBe(1)
 const before=await authority()
 expect((await request({token})).status).toBe(409);expect((await request({token:await signed()})).status).toBe(409)
 expect(await authority()).toEqual(before)
 expect(JSON.stringify((await env.DB.prepare('SELECT * FROM oc_owner_claims').all()).results)).not.toContain(token)
})
it('[OWN-001][BASE-ACCESS-004] preserves setup-token bootstrap and refuses takeover of its existing owner',async()=>{
 const operator=await owner(),before=await authority(),{request,signed}=await fixture()
 expect((await request({token:await signed()})).status).toBe(409)
 expect(await authority()).toEqual(before);expect((await call('/auth/session',undefined,operator)).status).toBe(200)
})
it('[OWN-001][BASE-OPS-002][DATA-001] upgrades populated native and imported history without resetting authority, revocation or original files',async()=>{
 const migrations=inject('migrations'),boundary=migrations.findIndex(migration=>migration.name.startsWith('0018_'))
 await reset();await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 const {time}=await import('./notification-regression-fixture'),{populateLegacyRelease}=await import('./legacy-release-fixture')
 const {applyPreviousFeedback,feedbackFixture}=await import('./feedback-import-fixture')
 const g=await previousNotificationGraph(2)
 await g.vote(0)
 expect(await env.DB.prepare('SELECT requester_id FROM request_votes WHERE request_id=?').bind(g.requests[0].id).first('requester_id')).toBe(g.recipient.requesterId)
 expect((await call('/api/operator/requests/'+g.requests[1].slug+'/merge',{targetSlug:g.requests[0].slug},g.operator)).status).toBe(200)
 await g.publish(0,'Preserved approved update')
 const release=await populateLegacyRelease(env.DB,g.requests[0].id,time())
 await applyPreviousFeedback(feedbackFixture('owner-upgrade-history'),g.operator)
 expect(await env.DB.prepare('SELECT count(*) n FROM feedback_import_records').first('n')).toBe(19)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1').run()
 const bytes=new Uint8Array([0,255,17,18]);await env.FILES.put('owner-upgrade-original',bytes)
 const definitions=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(definitions.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(column=>column.name)})))
 const read=()=>env.DB.batch<Record<string,unknown>>(tables.map(({name,columns})=>env.DB.prepare('SELECT '+columns.map(column=>'"'+column+'"').join(',')+' FROM "'+name+'" ORDER BY rowid')))
 const before=(await read()).map(result=>result.results)
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect((await read()).map(result=>result.results),migration.name).toEqual(before)}
 await applyD1Migrations(env.DB,migrations);expect((await read()).map(result=>result.results)).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('owner-upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 const admissionStarted=Date.now()
 expect((await call('/auth/session',undefined,{...g.operator,'CF-Connecting-IP':claimIp})).status).toBe(401)
 const {request,signed}=await fixture();expect((await request({token:await signed()})).status).toBe(409)
 // Both denied HTTP requests still consume public admission. Account for each
 // exact new bucket while retaining byte equality for every historical row.
 const after=(await read()).map(result=>result.results),admissionIndex=tables.findIndex(table=>table.name==='penny_public_admission'),subjectHash=await digest(claimIp)
 const newBuckets=after[admissionIndex].filter(row=>row.subject_hash===subjectHash)
 expect(before[admissionIndex].filter(row=>row.subject_hash===subjectHash)).toEqual([])
 expect(newBuckets).toHaveLength(2)
 for(const policy of [publicRatePolicy,publicWriteRatePolicy]){
  const bucket=newBuckets.find(row=>row.scope===policy.scope)!
  expect(bucket).toEqual({scope:policy.scope,subject_hash:subjectHash,count:1,expires_at:expect.any(String)})
  expect(Date.parse(bucket.expires_at as string)).toBeGreaterThanOrEqual(admissionStarted+policy.windowMs)
  expect(Date.parse(bucket.expires_at as string)).toBeLessThanOrEqual(Date.now()+policy.windowMs)
 }
 const expected=structuredClone(before);expected[admissionIndex].push(...newBuckets)
 expect(after).toEqual(expected)
 const published=await call('/api/public/releases/'+release.slug)
 expect(published.status).toBe(200);expect(await published.json()).toMatchObject(release)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
