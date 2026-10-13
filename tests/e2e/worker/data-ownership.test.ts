import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeAll,beforeEach,expect,inject,it } from 'vitest'
import { exportArchive,restoreArchive,readErasureJournal,planErasure,eraseEntity,resumeErasure,canonical,DATA_LIMITS,schema } from '../../../src/core/features/data/archive'
import { createPennyApi } from '../../../src/core/app/api'
import { createDatabaseConnection } from '../../../src/core/platform/database'
import { importPennySample } from '../../../src/core/features/sample-data/service'
import { digest } from '../../../src/core/features/auth/native-tokens'
import { createUlid } from '../../../src/core/shared/ulid'
import sample from '../../../sample-data/penny.v1.json'
import { nativeAuthoritySettings, nativeOwnerCookie } from '../../predecessor-native-authority'
const app=createPennyApi({runtimeConfiguration:{operatorAllowlist:['owner@penny.invalid'],workspaceTimezone:'Etc/UTC',publicOriginAllowlist:[nativeAuthoritySettings.APP_ORIGIN]}})
const bindings={...env,...nativeAuthoritySettings,PENNY_ENVIRONMENT:'test',PENNY_AUTH_TRANSPORT:'local-outbox'}
let cookie='',nativeCookie=''
const call=(path:string,body?:unknown,headers:Record<string,string>={Cookie:cookie})=>app.fetch(new Request(nativeAuthoritySettings.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{Origin:nativeAuthoritySettings.APP_ORIGIN,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings)
const callMethod=(path:string,method:string,body?:unknown,headers:Record<string,string>={Cookie:cookie})=>app.fetch(new Request(nativeAuthoritySettings.APP_ORIGIN+path,{method,headers:{Origin:nativeAuthoritySettings.APP_ORIGIN,...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings)
beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'))})
beforeEach(async()=>{await clearTarget();await env.DB.batch([env.DB.prepare('DELETE FROM data_apply_claims'),env.DB.prepare('DELETE FROM data_operations'),env.DB.prepare('DELETE FROM data_tombstones'),env.DB.prepare('UPDATE data_state SET origin=?,epoch=0 WHERE singleton=1').bind(crypto.randomUUID().replaceAll('-',''))]);await importPennySample(createDatabaseConnection(env.DB),sample);await owner()})
async function owner(){const now=new Date().toISOString();await env.DB.prepare('INSERT OR IGNORE INTO operators(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)').bind('data-owner','owner@penny.invalid','Data review operator',now,now).run();await env.DB.prepare('INSERT OR REPLACE INTO operator_sessions(id,operator_id,token_hash,expires_at,last_used_at,created_at,updated_at) SELECT ?,id,?,?,?,?,? FROM operators WHERE email=?').bind('data-owner-session',await digest('data-owner-fixture'),'2099-01-01',now,now,now,'owner@penny.invalid').run()
 // Data routes now require native authority. Keep the separate historical
 // cookie so the existing post-restore legacy revocation assertion still runs.
 nativeCookie=await nativeOwnerCookie(bindings,nativeCookie)
 cookie=`penny_operator_session=data-owner-fixture; ${nativeCookie}`
}
async function clearTarget(){
 // Empty the portable product destination while retaining its native owner,
 // sessions and installation custody, exactly as a real restore requires.
 const names=(await schema(env.DB)).map(table=>table.name)
 const claim=crypto.randomUUID(),now=new Date().toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,'restore','running','{}',?,?)").bind(claim,now,now),
  env.DB.prepare('INSERT INTO data_apply_claims(operation_id) VALUES(?)').bind(claim),
  env.DB.prepare("UPDATE data_state SET phase='applying',lock_id=? WHERE singleton=1").bind(claim),
  env.DB.prepare('PRAGMA defer_foreign_keys=ON'),...names.map(name=>env.DB.prepare(`DELETE FROM "${name}"`)),
  env.DB.prepare("UPDATE data_state SET phase='idle',lock_id=NULL WHERE singleton=1"),
  env.DB.prepare('DELETE FROM data_apply_claims WHERE operation_id=?').bind(claim),
  env.DB.prepare('DELETE FROM data_operations WHERE id=?').bind(claim),
 ])
 const objects=(await env.FILES.list()).objects;await env.FILES.delete(objects.map(object=>object.key))
}
async function file(requestId?:string,index=1){const request=requestId??(await env.DB.prepare('SELECT id FROM requests ORDER BY id LIMIT 1').first<{id:string}>())!.id,now=new Date().toISOString(),id=createUlid(),key=`synthetic-original/${id}.pdf`,bytes=new Uint8Array([0,255,31,index,80,68,70])
 await env.DB.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES(?,?,?,?,?,?,'operator_only',?,?)").bind(id,request,key,`Synthetic ${index}.pdf`,'application/pdf',bytes.byteLength,now,now).run();await env.FILES.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});return {key,bytes}
}
const wrapBucket=(overrides:Partial<R2Bucket>)=>new Proxy(env.FILES,{get(target,key){if(key in overrides)return overrides[key as keyof R2Bucket];const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
async function rehash(value:Record<string,unknown>){const {sha256:ignored,...body}=value;void ignored;value.sha256=await digest(canonical(body));return value}
it('authenticates all data surfaces independently; no public archive/journal and no foreign-origin mutations',async()=>{
 for(const path of ['/api/operator/data/export','/api/operator/data/journal','/api/operator/data/operations/missing'])expect((await call(path,undefined,{})).status).toBe(401)
 for(const path of ['/api/operator/data/import','/api/operator/data/erasure','/api/operator/data/erasure/preview','/api/operator/data/operations/missing/resume','/api/operator/data/operations/missing/abort-restore','/api/operator/data/operations/missing/abort-export','/api/operator/data/operations/missing/abort-pending-erasure','/api/operator/data/operations/missing/recover-runner'])expect((await call(path,{},{})).status).toBe(401)
 expect((await call('/api/public/data/export',undefined,{})).status).toBe(404)
 expect((await call('/api/operator/data/erasure/preview',{table:'operators',id:'data-owner'})).status).toBe(400)
 expect((await call('/api/operator/data/import',{}, {Cookie:cookie,Origin:'https://foreign.test'})).status).toBe(403)
 // The historical cookie still admits its historical route, but cannot become
 // native data authority merely because both schemas are installed.
 const historical={Cookie:'penny_operator_session=data-owner-fixture'}
 expect((await call('/api/auth/session',undefined,historical)).status).toBe(200)
 expect((await call('/api/operator/data/journal',undefined,historical)).status).toBe(401)
 expect((await call('/api/operator/data/journal')).status).toBe(200)
 const nativeSession=(await env.DB.prepare('SELECT id,expires_at FROM oa_sessions WHERE revoked_at IS NULL AND expires_at>?').bind(Date.now()).first<{id:string;expires_at:number}>())!
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=0 WHERE id=?').bind(nativeSession.id).run()
 expect((await call('/api/operator/data/journal')).status).toBe(401)
 await env.DB.prepare('UPDATE oa_sessions SET expires_at=? WHERE id=?').bind(nativeSession.expires_at,nativeSession.id).run()
 expect((await call('/api/operator/data/journal')).status).toBe(200)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').bind(Date.now(),nativeSession.id).run()
 expect((await call('/api/operator/data/journal')).status).toBe(401)
 expect((await call('/api/auth/session',undefined,historical)).status).toBe(200)
})
it('exports all current records and exact original R2 bytes, restores atomically, and disables credentials',async()=>{
 const original=await file(),snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.files).toHaveLength(1);expect(snapshot.archive.tables.requests.length).toBe(2)
 expect(snapshot.archive.tables.operator_sessions.find(row=>row.id==='data-owner-session')!.token_hash).not.toBe(await digest('data-owner-fixture'))
 await clearTarget();await owner()
 const nativeAuthority=(await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results
 const nativeSessions=(await env.DB.prepare('SELECT * FROM oa_sessions ORDER BY id').all()).results
 expect((await call('/api/operator/data/import',snapshot)).status).toBe(200)
 expect((await call('/api/auth/session')).status).toBe(401)
 expect((await call('/api/operator/data/journal',undefined,{Cookie:'penny_operator_session=data-owner-fixture'})).status).toBe(401)
 expect((await call('/api/operator/data/journal',undefined,{Cookie:nativeCookie})).status).toBe(200)
 expect((await env.DB.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results).toEqual(nativeAuthority)
 expect((await env.DB.prepare('SELECT * FROM oa_sessions ORDER BY id').all()).results).toEqual(nativeSessions)
 expect(new Uint8Array(await (await env.FILES.get(original.key))!.arrayBuffer())).toEqual(original.bytes)
 const restored=await exportArchive(env.DB,env.FILES)
 restored.archive.tables.audit_entries=restored.archive.tables.audit_entries.filter(row=>row.action!=='data.restored')
 expect(restored.archive.tables).toEqual(snapshot.archive.tables);expect(restored.archive.files).toEqual(snapshot.archive.files)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
it('fails before restore writes on hash corruption, missing bytes, bad references, unknown schema/version and journal mismatch',async()=>{
 await file();const snapshot=await exportArchive(env.DB,env.FILES);await clearTarget()
 for(const mutate of [
  (value:any)=>{value.archive.tables.requests[0].title='tampered'},
  async(value:any)=>{value.archive.files[0].bytes='';await rehash(value.archive)},
  async(value:any)=>{value.archive.files=[];await rehash(value.archive)},
  async(value:any)=>{value.archive.tables.requests[0].board_id='nonexistent';await rehash(value.archive)},
  async(value:any)=>{value.archive.schemaHash='future-schema';await rehash(value.archive)},
  (value:any)=>{value.archive.version=99},
  (value:any)=>{value.journal.sha256='a'.repeat(64)},
 ]){const input=structuredClone(snapshot);await mutate(input);await expect(restoreArchive(env.DB,env.FILES,input.archive,input.journal)).rejects.toBeDefined();expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(0);expect((await env.FILES.list()).objects).toHaveLength(0);expect((await env.DB.prepare('SELECT phase FROM data_state').first<{phase:string}>())!.phase).toBe('idle')}
})
it('does not overwrite existing product rows or R2 objects',async()=>{
 const snapshot=await exportArchive(env.DB,env.FILES)
 await expect(restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).rejects.toMatchObject({code:'restore_requires_empty_target'})
 expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(2)
 await clearTarget();await env.FILES.put('unrelated-original','untouched')
 await expect(restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).rejects.toMatchObject({code:'restore_requires_empty_bucket'})
 expect(await (await env.FILES.get('unrelated-original'))!.text()).toBe('untouched')
})
it('keeps failed R2 restore resumable, fences ordinary writes, and does not duplicate committed replay',async()=>{
 await file(undefined,1);await file(undefined,2);const snapshot=await exportArchive(env.DB,env.FILES);await clearTarget();await owner()
 let calls=0;const faulty=wrapBucket({put:async(...args:Parameters<R2Bucket['put']>)=>{if(++calls===2)throw new Error('synthetic second-object fault');return env.FILES.put(...args)},delete:async()=>{throw new Error('synthetic cleanup fault')}} as Partial<R2Bucket>)
 const pending=await restoreArchive(env.DB,faulty,snapshot.archive,snapshot.journal);expect(pending.status).toBe('pending')
 await expect(env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('fault-board','fault-board','Fault','public',0,'now','now')").run()).rejects.toThrow('maintenance')
 expect((await call('/api/operator/data/operations/'+pending.operationId)).status).toBe(200)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(0)
 const completed=await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal,pending.operationId);expect(completed.status).toBe('complete')
 const counts=await env.DB.prepare('SELECT count(*) AS n FROM audit_entries').first()
 expect(await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal,pending.operationId)).toEqual(completed)
 expect(await env.DB.prepare('SELECT count(*) AS n FROM audit_entries').first()).toEqual(counts)
})
it('rolls back late D1 restore failure and removes uploaded bytes; a fresh retry works',async()=>{
 await file();const snapshot=await exportArchive(env.DB,env.FILES);await clearTarget()
 await env.DB.exec("CREATE TRIGGER synthetic_restore_fault BEFORE INSERT ON evidence_versions BEGIN SELECT RAISE(ABORT,'synthetic late restore fault'); END;")
 try{await expect(restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).rejects.toThrow('synthetic');expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(0);expect((await env.FILES.list()).objects).toHaveLength(0);expect((await env.DB.prepare('SELECT phase FROM data_state').first<{phase:string}>())!.phase).toBe('idle')}finally{await env.DB.exec('DROP TRIGGER synthetic_restore_fault')}
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete')
})
it('does not compensate R2 after a committed D1 response fault',async()=>{
 const original=await file(),snapshot=await exportArchive(env.DB,env.FILES);await clearTarget();let triggered=false
 const db=new Proxy(env.DB,{get(target,key){if(key==='batch')return async(statements:D1PreparedStatement[])=>{
  const result=await target.batch(statements)
  // Fault the response to the committed restore, regardless of how many
  // validation and ownership batches precede that transaction.
  if(!triggered&&await target.prepare("SELECT id FROM data_operations WHERE kind='restore' AND status='complete'").first()){triggered=true;throw new Error('synthetic postcommit response fault')}
  return result
 };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}})
 expect((await restoreArchive(db,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete');expect(triggered).toBe(true);expect(await env.FILES.get(original.key)).not.toBeNull();expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(2)
})
it('missing original bytes fail export loudly and release its fence',async()=>{
 const original=await file();await env.FILES.delete(original.key)
 await expect(exportArchive(env.DB,env.FILES)).rejects.toMatchObject({code:'missing_attachment'})
 expect((await env.DB.prepare('SELECT phase FROM data_state').first<{phase:string}>())!.phase).toBe('idle')
 expect(DATA_LIMITS.fileBytes).toBe(10485760)
})
async function nativePerson(name=`Synthetic erased person ${crypto.randomUUID()}`,address=`${crypto.randomUUID()}@example.test`){
 expect((await call('/api/public/identity/email',{email:address,displayName:name},{})).status).toBe(202)
 const token=(await env.DB.prepare("SELECT token FROM local_auth_outbox WHERE recipient=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(address).first<{token:string}>())!.token
 const response=await call('/api/public/identity/email/verify',{token},{});expect(response.status).toBe(200)
 const identity=await response.json() as {token:string}
 const person=(await env.DB.prepare('SELECT requester_id AS id,id AS addressId FROM requester_addresses WHERE email=?').bind(address).first<{id:string;addressId:string}>())!
 const input={title:`Private recovery wording ${crypto.randomUUID()}`,description:`Private recovery description ${crypto.randomUUID()}`,boardSlug:'enterprise-identity',idempotencyKey:crypto.randomUUID()}
 const created=await call('/api/public/requests',input,{Authorization:'Bearer '+identity.token});expect(created.status).toBe(201)
 const {slug}=await created.json() as {slug:string},request=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>())!
 const evidence=(await env.DB.prepare('SELECT evidence_id AS id FROM request_evidence_links WHERE request_id=?').bind(request.id).first<{id:string}>())!
 return {...person,email:address,token:identity.token,input,slug,requestId:request.id,evidenceId:evidence.id}
}
it('erases the native personal graph and identified copied contexts, anonymizes nested audits, resumes R2 cleanup and refuses stale restore',async()=>{
 const person=await nativePerson(),original=await file(person.requestId),now=new Date().toISOString()
 const version=(await env.DB.prepare('SELECT id FROM evidence_versions WHERE evidence_id=?').bind(person.evidenceId).first<{id:string}>())!.id
 const revision=(await env.DB.prepare('SELECT id FROM decision_revisions LIMIT 1').first<{id:string}>())!.id,bet=(await env.DB.prepare('SELECT id FROM candidate_bets LIMIT 1').first<{id:string}>())!.id
 await env.DB.prepare("INSERT INTO decision_evidence_snapshots(id,decision_revision_id,evidence_id,evidence_version_id,candidate_bet_id,stance,created_at,updated_at) VALUES(?,?,?,?,?,'supporting',?,?)").bind('synthetic-copied-snapshot',revision,person.evidenceId,version,bet,now,now).run()
 await env.DB.prepare("INSERT INTO custom_field_definitions(id,entity_type,name,field_type,created_at,updated_at) VALUES('synthetic-field','request','Synthetic copied context','text',?,?)").bind(now,now).run()
 await env.DB.prepare("INSERT INTO custom_field_values(id,definition_id,entity_id,value_json,created_at,updated_at) VALUES('synthetic-copied-field','synthetic-field','unrelated-object',?,?,?)").bind(JSON.stringify({requesterId:person.id,privateOriginal:person.input.title}),now,now).run()
 await env.DB.prepare("INSERT INTO audit_entries(id,actor_type,action,entity_type,entity_id,details_json,occurred_at,created_at,updated_at) VALUES('synthetic-nested-audit','system','test.copy','request','unrelated-object',?,?,?,?)").bind(JSON.stringify({requesterId:person.id}),now,now,now).run()
 const old=await exportArchive(env.DB,env.FILES),plan=await planErasure(env.DB,'requesters',person.id)
 expect(plan.blockedCopies).toEqual([]);expect(plan.counts.decision_evidence_snapshots).toBe(1);expect(plan.counts.custom_field_values).toBe(1)
 const faulty=wrapBucket({delete:async()=>{throw new Error('synthetic deletion fault')}} as Partial<R2Bucket>)
 const pending=await eraseEntity(env.DB,faulty,'requesters',person.id,plan.planHash);expect(pending.status).toBe('pending_r2')
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(person.id).first()).toBeNull()
 expect((await call('/api/public/identity/session',undefined,{Authorization:'Bearer '+person.token})).status).toBe(401)
 expect((await call('/api/public/requests/'+person.slug,undefined,{})).status).toBe(404)
 const audit=await env.DB.prepare("SELECT entity_id,details_json FROM audit_entries WHERE id='synthetic-nested-audit'").first<{entity_id:string;details_json:null}>();expect(audit!.entity_id).toMatch(/^erased:/);expect(audit!.details_json).toBeNull()
 expect(await env.FILES.get(original.key)).not.toBeNull()
 expect((await call('/api/operator/data/export')).status).toBe(409)
 const completed=await call('/api/operator/data/operations/'+pending.operationId+'/resume',{});expect(completed.status).toBe(200);expect(await completed.json()).toMatchObject({status:'complete'})
 expect(await env.FILES.get(original.key)).toBeNull();expect(await resumeErasure(env.DB,env.FILES,pending.operationId)).toMatchObject({status:'complete'})
 const journal=await readErasureJournal(env.DB);expect(journal.epoch).toBe(1);expect(JSON.stringify(journal)).not.toContain(person.email)
 await expect(restoreArchive(env.DB,env.FILES,old.archive,old.journal)).rejects.toMatchObject({code:'erasure_journal_regression'})
 await expect(restoreArchive(env.DB,env.FILES,old.archive,journal)).rejects.toMatchObject({code:'stale_archive'})
 const malicious=structuredClone(old.archive);malicious.epoch=journal.epoch;malicious.journalHash=journal.sha256;await rehash(malicious)
 await expect(restoreArchive(env.DB,env.FILES,malicious,journal)).rejects.toMatchObject({code:'erased_archive_record'})
 const fresh=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(fresh)).not.toContain(person.input.title);expect(JSON.stringify(fresh)).not.toContain(person.email)
 await clearTarget();expect((await restoreArchive(env.DB,env.FILES,fresh.archive,journal)).status).toBe('complete')
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(person.id).first()).toBeNull()
})
it('requires the current preview hash and rolls back a late erasure audit fault without deleting R2',async()=>{
 const person=await nativePerson(),original=await file(person.requestId),plan=await planErasure(env.DB,'requesters',person.id)
 await env.DB.prepare('UPDATE requesters SET display_name=? WHERE id=?').bind('Changed synthetic name '+crypto.randomUUID(),person.id).run()
 await expect(eraseEntity(env.DB,env.FILES,'requesters',person.id,plan.planHash)).rejects.toMatchObject({code:'erasure_plan_changed'})
 const changed=await planErasure(env.DB,'requesters',person.id)
 await env.DB.exec("CREATE TRIGGER synthetic_erasure_fault BEFORE INSERT ON audit_entries BEGIN SELECT RAISE(ABORT,'synthetic erasure audit fault'); END;")
 try{await expect(eraseEntity(env.DB,env.FILES,'requesters',person.id,changed.planHash)).rejects.toThrow('synthetic');expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(person.id).first()).not.toBeNull();expect((await readErasureJournal(env.DB)).epoch).toBe(0);expect(await env.FILES.get(original.key)).not.toBeNull()}finally{await env.DB.exec('DROP TRIGGER synthetic_erasure_fault')}
 expect((await eraseEntity(env.DB,env.FILES,'requesters',person.id,(await planErasure(env.DB,'requesters',person.id)).planHash)).status).toBe('complete')
})
it('blocks ambiguous common-word and short-wording copies rather than deleting unrelated records',async()=>{
 const person=await nativePerson('Roadmap')
 await env.DB.prepare("UPDATE boards SET name='Roadmap' WHERE slug='enterprise-identity'").run()
 const plan=await planErasure(env.DB,'requesters',person.id);expect(plan.blockedCopies.some(copy=>copy.table==='boards')).toBe(true)
 await expect(eraseEntity(env.DB,env.FILES,'requesters',person.id,plan.planHash)).rejects.toMatchObject({code:'erasure_ambiguous_copies'})
 expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(3)
 await env.DB.prepare("UPDATE boards SET name='Enterprise identity' WHERE slug='enterprise-identity'").run()
 await env.DB.prepare("UPDATE requests SET title='XY' WHERE id=?").bind(person.requestId).run()
 await env.DB.prepare("UPDATE decisions SET rationale='Customer wording: XY' WHERE id=(SELECT id FROM decisions LIMIT 1)").run()
 const short=await planErasure(env.DB,'requests',person.requestId);expect(short.blockedCopies.some(copy=>copy.table==='decisions')).toBe(true)
 await expect(eraseEntity(env.DB,env.FILES,'requests',person.requestId,short.planHash)).rejects.toMatchObject({code:'erasure_ambiguous_copies'})
})
it('honors operator owner holds and blocks unreviewed data limits',async()=>{
 const person=await nativePerson('Synthetic operator-linked requester','owner@penny.invalid')
 await expect(planErasure(env.DB,'requesters',person.id)).rejects.toMatchObject({code:'erasure_crosses_operator_hold'})
 await expect(planErasure(env.DB,'operators','data-owner')).rejects.toMatchObject({code:'unsupported_erasure_entity'})
 const snapshot=await exportArchive(env.DB,env.FILES);const oversized=structuredClone(snapshot.archive);oversized.tables.requests[0].description='x'.repeat(DATA_LIMITS.recordBytes+1);await rehash(oversized)
 await expect(restoreArchive(env.DB,env.FILES,oversized,snapshot.journal)).rejects.toMatchObject({code:'archive_limit'})
})
it('allows authenticated quiesced interrupted-export recovery, preserving the held records',async()=>{
 const id=createUlid(),now=new Date().toISOString()
 await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1").bind(id),env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,'export','pending','{}',?,?)").bind(id,now,now)])
 expect((await call('/api/operator/data/operations/'+id+'/abort-export',{confirmPriorRunnerStopped:false})).status).toBe(400)
 expect((await call('/api/operator/data/operations/'+id+'/abort-export',{confirmPriorRunnerStopped:true})).status).toBe(204)
 expect((await exportArchive(env.DB,env.FILES)).archive.tables.requests).toHaveLength(2)
})
it('does not let resume and abort overlap an active R2 restore runner',async()=>{
 await file();const snapshot=await exportArchive(env.DB,env.FILES);await clearTarget()
 let started!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve}),held=new Promise<void>(resolve=>{release=resolve})
 const bucket=wrapBucket({put:async(...args:Parameters<R2Bucket['put']>)=>{started();await held;return env.FILES.put(...args)}} as Partial<R2Bucket>)
 const running=restoreArchive(env.DB,bucket,snapshot.archive,snapshot.journal);await ready
 const id=(await env.DB.prepare('SELECT lock_id FROM data_state').first<{lock_id:string}>())!.lock_id
 try{
  await expect(restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal,id)).rejects.toMatchObject({code:'data_runner_busy'})
  expect((await env.DB.prepare('SELECT status FROM data_operations WHERE id=?').bind(id).first<{status:string}>())!.status).toBe('running')
 }finally{release()}
 expect((await running).status).toBe('complete')
})
it('requires quiesced confirmation to recover a crashed restore runner and then resumes its original archive',async()=>{
 const snapshot=await exportArchive(env.DB,env.FILES);await clearTarget();await owner();const id=createUlid(),now=new Date().toISOString()
 await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1").bind(id),env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,'restore','running',?,?,?)").bind(id,canonical({archiveHash:snapshot.archive.sha256,journalHash:snapshot.journal.sha256,keys:[]}),now,now)])
 expect((await call('/api/operator/data/operations/'+id+'/recover-runner',{expectedStatus:'running',confirmPriorRunnerStopped:false})).status).toBe(400)
 expect((await call('/api/operator/data/operations/'+id+'/recover-runner',{expectedStatus:'running',confirmPriorRunnerStopped:true})).status).toBe(204)
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal,id)).status).toBe('complete')
})
it('rejects untracked R2 objects and preserves canonical native identity on archive import',async()=>{
 await env.FILES.put('untracked-personal-original','private synthetic orphan')
 await expect(exportArchive(env.DB,env.FILES)).rejects.toMatchObject({code:'untracked_attachment_objects'})
 await env.FILES.delete('untracked-personal-original')
 const person=await nativePerson(),snapshot=await exportArchive(env.DB,env.FILES),unsafe=structuredClone(snapshot.archive)
 unsafe.tables.requests.find(row=>row.id===person.requestId)!.slug='private-original-title';await rehash(unsafe)
 await expect(restoreArchive(env.DB,env.FILES,unsafe,snapshot.journal)).rejects.toMatchObject({code:'unsafe_native_public_identity'})
})
it('recovers only unapplied pending erasure after a stopped-runner confirmation',async()=>{
 const id=createUlid(),now=new Date().toISOString()
 await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1").bind(id),env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,'erase','pending','{}',?,?)").bind(id,now,now)])
 expect((await call('/api/operator/data/operations/'+id+'/abort-pending-erasure',{confirmPriorRunnerStopped:false})).status).toBe(400)
 expect((await call('/api/operator/data/operations/'+id+'/abort-pending-erasure',{confirmPriorRunnerStopped:true})).status).toBe(204)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(2)
 expect((await readErasureJournal(env.DB)).epoch).toBe(0)
})
it('blocks unattributed copies of private source labels and original filenames before erasure',async()=>{
 const person=await nativePerson(),original=await file(person.requestId)
 await env.DB.prepare('UPDATE evidence_items SET source_label=? WHERE id=?').bind('Private Cedar recovery meeting',person.evidenceId).run()
 await env.DB.prepare("UPDATE decisions SET rationale='Copied private source: Private Cedar recovery meeting' WHERE id=(SELECT id FROM decisions LIMIT 1)").run()
 const source=await planErasure(env.DB,'evidence_items',person.evidenceId);expect(source.blockedCopies.some(copy=>copy.table==='decisions')).toBe(true)
 await expect(eraseEntity(env.DB,env.FILES,'evidence_items',person.evidenceId,source.planHash)).rejects.toMatchObject({code:'erasure_ambiguous_copies'})
 await env.DB.prepare("UPDATE decisions SET rationale='Copied original file: Synthetic 1.pdf' WHERE id=(SELECT id FROM decisions LIMIT 1)").run()
 const filename=await planErasure(env.DB,'requests',person.requestId);expect(filename.blockedCopies.some(copy=>copy.table==='decisions')).toBe(true)
 await expect(eraseEntity(env.DB,env.FILES,'requests',person.requestId,filename.planHash)).rejects.toMatchObject({code:'erasure_ambiguous_copies'})
 expect(await env.FILES.get(original.key)).not.toBeNull()
})

it('never claims or deletes unrelated files after an interruption before empty-target validation',async()=>{
 const original=await file(),snapshot=await exportArchive(env.DB,env.FILES);await clearTarget();await owner()
 const other=new Uint8Array([82,69,84,65,73,78]);await env.FILES.put(original.key,other)
 const interrupted=async()=>{const id=createUlid(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1").bind(id),env.DB.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,'restore','pending',?,?,?)").bind(id,canonical({archiveHash:snapshot.archive.sha256,journalHash:snapshot.journal.sha256,keys:[original.key]}),now,now)]);return id}
 const abortId=await interrupted();expect((await call('/api/operator/data/operations/'+abortId+'/abort-restore',{})).status).toBe(204)
 expect(new Uint8Array(await(await env.FILES.get(original.key))!.arrayBuffer())).toEqual(other)
 const resumeId=await interrupted();await expect(restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal,resumeId)).rejects.toMatchObject({code:'restore_requires_empty_bucket'})
 expect(new Uint8Array(await(await env.FILES.get(original.key))!.arrayBuffer())).toEqual(other)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM requests').first<{n:number}>())!.n).toBe(0)
})
it('defines and edits private typed fields for every seeded entity while preserving authority, values, audit, export and public boundaries',async()=>{
 const entities=[
  {type:'account',table:'accounts'},
  {type:'requester',table:'requesters'},
  {type:'evidence',table:'evidence_items'},
  {type:'request',table:'requests'},
  {type:'decision',table:'decisions'},
  {type:'roadmapItem',table:'roadmap_items'},
  {type:'release',table:'releases'},
 ] as const
 const records=await Promise.all(entities.map(async entity=>({type:entity.type,id:(await env.DB.prepare(`SELECT id FROM ${entity.table} ORDER BY id LIMIT 1`).first<{id:string}>())!.id})))
 const marker=`Private custom field marker ${crypto.randomUUID()}`
 const definitions=new Map<string,{id:string;name:string;entityType:string;fieldType:string}>()
 const requestId=records.find(record=>record.type==='request')!.id
 expect((await callMethod('/api/operator/settings/custom-fields','GET',undefined,{})).status).toBe(401)
 expect((await callMethod(`/api/operator/custom-fields/request/${requestId}`,'GET',undefined,{})).status).toBe(401)

 for(const record of records){
  const name=`${marker} ${record.type}`
  const response=await callMethod('/api/operator/settings/custom-fields','POST',{entityType:record.type,name,fieldType:'text'})
  expect(response.status).toBe(201)
  const definition=await response.json() as {id:string;name:string;entityType:string;fieldType:string}
  definitions.set(record.type,definition)
  const emptyFields=await (await callMethod(`/api/operator/custom-fields/${record.type}/${record.id}`,'GET')).json() as {id:string;hasValue:boolean;value:unknown}[]
  expect(emptyFields.find(field=>field.id===definition.id)).toMatchObject({hasValue:false,value:null})
  const saved=await callMethod(`/api/operator/custom-fields/${record.type}/${definition.id}/${record.id}`,'PUT',{value:name})
  expect(saved.status).toBe(200)
  const values=await (await callMethod(`/api/operator/custom-fields/${record.type}/${record.id}`,'GET')).json() as {id:string;hasValue:boolean;value:unknown}[]
  expect(values.find(field=>field.id===definition.id)).toMatchObject({hasValue:true,value:name})
 }
 for(const record of records){
  const definition=definitions.get(record.type)!
  const name=`${definition.name} edited`
  expect((await callMethod(`/api/operator/settings/custom-fields/${definition.id}`,'PATCH',{name,fieldType:'text'})).status).toBe(200)
  definition.name=name
  const fields=await (await callMethod('/api/operator/settings/custom-fields','GET')).json() as {id:string;name:string;entityType:string;fieldType:string}[]
  expect(fields.find(field=>field.id===definition.id)).toMatchObject({name,entityType:record.type,fieldType:'text'})
 }

 const requestDefinition=definitions.get('request')!
 const createDefinition=async(name:string,fieldType:string)=>{
  const response=await callMethod('/api/operator/settings/custom-fields','POST',{entityType:'request',name,fieldType})
  expect(response.status).toBe(201)
  return await response.json() as {id:string;name:string;entityType:string;fieldType:string}
 }
 const emptyText=await createDefinition(`${marker} empty text`,'text')
 const zero=await createDefinition(`${marker} zero`,'number')
 const falseValue=await createDefinition(`${marker} false`,'boolean')
 const calendarDate=await createDefinition(`${marker} calendar date`,'date')
 const nullable=await createDefinition(`${marker} nullable`,'number')
 const convertible=await createDefinition(`${marker} convertible`,'number')
 for(const [definition,value] of [[emptyText,''],[zero,0],[falseValue,false],[calendarDate,'2024-02-29'],[nullable,null]] as const){
  const response=await callMethod(`/api/operator/custom-fields/request/${definition.id}/${requestId}`,'PUT',{value})
  expect(response.status).toBe(200)
 }
 const typed=await (await callMethod(`/api/operator/custom-fields/request/${requestId}`,'GET')).json() as {id:string;hasValue:boolean;value:unknown}[]
 expect(typed.find(field=>field.id===emptyText.id)).toMatchObject({hasValue:true,value:''})
 expect(typed.find(field=>field.id===zero.id)).toMatchObject({hasValue:true,value:0})
 expect(typed.find(field=>field.id===falseValue.id)).toMatchObject({hasValue:true,value:false})
 expect(typed.find(field=>field.id===calendarDate.id)).toMatchObject({hasValue:true,value:'2024-02-29'})
 expect(typed.find(field=>field.id===nullable.id)).toMatchObject({hasValue:true,value:null})
 expect((await callMethod(`/api/operator/custom-fields/request/${convertible.id}/${requestId}`,'PUT',{value:'wrong type'})).status).toBe(400)
 expect((await callMethod(`/api/operator/custom-fields/request/${calendarDate.id}/${requestId}`,'PUT',{value:'2026-02-30'})).status).toBe(400)
 expect((await callMethod(`/api/operator/custom-fields/request/${zero.id}/${requestId}`,'PUT',{value:'0'})).status).toBe(400)
 expect((await callMethod(`/api/operator/settings/custom-fields/${zero.id}`,'PATCH',{name:`${marker} rejected type change`,fieldType:'text'})).status).toBe(409)

 const renamed=`${requestDefinition.name} renamed`
 expect((await callMethod(`/api/operator/settings/custom-fields/${requestDefinition.id}`,'PATCH',{name:renamed,fieldType:'text'})).status).toBe(200)
 expect((await callMethod(`/api/operator/settings/custom-fields/${requestDefinition.id}`,'PATCH',{name:renamed,fieldType:'number'})).status).toBe(409)
 expect((await callMethod(`/api/operator/settings/custom-fields/${convertible.id}`,'PATCH',{name:`${marker} converted`,fieldType:'text'})).status).toBe(200)
 expect((await callMethod(`/api/operator/custom-fields/request/${convertible.id}/${requestId}`,'PUT',{value:'editable type'})).status).toBe(200)
 expect((await callMethod('/api/operator/settings/custom-fields','POST',{entityType:'request',name:renamed,fieldType:'text'})).status).toBe(409)
 const roadmapName=`${marker} roadmap alias`
 expect((await callMethod('/api/operator/settings/custom-fields','POST',{entityType:'roadmapItem',name:roadmapName,fieldType:'text'})).status).toBe(201)
 expect((await callMethod('/api/operator/settings/custom-fields','POST',{entityType:'roadmap',name:roadmapName,fieldType:'text'})).status).toBe(409)
 expect((await callMethod('/api/operator/settings/custom-fields/missing-definition','PATCH',{name:'Missing',fieldType:'text'})).status).toBe(404)
 expect((await callMethod(`/api/operator/custom-fields/request/missing-definition/${requestId}`,'PUT',{value:'missing'})).status).toBe(404)
 expect((await callMethod(`/api/operator/custom-fields/request/${requestDefinition.id}/missing-entity`,'PUT',{value:'missing'})).status).toBe(404)
 expect((await callMethod(`/api/operator/custom-fields/not-a-real-entity-type/${requestId}`,'GET')).status).toBe(400)
 expect((await callMethod(`/api/operator/custom-fields/request/${requestDefinition.id}/${records.find(record=>record.type==='account')!.id}`,'PUT',{value:'cross entity'})).status).toBe(404)
 expect((await callMethod(`/api/operator/custom-fields/request/${definitions.get('account')!.id}/${requestId}`,'PUT',{value:'cross entity'})).status).toBe(409)
 expect((await callMethod('/api/operator/settings/custom-fields','POST',{entityType:'account',name:`${marker} denied`,fieldType:'text'},{})).status).toBe(401)

 expect((await callMethod(`/api/operator/custom-fields/request/${zero.id}/${requestId}`,'PUT',{value:null})).status).toBe(200)
 const cleared=await (await callMethod(`/api/operator/custom-fields/request/${requestId}`,'GET')).json() as {id:string;hasValue:boolean;value:unknown}[]
 expect(cleared.find(field=>field.id===zero.id)).toMatchObject({hasValue:true,value:null})
 expect(await env.DB.prepare("SELECT id FROM audit_entries WHERE action='custom_field.value_cleared' AND entity_type='request' AND entity_id=? AND actor_id='data-owner'").bind(requestId).first()).not.toBeNull()
 expect(await env.DB.prepare("SELECT id FROM audit_entries WHERE action='custom_field.definition_updated' AND entity_id=? AND actor_id='data-owner'").bind(requestDefinition.id).first()).not.toBeNull()

 const snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.tables.custom_field_definitions.some(row=>row.id===requestDefinition.id&&row.name===renamed)).toBe(true)
 expect(snapshot.archive.tables.custom_field_values.some(row=>row.definition_id===falseValue.id&&row.value_json==='false')).toBe(true)
 for(const path of ['/api/public/requests','/api/public/requests?q='+encodeURIComponent(marker),'/api/public/requests/scim-provisioning','/api/public/roadmap','/api/public/releases']){
  const publicResponse=await call(path,undefined,{})
  expect(publicResponse.status).toBe(200)
  const publicJson=JSON.stringify(await publicResponse.json())
  expect(publicJson).not.toContain(marker)
  expect(publicJson).not.toContain(renamed)
 }
 expect((await callMethod(`/api/operator/custom-fields/request/${requestId}`,'GET',undefined,{})).status).toBe(401)
})
