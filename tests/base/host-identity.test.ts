import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {createPennyApi} from '@/core/app/api'
import {base64urlEncode,sign} from '@/core/features/auth/tokens'
import {hostEmailHash} from '@/core/features/auth/host-custody'
import {observeD1} from './review-race-storage'
import {env,origin,owner,call} from './support'
const secret='test-only-host-server-signing-material',api=createPennyApi()
const bindings=()=>({...env,PORTAL_IDENTITY_SECRET:secret})
async function credential(overrides:Record<string,unknown>={},key=secret){
 const claim={aud:origin,issuedAt:new Date().toISOString(),email:'host@example.test',displayName:'Host person',...overrides}
 const encoded=base64urlEncode(new TextEncoder().encode(JSON.stringify(claim)))
 return {'X-Penny-Identity':encoded,'X-Penny-Identity-Signature':base64urlEncode(await sign(key,encoded))}
}
function host(headers:Record<string,string>,body:unknown={},options=bindings()){
 return api.fetch(new Request(origin+'/api/public/identity/host',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),options)
}
async function snapshot(){
 // Only IP admission bookkeeping is excluded. Product rows, auth attempts and
 // the native/import revision witnesses must all remain byte-for-byte equal.
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','penny_public_admission') ORDER BY name").all<{name:string}>()).results
 return (await env.DB.batch(names.map(({name})=>env.DB.prepare('SELECT * FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results)
}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
afterEach(()=>vi.restoreAllMocks())
it('[REQ-014 REQ-031 DATA-002] rejects invalid signed claims without writes or identity disclosure',async()=>{
 const before=await snapshot()
 for(const claim of [{aud:'https://wrong.example.test'},{issuedAt:new Date(Date.now()-25*3600000).toISOString()},{issuedAt:new Date(Date.now()+10*60000).toISOString()},{accountId:'unpaired'},{revenueCents:2},{accountId:'account',accountName:'Account',renewalDate:'2026-02-31'},{revenueCents:-1}]){
  const response=await host(await credential(claim));expect(response.status).toBe(401)
  expect(await response.json()).toEqual({error:'requester_identity_required'});expect(await snapshot()).toEqual(before)
 }
 expect((await host(await credential({},'wrong-test-key'))).status).toBe(401)
 expect((await host({...await credential(),Origin:'https://wrong.example.test'})).status).toBe(403)
 expect(await snapshot()).toEqual(before)
})
it('[REQ-014 REQ-031 EVID-006 BASE-ACCESS-002] accepts supplied account context only privately, with no email permission or operator authority',async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('Unexpected network effect')})
 const headers=await credential({accountId:'private-source-account',accountName:'Private supplied account',revenueCents:45678,renewalDate:'2026-11-01',health:'Supplied only'})
 expect((await host(headers)).status).toBe(200)
 expect((await host(headers)).status).toBe(200)
 expect(await env.DB.prepare('SELECT count(*) n FROM requesters').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT count(*) n FROM requester_account_links').first('n')).toBe(1)
 expect(await env.DB.prepare('SELECT revenue_cents,renewal_date,health FROM accounts').first()).toMatchObject({revenue_cents:45678,renewal_date:'2026-11-01',health:'Supplied only'})
 for(const name of ['requester_update_permissions','native_requester_sessions','native_magic_links','oa_operators','oa_sessions'])expect(await env.DB.prepare('SELECT count(*) n FROM '+name).first('n')).toBe(0)
 expect((await api.fetch(new Request(origin+'/api/operator/requests',{headers}),bindings())).status).toBe(401)
 const publicText=await(await api.fetch(new Request(origin+'/api/public/requests'),bindings())).text()
 for(const value of ['host@example.test','Private supplied account','45678','Supplied only'])expect(publicText).not.toContain(value)
 expect(network).not.toHaveBeenCalled()
 const rotated={...bindings(),PORTAL_IDENTITY_SECRET:'test-only-rotated-host-key'}
 const before=await snapshot();expect((await host(headers,{},rotated)).status).toBe(401);expect(await snapshot()).toEqual(before)
 expect((await host(await credential({email:'rotated@example.test'},rotated.PORTAL_IDENTITY_SECRET),{},rotated)).status).toBe(200)
})
it('[REQ-014 REQ-031 DATA-003] fences conflicting or older claims, erased identities and identity changes at the business transaction',async()=>{
 const issuedAt=new Date(Date.now()-1000).toISOString(),headers=await credential({issuedAt})
 expect((await host(headers)).status).toBe(200)
 const before=await snapshot()
 for(const claim of [{issuedAt,displayName:'Conflicting name'},{issuedAt:new Date(Date.now()-2000).toISOString()}])expect((await host(await credential(claim))).status).toBe(401)
 expect(await snapshot()).toEqual(before)
 const stamp=new Date().toISOString()
 await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp).run()
 let changed=false
 const db=observeD1(env.DB,{before:async sql=>{if(!changed&&sql.some(value=>value.includes('INSERT INTO requests('))){changed=true;await env.DB.prepare('UPDATE requesters SET blocked_at=?').bind(stamp).run()}}})
 const response=await api.fetch(new Request(origin+'/api/public/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({title:'A problem',description:'Original problem',boardSlug:'feedback',idempotencyKey:crypto.randomUUID()})}),{...bindings(),DB:db})
 expect(changed).toBe(true);expect(response.status).toBe(409)
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(0)
 await env.DB.prepare('UPDATE requesters SET blocked_at=NULL').run()
 const operator=await owner(),id=await env.DB.prepare('SELECT id FROM requesters').first<string>('id')
 const preview=await call('/api/operator/data/erasure/preview',{table:'requesters',id},operator)
 const {planHash}=await preview.json() as {planHash:string}
 expect((await call('/api/operator/data/erasure',{table:'requesters',id,planHash},operator)).status).toBe(200)
 expect(await env.DB.prepare('SELECT email_hash FROM host_identity_tombstones').first('email_hash')).toBe(await hostEmailHash('host@example.test'))
 const erased=await snapshot();expect((await host(await credential())).status).toBe(401);expect(await snapshot()).toEqual(erased)
})
it('[REQ-014 BASE-OPS-002 DATA-001] upgrades populated prior history with authority, revocation, files and all native records intact',async()=>{
 const migrations=inject('migrations'),boundary=migrations.findIndex(item=>item.name.startsWith('0019_'))
 await reset();await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 const {graph}=await import('./notification-regression-fixture'),{applyPreviousFeedback,feedbackFixture}=await import('./feedback-import-fixture')
 const g=await graph(2)
 await g.publish(0,'Preserved approved update')
 await applyPreviousFeedback(feedbackFixture('host-upgrade-history'),g.operator)
 expect(await env.DB.prepare('SELECT count(*) n FROM feedback_import_records').first('n')).toBe(19)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1').run()
 const before=await snapshot(),bytes=new Uint8Array([0,255,19]);await env.FILES.put('host-upgrade-original',bytes)
 const definitions=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','penny_public_admission') ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(definitions.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(column=>column.name)})))
 const read=async()=>(await env.DB.batch(tables.map(({name,columns})=>env.DB.prepare('SELECT '+columns.map(column=>'"'+column+'"').join(',')+' FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results)
 expect(await read()).toEqual(before)
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect(await read(),migration.name).toEqual(before)}
 await applyD1Migrations(env.DB,migrations);expect(await read()).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('host-upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 expect((await call('/auth/session',undefined,g.operator)).status).toBe(401)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})

it('[REQ-027 BASE-PUBLIC-002] persisted canonical embedding policy applies on the next document and never admits private frames',async()=>{
 const operator=await owner(),allowed='https://host.example.test',settings='/api/operator/settings/frames'
 expect((await call(settings,{publicOriginAllowlist:[allowed]},operator,'PUT')).status).toBe(200)
 expect(await(await call(settings,undefined,operator)).json()).toEqual({publicOriginAllowlist:[allowed]})
 expect(await(await call('/api/public/identity/host/frames')).json()).toEqual({origins:[allowed]})
 for(const path of ['/','/portal','/portal/','/portal/feedback','/portal/feedback/','/portal/feedback/not-found','/portal/feedback/not-found/','/portal/roadmap','/portal/updates/']){
  const response=await call(path,undefined,{Accept:'text/html'})
  expect(response.headers.get('content-security-policy'),path).toContain("frame-ancestors 'self' "+allowed)
  expect(response.headers.get('x-frame-options'),path).toBeNull()
  await response.body?.cancel()
 }
 for(const path of ['/signin','/setup','/app','/app/settings']){
  const response=await call(path,undefined,{...operator,Accept:'text/html'})
  expect(response.headers.get('content-security-policy'),path).toContain("frame-ancestors 'self'")
  expect(response.headers.get('content-security-policy'),path).not.toContain(allowed)
  await response.body?.cancel()
 }
 for(const bad of ['*','https://*.example.test','https://host.example.test/path','https://host.example.test/','https://user@host.example.test','data:text/html,x','null','http://host.example.test','https://host.example.test#x','https://host.example.test?x',' https://host.example.test']){
  expect((await call(settings,{publicOriginAllowlist:[bad]},operator,'PUT')).status,bad).toBe(400)
 }
 expect((await call(settings,{publicOriginAllowlist:[]},{},'PUT')).status).toBe(401)
 expect((await call(settings,{publicOriginAllowlist:[]},{...operator,Origin:'https://wrong.test'},'PUT')).status).toBe(403)
 expect(await(await call(settings,undefined,operator)).json()).toEqual({publicOriginAllowlist:[allowed]})
 expect((await call(settings,{publicOriginAllowlist:[]},operator,'PUT')).status).toBe(200)
 const revoked=await call('/');expect(revoked.headers.get('content-security-policy')).not.toContain(allowed);await revoked.body?.cancel()
 const audit=await env.DB.prepare("SELECT actor_id,occurred_at FROM audit_entries WHERE action='portal.frame_policy_replaced'").all<{actor_id:string;occurred_at:string}>()
 expect(audit.results).toHaveLength(2);expect(audit.results.every(row=>row.actor_id&&Number.isFinite(Date.parse(row.occurred_at)))).toBe(true)
})

it('[BASE-ACCESS-003] Worker entry shares bounded fail-closed admission across documents, auth, public reads and generated functions, with page assets bounded separately',async()=>{
 const {exports}=await import('cloudflare:workers'),{publicRatePolicy:policy,publicWriteRatePolicy:writePolicy,publicAssetRatePolicy:assetPolicy}=await import('@/core/app/public-rate')
 const ip='198.51.100.91',headers={'CF-Connecting-IP':ip,Origin:origin},wire=inject('generatedTransport') as Record<string,string>
 const paths=['/','/portal','/portal/','/portal/feedback','/portal/feedback/','/portal/feedback/activity','/portal/feedback/new','/portal/verify','/portal/feedback/missing','/portal/roadmap','/portal/roadmap/missing','/portal/updates','/portal/updates/missing','/docs','/docs/missing','/signin','/health','/favicon.ico','/api/auth/session','/api/auth/capabilities','/auth/session','/auth/confirm','/api/public/boards','/api/public/requests','/api/public/requests/suggestions?q=feature','/api/public/requests/missing','/api/public/roadmap','/api/public/releases','/api/public/releases/missing','/api/public/releases/missing/outcomes','/api/public/identity/session','/api/public/identity/host/frames','/api/public/branding','/api/public/attachments/missing','/api/public/requester/activity','/api/public/requester/notifications','/api/public/updates/subscription','/api/public/notifications/unsubscribe',...Object.values(wire)]
 const page=await call('/'),html=await page.text(),asset=html.match(/(?:src|href)="(\/assets\/[^"?]+)/)?.[1]
 expect(asset).toBeTruthy()
 for(let n=0;n<policy.allowance;n++){
  const response=await exports.default.fetch(new Request(origin+'/api/public/boards?attempt='+n,{headers}))
  expect(response.status,n.toString()).toBe(200);await response.body?.cancel()
 }
 for(const path of paths)for(const method of ['GET','HEAD','OPTIONS']){
  const response=await exports.default.fetch(new Request(origin+path,{method,headers:{...headers,'X-Forwarded-For':crypto.randomUUID()}}))
  expect(response.status,path+' '+method).toBe(429);expect(response.headers.get('Retry-After')).toBeTruthy();await response.body?.cancel()
 }
 // Page assets are not charged to page reads; they have their own per-client bucket.
 const assets=[asset!,'/rer-theme.css','/brand/penny-mark.svg','/fonts/fonts.css']
 for(const path of assets){const response=await exports.default.fetch(new Request(origin+path,{headers}));expect(response.status,path).toBe(200);await response.body?.cancel()}
 await env.DB.prepare('UPDATE penny_public_admission SET count=? WHERE scope=?').bind(assetPolicy.allowance,assetPolicy.scope).run()
 for(const path of assets){const response=await exports.default.fetch(new Request(origin+path,{headers}));expect(response.status,path).toBe(429);await response.body?.cancel()}
 for(const path of [wire.loadOperatorResources]){
  const response=await exports.default.fetch(new Request(origin+path,{method:'POST',headers,body:'{}'}));expect(response.status).toBe(429);await response.body?.cancel()
 }
 for(let n=0;n<writePolicy.allowance;n++){const response=await exports.default.fetch(new Request(origin+'/api/public/requests/missing',{method:'POST',headers}));expect(response.status).toBe(404);await response.body?.cancel()}
 expect((await exports.default.fetch(new Request(origin+'/api/public/identity/email',{method:'POST',headers,body:'{}'}))).status).toBe(429)
 expect((await exports.default.fetch(new Request(origin+'/api/public/boards',{headers:{...headers,'CF-Connecting-IP':'198.51.100.92'}}))).status).toBe(200)
 await env.DB.prepare('UPDATE penny_public_admission SET expires_at=? WHERE scope=?').bind(new Date(Date.now()-policy.windowMs).toISOString(),policy.scope).run()
 expect((await exports.default.fetch(new Request(origin+'/api/public/boards',{headers}))).status).toBe(200)
 // Storage failure happens at the real D1 boundary, before any protected read.
 await env.DB.exec("CREATE TRIGGER refuse_public_admission BEFORE INSERT ON penny_public_admission WHEN NEW.scope='public_entry' BEGIN SELECT RAISE(ABORT,'unavailable'); END")
 const failed=await exports.default.fetch(new Request(origin+'/api/public/boards',{headers:{...headers,'CF-Connecting-IP':'198.51.100.93'}}))
 expect(failed.status).toBe(503);expect(await failed.json()).toEqual({error:'public_admission_unavailable'})
})
