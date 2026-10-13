import {Buffer} from 'node:buffer'
import { applyD1Migrations,reset,type D1Migration } from 'cloudflare:test'
import { afterEach,expect,inject,it,vi } from 'vitest'
import { env,call,owner } from './support'
import { graph,time } from './notification-regression-fixture'
import { populateLegacyRelease } from './legacy-release-fixture'
import { importPennySample } from '@/core/features/sample-data/service'
import { createDatabaseConnection } from '@/core/platform/database'
import sample from '../../sample-data/penny.v1.json'
import { populateLegacyFeedback } from './legacy-feedback-fixture'
import { feedbackFixture,complete,apply,importPath } from './feedback-import-fixture'
import { exportArchive,type Row } from '@/core/features/data/archive'
import { d1ReversalFenceSchema } from '../../base/modules/import-kit/src/d1/index'
afterEach(()=>vi.restoreAllMocks())
it('[IMP-001][BASE-ACCESS-002][DATA-001] upgrades the populated complete predecessor without changing authority, history or files',async()=>{
 await reset();const migrations=inject('migrations') as D1Migration[],boundary=migrations.findIndex(m=>m.name.startsWith('0017_'))
 await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 await importPennySample(createDatabaseConnection(env.DB),sample)
 const g=await graph(2)
 expect((await call('/api/public/requests/'+g.requests[0].slug+'/vote',{},g.person)).status).toBe(204)
 expect((await call('/api/operator/requests/'+g.requests[0].slug+'/comments',{body:'Preserved operator comment'},g.operator)).status).toBe(201)
 expect((await call('/api/operator/requests/'+g.requests[1].slug+'/merge',{targetSlug:g.requests[0].slug},g.operator)).status).toBe(200)
 await g.publish(0,'Preserved published update')
 const release=await populateLegacyRelease(env.DB,g.requests[0].id,time())
 await env.DB.batch([
  env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('import-upgrade-file',?,'preserved-import-upgrade-file','Original.bin','application/octet-stream',4,'operator_only',?,?)").bind(g.requests[0].id,time(),time()),
  env.DB.prepare("INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(1,'requests',?)").bind('b'.repeat(64)),env.DB.prepare('UPDATE data_state SET epoch=1'),
  env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('previous-complete-export','export','complete','{}',?,?)").bind(time(),time()),
  env.DB.prepare('UPDATE oa_sessions SET revoked_at=1'),
 ])
 const bytes=new Uint8Array([0,255,17,18]);await env.FILES.put('preserved-import-upgrade-file',bytes)
 const definitions=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(definitions.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(c=>c.name)})))
 const read=()=>env.DB.batch(tables.map(t=>env.DB.prepare('SELECT '+t.columns.map(c=>'"'+c+'"').join(',')+' FROM "'+t.name+'" ORDER BY rowid')))
 const before=(await read()).map(r=>r.results)
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect((await read()).map(r=>r.results),migration.name).toEqual(before)}
 await applyD1Migrations(env.DB,migrations);expect((await read()).map(r=>r.results)).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('preserved-import-upgrade-file'))!.arrayBuffer())).toEqual(bytes)
 expect((await call('/auth/session',undefined,g.operator)).status).toBe(401)
 const published=await call('/api/public/releases/'+release.slug)
 expect(published.status).toBe(200);expect(await published.json()).toMatchObject(release)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('[IMP-003][IMP-004][DATA-001] upgrades previous-head saved checkpoints, preserves custody and resumes and reverses them',async()=>{
 await reset();const migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name.startsWith('0026_'))
 await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 const operator=await owner(),source=feedbackFixture('legacy-import-checkpoint')
 const partial=await populateLegacyFeedback(source,operator,true)
 expect(partial.state).toBe('applying')
 const original=new Uint8Array([0,255,13,10]);await env.FILES.put('legacy-import-file',original)
 const definitions=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const tables=await Promise.all(definitions.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(column=>column.name)})))
 const read=async()=>(await env.DB.batch(tables.map(({name,columns})=>env.DB.prepare('SELECT '+columns.map(column=>'"'+column+'"').join(',')+' FROM "'+name+'" ORDER BY rowid')))).map(r=>r.results)
 const before=await read()
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM evidence_items').first('n')).toBeGreaterThan(0)
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect(await read(),migration.name).toEqual(before)}
 await applyD1Migrations(env.DB,migrations);expect(await read()).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('legacy-import-file'))!.arrayBuffer())).toEqual(original)
 expect((await call('/auth/session',undefined,operator)).status).toBe(200)
 await env.FILES.delete('legacy-import-file')
 const job=await complete(partial,operator);expect((await apply(source,operator)).id).toBe(job.id)
 const saved=await exportArchive(env.DB,env.FILES);expect(saved.archive.tables.ik_jobs).toHaveLength(1)
 const undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status,await undo.clone().text()).toBe(200)
 expect((await complete(await undo.json() as typeof partial,operator)).state).toBe('undone')
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
},60000)
// 0034 is the Canny move-in head; 0038 adds UserVoice supporter types to a
// database already holding finished Canny jobs at the previous main.
it.each(['0034_','0038_'])('[IMP-003][IMP-007][IMP-008][DATA-001] upgrades populated main from migration %s with applied and undone classic receipts, saved work and opaque erasure fences',async first=>{
 await reset();const migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name.startsWith(first));await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 // The current engine's undo reads the reversal fence table, so make the undone job with it present, then remove it: the
 // upgrade must meet a finished and an undone job from before migration 0039 and install the table over them.
 for(const statement of d1ReversalFenceSchema)await env.DB.prepare(statement).run()
 const {populateFeedback,exportFeedbackFixture}=await import('./feedback-import-fixture'),{importContext}=await import('@/core/features/imports/service'),{runtime}=await import('./notification-regression-fixture'),{undoD1Import,resumeD1Import}=await import('../../base/modules/import-kit/src/d1/index')
 const operator=await owner(),source=exportFeedbackFixture('main-applied'),applied=await populateFeedback(source,operator),reversedSource=exportFeedbackFixture('main-undone'),initial=await populateFeedback(reversedSource,operator)
 const {context}=await importContext(runtime(),new Request('https://penny.test'+importPath+'/jobs/'+initial.id+'/undo',{method:'POST',headers:{Origin:'https://penny.test',...operator}}),reversedSource.namespace,true)
 let undone=await undoD1Import(initial.id,context);for(let i=0;i<20&&undone.state!=='undone';i++)undone=await resumeD1Import(undone.id,context);expect(undone.state).toBe('undone')
 await env.DB.prepare('DROP TABLE ik_d1_reversal_fences').run()
 const pending=await populateFeedback(feedbackFixture('main-saved-plan'),operator,true);expect(pending.state).toBe('applying')
 const erasedSource={namespace:'main-erased',statuses:{},files:[{name:'erased-person.json',kind:'users' as const,version:'v2' as const,base64:Buffer.from(JSON.stringify({users:[{id:'previous-person',name:'Previous erased person',created:'2024-07-08T09:10:11.000Z'}]})).toString('base64')}]}
 await populateFeedback(erasedSource,operator)
 const {stableFeedbackId}=await import('@/core/features/imports/mapping-support'),{eraseD1ImportTarget}=await import('../../base/modules/import-kit/src/d1/index'),{digest}=await import('@/core/features/auth/native-tokens')
 const erasedId=stableFeedbackId(erasedSource.namespace,'users','previous-person'),privacy=await importContext(runtime(),new Request('https://penny.test'+importPath,{method:'POST',headers:{Origin:'https://penny.test',...operator}}),erasedSource.namespace)
 await privacy.context.storage.targets.read(privacy.context.storage.database,'penny-feedback','users',erasedId)
 await eraseD1ImportTarget('users',erasedId,privacy.context.storage.targets.remove('penny-feedback','users',erasedId),{...privacy.context,originalErasurePolicy:'withdraw-all-job-artifacts'})
 const dataOrigin=await env.DB.prepare('SELECT origin FROM data_state').first<string>('origin')
 await env.DB.batch([env.DB.prepare("INSERT INTO feedback_import_tombstones(target_kind,target_id) VALUES('users',?)").bind(erasedId),env.DB.prepare("INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(1,'requesters',?)").bind(await digest(JSON.stringify([dataOrigin,'requesters',JSON.stringify([erasedId])]))),env.DB.prepare('UPDATE data_state SET epoch=1')])
 await env.DB.batch([env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES('previous-erasure','erase','complete','{}','2024-07-08T09:10:11.000Z','2024-07-08T09:10:11.000Z')"),env.DB.prepare("INSERT INTO data_apply_claims(operation_id) VALUES('previous-erasure')")])
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_erased_sources').first('n')).toBeGreaterThan(0);expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_erased_targets').first('n')).toBeGreaterThan(0)

 const bytes=new Uint8Array([0,255,13,10,195,169]);await env.FILES.put('upgrade-original',bytes)
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const read=async()=>(await env.DB.batch(tables.map(({name})=>env.DB.prepare('SELECT * FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results)
 const before=await read()
 for(const migration of migrations.slice(boundary)){
  const present=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
  const projections=await Promise.all(present.map(async({name})=>({name,columns:(await env.DB.prepare('PRAGMA table_info("'+name+'")').all<{name:string}>()).results.map(column=>column.name)})))
  const priorRows=async()=>(await env.DB.batch(projections.map(({name,columns})=>env.DB.prepare('SELECT '+columns.map(column=>'"'+column+'"').join(',')+' FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results),previous=await priorRows()
  await applyD1Migrations(env.DB,[migration]);expect(await priorRows(),migration.name).toEqual(previous)
 }
 expect(await read()).toEqual(before);await applyD1Migrations(env.DB,migrations);expect(await read()).toEqual(before)
 expect(new Uint8Array(await(await env.FILES.get('upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 for(const [job,phase]of [[applied,'completed'],[undone,'undone']] as const){const response=await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator);expect(response.status,await response.clone().text()).toBe(200);expect(await response.json()).toMatchObject({phase,effects:{mail:0,notifications:0}})}
 const originals=await(await call(importPath+'/jobs/'+applied.id+'/originals',undefined,operator)).json() as {name:string;original:{base64:string}}[]
 for(const file of source.files)expect(originals.find(row=>row.name===file.name)?.original.base64).toBe(file.base64)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 const reviewed=await (await call(importPath+'/preview',erasedSource,operator)).json() as {fingerprint:string};expect((await call(importPath+'/apply',{source:erasedSource,fingerprint:reviewed.fingerprint},operator)).status).toBe(422);expect(await env.DB.prepare('SELECT 1 FROM requesters WHERE id=?').bind(erasedId).first()).toBeNull()
 // Base 479094f: undo of a job applied before the fence table existed completes, the saved plan resumes, and erasing
 // one imported person writes a journal receipt of row counts (no value) while the other jobs still undo and resume.
 expect(await env.DB.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('ik_d1_reversal_fences','ik_d1_retirements','ik_d1_erasure_journal')").first('n')).toBe(3)
 const supporter={namespace:'main-retired',statuses:{},files:[{name:'retired-person.json',kind:'users' as const,version:'v2' as const,base64:Buffer.from(JSON.stringify({users:[{id:'retired-person',name:'Quillon Vandermeer',created:'2024-07-08T09:10:11.000Z'}]})).toString('base64')}]}
 await populateFeedback(supporter,operator)
 const person=stableFeedbackId(supporter.namespace,'users','retired-person')
const erasure=await(await call('/api/operator/data/erasure/preview',{table:'requesters',id:person},operator)).json() as {planHash:string;blockedCopies:unknown[]};expect(erasure.blockedCopies).toEqual([])
 const erased=await call('/api/operator/data/erasure',{table:'requesters',id:person,planHash:erasure.planHash},operator);expect([200,202],await erased.clone().text()).toContain(erased.status)
 let operation=await erased.json() as {operationId:string;status:string};for(let step=0;step<100&&operation.status!=='complete';step++)operation=await(await call('/api/operator/data/operations/'+operation.operationId+'/resume',{},operator)).json() as typeof operation
 expect(operation.status).toBe('complete')
 const journal=(await env.DB.prepare('SELECT * FROM ik_d1_erasure_journal').all<{records_erased:number;stores_json:string}>()).results
 expect(journal.length).toBeGreaterThan(0);expect(journal.reduce((sum,row)=>sum+row.records_erased,0)).toBeGreaterThan(0)
 for(const row of journal)for(const value of ['Quillon','retired-person',person])expect(JSON.stringify(row)).not.toContain(value)
 const reversed=await call(importPath+'/jobs/'+applied.id+'/undo',{},operator);expect(reversed.status,await reversed.clone().text()).toBe(200)
 expect((await complete(await reversed.json() as typeof applied,operator)).state).toBe('undone')
 expect((await complete(pending,operator)).state).toBe('completed')
 await env.FILES.delete('upgrade-original')
},60000)
it('[IMP-005][DATA-001] repairs completed legacy erasures on export and restore without requiring a surviving target',async()=>{
 await reset();await applyD1Migrations(env.DB,inject('migrations'))
 const {populateFeedback}=await import('./feedback-import-fixture'),{importContext}=await import('@/core/features/imports/service'),{runtime}=await import('./notification-regression-fixture'),{eraseD1ImportTarget}=await import('../../base/modules/import-kit/src/d1/index'),{stableFeedbackId}=await import('@/core/features/imports/mapping-support')
 const {canonical,restoreArchive}=await import('@/core/features/data/archive'),{digest}=await import('@/core/features/auth/native-tokens')
 let operator=await owner()
 const source={namespace:'completed-legacy-erasure',statuses:{},files:[{name:'person.json',kind:'users' as const,version:'v2' as const,base64:Buffer.from(JSON.stringify({users:[{id:'gone',name:'Private legacy person',created:'2024-07-08T09:10:11.000Z',profile:'Private completed erasure wording'}]})).toString('base64')}]}
 const job=await populateFeedback(source,operator),id=stableFeedbackId(source.namespace,'users','gone')
 const {context}=await importContext(runtime(),new Request('https://penny.test'+importPath,{method:'POST',headers:{Origin:'https://penny.test',...operator}}),source.namespace)
 await context.storage.targets.read(context.storage.database,'penny-feedback','users',id)
 await eraseD1ImportTarget('users',id,context.storage.targets.remove('penny-feedback','users',id),{...context,originalErasurePolicy:'withdraw-all-job-artifacts'})
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requesters').first('n')).toBe(0)
 const names=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'ik_*' ORDER BY name").all<{name:string}>()).results
 const legacy=Object.fromEntries(await Promise.all(names.map(async({name})=>[name,(await env.DB.prepare('SELECT * FROM '+name).all<Row>()).results] as const)))
 expect(JSON.stringify(legacy)).toContain(source.files[0].base64)
 await env.DB.prepare('CREATE TRIGGER revoke_legacy_export AFTER UPDATE OF plan_json ON ik_jobs BEGIN UPDATE oa_sessions SET revoked_at=1; END').run()
 const refused=await call('/api/operator/data/export',undefined,operator);expect(refused.status).toBeGreaterThanOrEqual(400)
 for(const {name}of names)expect((await env.DB.prepare('SELECT * FROM '+name).all<Row>()).results).toEqual(legacy[name])
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 expect((await call('/auth/session',undefined,operator)).status).toBe(200)
 await env.DB.prepare('DROP TRIGGER revoke_legacy_export').run()
 const download=await call('/api/operator/data/export',undefined,operator);expect(download.status,await download.clone().text()).toBe(200)
 const exported=await download.json() as Awaited<ReturnType<typeof exportArchive>>
 expect(JSON.stringify(exported)).not.toContain(source.files[0].base64)
 expect(JSON.stringify((await env.DB.prepare('SELECT * FROM ik_jobs').all()).results)).not.toContain(source.files[0].base64)
 expect(exported.archive.tables.ik_d1_erased_sources).toEqual(legacy.ik_d1_erased_sources)
 expect(exported.archive.tables.ik_d1_erased_targets).toEqual(legacy.ik_d1_erased_targets)
 // A real earlier archive had this same fully fingerprinted legacy custody.
 // Reconstitute those exact saved rows, retaining the authenticated journal.
 const historical=structuredClone(exported.archive);for(const [name,rows]of Object.entries(legacy))if(name in historical.tables)historical.tables[name]=rows
 const {sha256:ignored,...body}=historical;void ignored;historical.sha256=await digest(canonical(body))
 await reset();await applyD1Migrations(env.DB,inject('migrations'));operator=await owner()
 expect((await restoreArchive(env.DB,env.FILES,historical,exported.journal)).status).toBe('complete')
 const restored=await exportArchive(env.DB,env.FILES)
 expect(JSON.stringify(restored)).not.toContain(source.files[0].base64);expect(JSON.stringify(restored)).not.toContain('Private completed erasure wording')
 for(const {name}of names){const rows=JSON.stringify((await env.DB.prepare('SELECT * FROM '+name).all()).results);expect(rows).not.toContain(source.files[0].base64);expect(rows).not.toContain('Private completed erasure wording')}
 const receipt=await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator);expect(receipt.status,await receipt.clone().text()).toBe(200);expect(await receipt.json()).toMatchObject({originalsRetained:false})
 const review=await(await call(importPath+'/preview',source,operator)).json() as {fingerprint:string}
 expect((await call(importPath+'/apply',{source,fingerprint:review.fingerprint},operator)).status).toBe(422)
 for(const table of ['notification_outbox','notification_intents','local_auth_outbox'])expect(restored.archive.tables[table]).toHaveLength(0)
})

it('[IMP-003][DATA-001] upgrades populated 0036 custody and closes maintenance writes without changing retained history',async()=>{
 await reset();const migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name.startsWith('0037_'))
 await applyD1Migrations(env.DB,migrations.slice(0,boundary))
 const {ideasFeedbackFixture,populateFeedback}=await import('./feedback-import-fixture'),{checkFeedbackMaintenance}=await import('./feedback-maintenance-fixture')
 const operator=await owner(),source=ideasFeedbackFixture('maintenance-upgrade')
 source.files.push({name:'users.json',kind:'users',version:'v2',base64:Buffer.from(JSON.stringify({users:Array.from({length:210},(_,i)=>({id:'prior-'+i,name:'Historical contributor '+i,created:'2024-07-08T09:10:11.000Z'}))})).toString('base64')})
 const job=await apply(source,operator),pending=await populateFeedback(feedbackFixture('maintenance-saved-plan'),operator,true)
 expect(pending.state).toBe('applying')
 const imported=await env.DB.prepare("SELECT target_id FROM feedback_import_records WHERE namespace=? AND target_kind='posts'").bind(source.namespace).first<string>('target_id')
 await env.DB.prepare('UPDATE requests SET title=? WHERE id=?').bind('Later native work retained across upgrade',imported).run()
 expect((await call(importPath+'/jobs/'+job.id+'/undo',{},operator)).status).toBe(409)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO feedback_import_tombstones(target_kind,target_id) VALUES('users','previously-erased-user')"),
  env.DB.prepare("INSERT INTO data_tombstones(epoch,table_name,key_hash) VALUES(1,'requesters',?)").bind('c'.repeat(64)),
  env.DB.prepare('UPDATE data_state SET epoch=1'),
 ])
 const bytes=new Uint8Array([0,255,13,10,195,169]);await env.FILES.put('maintenance-upgrade-original',bytes)
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all<{name:string}>()).results
 const read=async()=>(await env.DB.batch(tables.map(({name})=>env.DB.prepare('SELECT * FROM "'+name+'" ORDER BY rowid')))).map(result=>result.results)
 const before=await read(),receipt=await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json()
 // Authenticated receipt reads do not change the stored history we preserve.
 const prior=await read()
 for(const migration of migrations.slice(boundary)){await applyD1Migrations(env.DB,[migration]);expect(await read(),migration.name).toEqual(prior)}
 await applyD1Migrations(env.DB,migrations);expect(await read()).toEqual(prior)
 expect(new Uint8Array(await(await env.FILES.get('maintenance-upgrade-original'))!.arrayBuffer())).toEqual(bytes)
 expect((await call('/auth/session',undefined,operator)).status).toBe(200)
 expect(await(await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).json()).toEqual(receipt)
 expect(before).toEqual(prior)
 await checkFeedbackMaintenance()
 expect(await read()).toEqual(prior)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 await env.FILES.delete('maintenance-upgrade-original')
})
