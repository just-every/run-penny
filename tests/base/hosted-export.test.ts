import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,expect,inject,it,vi} from 'vitest'
import {env} from 'cloudflare:workers'
import {createPennyApi} from '../../src/core/app/api'
import {exportArchive} from '../../src/core/features/data/archive'
import {digest,opaqueToken} from '../../src/core/features/auth/native-tokens'
import inventory from '../../src/core/features/data/schema-inventory.json'
const origin='https://penny.test',app=createPennyApi()
const bindings={...env,PENNY_ENVIRONMENT:'production',APP_ORIGIN:origin,MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined}
const call=(path:string,body?:unknown,headers:Record<string,string>={})=>app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1',...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings)
async function owner(){const r=await call('/auth/bootstrap',{token:bindings.SETUP_TOKEN,displayName:'Owner',returnTo:'/app'});expect(r.status).toBe(303);return {Cookie:r.headers.get('Set-Cookie')!.split(';')[0]}}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
it('[DATA-001 BASE-ACCESS-002] hosted data mutations and recovery require current native operator authority and the configured origin',async()=>{
 const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('Unexpected provider call')})
 const requesterToken=opaqueToken(),stamp=new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('hosted-person','Requester',?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('hosted-address','hosted-person','hosted@example.test',?,?,?)").bind(stamp,stamp,stamp),
  env.DB.prepare("INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES('hosted-session','hosted-person','hosted-address',?,?,?,?,?)").bind(await digest(requesterToken),new Date(Date.now()+60000).toISOString(),stamp,stamp,stamp),
 ])
 expect((await call('/api/public/identity/session',undefined,{Authorization:'Bearer '+requesterToken})).status).toBe(200)
 const mutations=['import','erasure/preview','erasure','operations/missing/resume','operations/missing/abort-restore','operations/missing/abort-export','operations/missing/abort-pending-erasure','operations/missing/recover-runner']
 try{
  for(const path of ['export','journal','overview','operations/missing']){
   expect((await call('/api/operator/data/'+path)).status).toBe(401)
   expect((await call('/api/operator/data/'+path,undefined,{Authorization:'Bearer '+requesterToken})).status).toBe(401)
  }
  for(const path of mutations){
   expect((await call('/api/operator/data/'+path,{})).status).toBe(401)
   expect((await call('/api/operator/data/'+path,{}, {Authorization:'Bearer '+requesterToken})).status).toBe(401)
  }
  const cookie=await owner()
  for(const path of ['export','journal']){
   const response=await call('/api/operator/data/'+path,undefined,cookie)
   expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(response.headers.get('Content-Disposition')).toContain('attachment;')
  }
  expect((await (await call('/api/operator/data/overview',undefined,cookie)).json() as {hosted:boolean}).hosted).toBe(true)
  for(const path of mutations){
   expect((await call('/api/operator/data/'+path,{}, {...cookie,Origin:'https://foreign.test'})).status).toBe(403)
   expect((await call('/api/operator/data/'+path,{}, {...cookie,Origin:''})).status).toBe(403)
  }
  const alias=await app.fetch(new Request('https://alias.test/api/operator/data/import',{method:'POST',headers:{...cookie,Origin:'https://alias.test','Content-Type':'application/json'},body:'{}'}),bindings)
  expect(alias.status).toBe(403)
  for(const path of ['import','erasure/preview','erasure'])expect((await call('/api/operator/data/'+path,{},cookie)).status).toBe(400)
  await env.DB.prepare('UPDATE oa_sessions SET expires_at=?').bind(Date.now()-1).run()
  for(const path of mutations)expect((await call('/api/operator/data/'+path,{},cookie)).status).toBe(401)
  for(const path of ['export','journal'])expect((await call('/api/operator/data/'+path,undefined,cookie)).status).toBe(401)
  await env.DB.prepare('UPDATE oa_sessions SET expires_at=?,revoked_at=?').bind(Date.now()+60000,Date.now()).run()
  for(const path of mutations)expect((await call('/api/operator/data/'+path,{},cookie)).status).toBe(401)
  for(const path of ['export','journal'])expect((await call('/api/operator/data/'+path,undefined,cookie)).status).toBe(401)
  expect(spy).not.toHaveBeenCalled()
 }finally{spy.mockRestore()}
})
it('[DATA-001 DATA-003] hosted empty-target restore and file erasure preserve preview and latest-journal fences',async()=>{
 const cookie=await owner(),empty=await (await call('/api/operator/data/export',undefined,cookie)).json() as Awaited<ReturnType<typeof exportArchive>>
 expect((await call('/api/operator/data/import',empty,cookie)).status).toBe(200)
 const stamp=new Date().toISOString(),requestId='hosted-request-root'
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('hosted-board','hosted-board','Board','public',0,?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES(?,?,'hosted-board','Unique request title','Unique private body','awaiting_review','open',?,?)").bind(requestId,requestId,stamp,stamp),
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('hosted-file',?,'hosted-original','Unique.bin','application/octet-stream',4,'operator_only',?,?)").bind(requestId,stamp,stamp),
 ])
 await env.FILES.put('hosted-original',new Uint8Array([1,2,3,4]))
 const archive=await (await call('/api/operator/data/export',undefined,cookie)).json() as Awaited<ReturnType<typeof exportArchive>>
 const occupied=await call('/api/operator/data/import',archive,cookie)
 expect(occupied.status).toBe(409);expect(await occupied.json()).toEqual({error:'restore_requires_empty_target'})
 const root={table:'requests',id:requestId},preview=await (await call('/api/operator/data/erasure/preview',root,cookie)).json() as {planHash:string;fileCount:number}
 expect(preview.fileCount).toBe(1)
 expect((await call('/api/operator/data/erasure',root,cookie)).status).toBe(400)
 await env.DB.prepare('UPDATE requests SET description=? WHERE id=?').bind('Updated private body',requestId).run()
 const stale=await call('/api/operator/data/erasure',{...root,planHash:preview.planHash},cookie)
 expect(stale.status).toBe(409);expect(await stale.json()).toEqual({error:'erasure_plan_changed'})
 const latest=await (await call('/api/operator/data/erasure/preview',root,cookie)).json() as {planHash:string}
 expect((await call('/api/operator/data/erasure',{...root,planHash:latest.planHash},cookie)).status).toBe(200)
 expect(await env.FILES.head('hosted-original')).toBeNull()
 expect(await env.DB.prepare('SELECT count(*) n FROM requests WHERE id=?').bind(requestId).first('n')).toBe(0)
 const old=await call('/api/operator/data/import',archive,cookie)
 expect(old.status).toBe(409);expect(await old.json()).toEqual({error:'erasure_journal_regression'})
 const journal=await (await call('/api/operator/data/journal',undefined,cookie)).json()
 const mismatched=await call('/api/operator/data/import',{archive:archive.archive,journal},cookie)
 expect(mismatched.status).toBe(409);expect(await mismatched.json()).toEqual({error:'stale_archive'})
})
it('[DATA-001] hosted archive includes every classified product table and exact original R2 bytes without installation authority',async()=>{
 const cookie=await owner(),stamp=new Date().toISOString(),bytes=new Uint8Array([0,255,31,80,68,70])
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('b','b','Board','public',0,?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('r','r','b','Title','Description','awaiting_review','open',?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('f','r','original','Original.bin','application/octet-stream',?,'operator_only',?,?)").bind(bytes.length,stamp,stamp),
 ])
 await env.FILES.put('original',bytes)
 const response=await call('/api/operator/data/export',undefined,cookie),snapshot=await response.json() as Awaited<ReturnType<typeof exportArchive>>
 expect(response.status).toBe(200)
 expect(Object.keys(snapshot.archive.tables).sort()).toEqual(Object.entries(inventory).filter(([,value])=>value.classification==='product').map(([name])=>name).sort())
 expect(Object.keys(snapshot.archive.tables)).toEqual(expect.arrayContaining(['decision_bet_snapshots','roadmap_update_versions','release_versions']))
 expect(snapshot.archive.tables.requests).toHaveLength(1);expect(snapshot.archive.tables.attachments).toHaveLength(1)
 expect(Uint8Array.from(atob(snapshot.archive.files[0].bytes),c=>c.charCodeAt(0))).toEqual(bytes)
 expect(snapshot.archive.files[0].sha256).toMatch(/^[a-f0-9]{64}$/)
 expect(JSON.stringify(snapshot)).not.toContain(cookie.Cookie.split('=')[1]);expect(JSON.stringify(snapshot)).not.toContain(bindings.AUTH_SECRET)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 await env.FILES.put('untracked','Untracked original')
 expect((await call('/api/operator/data/export',undefined,cookie)).status).toBe(503)
 await env.FILES.delete('untracked');await env.FILES.delete('original')
 expect((await call('/api/operator/data/export',undefined,cookie)).status).toBe(503)
})
// RER Managed installs with Platform's own ledger and no Wrangler d1_migrations.
const platformLedgerDdl='CREATE TABLE rer_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
async function managedInstall(appliedAt:string){
 await env.DB.batch([env.DB.prepare('DROP TABLE d1_migrations'),env.DB.prepare(platformLedgerDdl),...inject('platformLedger').map(({name,sha256})=>env.DB.prepare('INSERT INTO rer_migrations(name,sha256,applied_at) VALUES(?,?,?)').bind(name,sha256,appliedAt))])
}
const platformLedger=async()=>(await env.DB.prepare('SELECT name,sha256,applied_at FROM rer_migrations ORDER BY name').all()).results
async function refused(response:Response,error:string){expect(response.status).toBe(503);expect(await response.json()).toEqual({error})}
it('[DATA-001] a RER Managed archive round trips while each installation keeps its own validated Platform migration ledger and unknown schema is refused',async()=>{
 await managedInstall('2026-10-01 00:00:00')
 let cookie=await owner();const bytes=await seedOriginal(),source=await platformLedger()
 // v0.1.3 refused this database at the export door with unclassified_archive_schema.
 const response=await call('/api/operator/data/export',undefined,cookie)
 expect(response.status).toBe(200)
 const bundle=await response.json() as Awaited<ReturnType<typeof exportArchive>>
 expect(Object.keys(bundle.archive.tables)).not.toContain('rer_migrations')
 expect(JSON.stringify(bundle)).not.toContain(source[0].sha256 as string)
 expect(bundle.archive.tables.requests).toHaveLength(1)
 // The ledger is checked, not merely skipped: it must list exactly this revision's migrations and file hashes.
 const last=source.at(-1)!.name as string,first=source[0].name as string
 const tampering=[`UPDATE rer_migrations SET sha256='changed-sql-bytes' WHERE name='${first}'`,`UPDATE rer_migrations SET name='9999_unrecognized.sql' WHERE name='${first}'`,`UPDATE rer_migrations SET name='${last}#0-1' WHERE name='${last}'`,`DELETE FROM rer_migrations WHERE name='${last}'`]
 const untamper=()=>env.DB.batch([env.DB.prepare('DELETE FROM rer_migrations'),...source.map(row=>env.DB.prepare('INSERT INTO rer_migrations(name,sha256,applied_at) VALUES(?,?,?)').bind(row.name,row.sha256,row.applied_at))])
 for(const change of tampering){await env.DB.exec(change);await refused(await call('/api/operator/data/export',undefined,cookie),'migration_history_mismatch');await untamper()}
 // Only the exact ledger name is the host's; any other unknown table, rer_ or not, and any unknown column still refuse.
 for(const name of ['rer_migrations_future','unclassified_personal_data']){
  await env.DB.exec(`CREATE TABLE ${name}(id TEXT PRIMARY KEY,private_value TEXT)`)
  await refused(await call('/api/operator/data/export',undefined,cookie),'unclassified_archive_schema')
  await env.DB.exec(`DROP TABLE ${name}`)
 }
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 expect(await platformLedger()).toEqual(source)

 // A fresh Managed destination: a tampered ledger refuses the restore before anything is written.
 await reset();await applyD1Migrations(env.DB,inject('migrations'));await managedInstall('2026-10-19 00:00:00')
 cookie=await owner();const destination=await platformLedger()
 expect(destination).not.toEqual(source)
 for(const change of tampering){
  await env.DB.exec(change);const tampered=await platformLedger()
  await refused(await call('/api/operator/data/import',bundle,cookie),'migration_history_mismatch')
  expect(await platformLedger()).toEqual(tampered);await env.DB.batch([env.DB.prepare('DELETE FROM rer_migrations'),...destination.map(row=>env.DB.prepare('INSERT INTO rer_migrations(name,sha256,applied_at) VALUES(?,?,?)').bind(row.name,row.sha256,row.applied_at))])
 }
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect((await env.FILES.list()).objects).toHaveLength(0)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 expect((await call('/api/operator/data/import',bundle,cookie)).status).toBe(200)
 expect(await platformLedger()).toEqual(destination)
 expect(new Uint8Array(await (await env.FILES.get('race-original'))!.arrayBuffer())).toEqual(bytes)
 // Re-export from the destination is the same archive, apart from the destination's own restore audit entry.
 const again=await (await call('/api/operator/data/export',undefined,cookie)).json() as Awaited<ReturnType<typeof exportArchive>>
 const restoreAudit=again.archive.tables.audit_entries.filter(row=>row.action==='data.restored')
 expect(restoreAudit).toHaveLength(1)
 const body=({sha256,...rest}:typeof bundle.archive)=>{void sha256;return rest},restored=body(again.archive)
 expect({...restored,tables:{...restored.tables,audit_entries:restored.tables.audit_entries.filter(row=>row.action!=='data.restored')}}).toEqual(body(bundle.archive))
 expect(again.journal).toEqual(bundle.journal)
 expect(await platformLedger()).toEqual(destination)
 await env.DB.exec('ALTER TABLE requests ADD COLUMN unclassified_private TEXT')
 await refused(await call('/api/operator/data/export',undefined,cookie),'unclassified_archive_schema')
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
})

it('[DATA-001] held original-byte export fences writes and overlapping export until completion',async()=>{
 const cookie=await owner()
 let entered!:()=>void,release!:()=>void
 const started=new Promise<void>(r=>{entered=r}),held=new Promise<void>(r=>{release=r})
 const bucket=new Proxy(env.FILES,{get(target,key){if(key==='list')return async(...args:Parameters<R2Bucket['list']>)=>{entered();await held;return target.list(...args)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const exporting=exportArchive(env.DB,bucket);await started
 try{
  expect((await call('/api/operator/data/export',undefined,cookie)).status).toBe(409)
  await expect(env.DB.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('held','Held','now','now')").run()).rejects.toThrow('maintenance')
 }finally{release();await exporting}
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
})

function barrier(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve});return {promise,release}}
async function seedOriginal(){
 const stamp=new Date().toISOString(),bytes=new Uint8Array([11,22,33,44])
 await env.DB.batch([
  env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('race-board','race-board','Board','public',0,?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO requests(id,slug,board_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('race-request','race-request','race-board','Private race title','Private race body','awaiting_review','open',?,?)").bind(stamp,stamp),
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('race-file','race-request','race-original','Private.bin','application/octet-stream',4,'operator_only',?,?)").bind(stamp,stamp),
 ])
 await env.FILES.put('race-original',bytes)
 return bytes
}
async function dataState(){return env.DB.prepare('SELECT origin,epoch,phase,lock_id FROM data_state').first()}
async function operations(){return (await env.DB.prepare('SELECT * FROM data_operations ORDER BY id').all()).results}

it('[BASE-ACCESS-002 DATA-001] revocation during R2 export withholds the archive and releases its maintenance lock',async()=>{
 const cookie=await owner(),entered=barrier(),release=barrier()
 const bucket=new Proxy(env.FILES,{get(target,key){if(key==='list')return async(...args:Parameters<R2Bucket['list']>)=>{entered.release();await release.promise;return target.list(...args)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const pending=app.fetch(new Request(origin+'/api/operator/data/export',{headers:cookie}),{...bindings,FILES:bucket})
 await entered.promise
 try{expect((await call('/api/auth/sign-out',{},cookie)).status).toBe(204)}finally{release.release()}
 const response=await pending
 expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'unauthenticated'})
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 expect((await operations()).map(row=>row.status)).toEqual(['aborted'])
})

it.each(['sign-out','operator-version'] as const)('[BASE-ACCESS-002 DATA-001] %s during a restore R2 write refuses the apply transaction and keeps destination authority',async change=>{
 const cookie=await owner();await seedOriginal()
 const bundle=await (await call('/api/operator/data/export',undefined,cookie)).json() as Awaited<ReturnType<typeof exportArchive>>
 await env.DB.batch([env.DB.prepare('DELETE FROM attachments'),env.DB.prepare('DELETE FROM requests'),env.DB.prepare('DELETE FROM boards')])
 await env.FILES.delete('race-original')
 const before=await dataState(),entered=barrier(),release=barrier()
 // Pause at the original file's write; the staged backup is written before it.
 const bucket=new Proxy(env.FILES,{get(target,key){if(key==='put')return async(...args:Parameters<R2Bucket['put']>)=>{const value=await target.put(...args);if(args[0]==='race-original'){entered.release();await release.promise}return value};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const pending=app.fetch(new Request(origin+'/api/operator/data/import',{method:'POST',headers:{...cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(bundle)}),{...bindings,FILES:bucket})
 await entered.promise
 let authority:unknown
 try{
  expect(await env.FILES.head('race-original')).not.toBeNull()
  if(change==='sign-out')expect((await call('/api/auth/sign-out',{},cookie)).status).toBe(204)
  else await env.DB.prepare('UPDATE oa_operators SET version=version+1').run()
  authority=(await env.DB.prepare('SELECT * FROM oa_operators').all()).results
 }finally{release.release()}
 const response=await pending
 expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'unauthenticated'})
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM attachments').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM data_apply_claims').first('n')).toBe(0)
 expect(await env.FILES.head('race-original')).toBeNull()
 expect(await dataState()).toEqual(before)
 expect((await env.DB.prepare('SELECT * FROM oa_operators').all()).results).toEqual(authority)
 expect((await operations()).filter(row=>row.kind==='restore').map(row=>row.status)).toEqual(['aborted'])
})

it('[BASE-ACCESS-002 DATA-003] revocation during erasure file cleanup retains a pending operation for current-authority recovery',async()=>{
 const cookie=await owner();await seedOriginal()
 const root={table:'requests',id:'race-request'},plan=await (await call('/api/operator/data/erasure/preview',root,cookie)).json() as {planHash:string}
 const entered=barrier(),release=barrier()
 const bucket=new Proxy(env.FILES,{get(target,key){if(key==='delete')return async(...args:Parameters<R2Bucket['delete']>)=>{await target.delete(...args);entered.release();await release.promise};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 const pending=app.fetch(new Request(origin+'/api/operator/data/erasure',{method:'POST',headers:{...cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...root,planHash:plan.planHash})}),{...bindings,FILES:bucket})
 await entered.promise
 try{expect((await call('/api/auth/sign-out',{},cookie)).status).toBe(204)}finally{release.release()}
 const response=await pending
 expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'unauthenticated'})
 const saved=await operations();expect(saved).toHaveLength(1);expect(saved[0].status).toBe('pending_r2')
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'locked',lock_id:saved[0].id})
 expect(await env.DB.prepare('SELECT count(*) n FROM requests').first('n')).toBe(0)
 expect(await env.DB.prepare('SELECT count(*) n FROM data_tombstones').first('n')).toBeGreaterThan(0)
 expect((await call('/api/operator/data/operations/'+saved[0].id+'/resume',{},cookie)).status).toBe(401)
})
