import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
const __rerTestEntryPnpm = (program, args) => {
 const at = program === 'nice' ? args.indexOf('pnpm') : -1;
 if (program === 'nice' && at < 0) return [program, args];
 const command = at < 0 ? args : args.slice(at + 1), offset = command[0] === 'run' ? 1 : 0;
 const aliases = {"dev":"dev","build":"build","preview":"preview","verify":"verify","export":"export","import":"import","setup":"setup","deploy":"deploy","reset":"reset","release":"release","outbox":"outbox","doctor":"doctor","describe":"describe","check":"check","deps":"install","rer":""}, alias = command[offset];
 if (!Object.hasOwn(aliases, alias)) return [program, args];
 const forwarded = command.slice(offset + 1); if (forwarded[0] === '--') forwarded.shift();
 const launch = __rerTestEntryArgs([__rerTestEntry, ...(aliases[alias] ? [aliases[alias]] : []), ...forwarded]);
 return at < 0 ? [process.execPath, launch] : [program, [...args.slice(0, at), process.execPath, ...launch]];
};
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createHash,randomBytes} from 'node:crypto'
import {mkdtemp,rm,writeFile,readFile,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {tlsIdentity,workerRuntime} from './tls-runtime.mjs'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
async function cli(identity,command,origin,session,args,expected=0,prefix=[]) {
 const child=spawn(...__rerTestEntryPnpm('pnpm', ['run',command,'--',...prefix,'--origin',origin,'--session-file',session,...args]),{env:{...process.env,NODE_EXTRA_CA_CERTS:identity.certificate},stdio:['ignore','pipe','pipe']})
 const stdout=[],stderr=[];child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>stderr.push(b))
 const code=await new Promise((r,j)=>{child.on('error',j);child.on('exit',r)})
 const out=Buffer.concat(stdout).toString(),err=Buffer.concat(stderr).toString()
 assert.ok(code===expected,'Literal data command exit mismatch: '+(err.match(/(?:data_[a-z0-9_]+|invalid_[a-z0-9_]+|unsafe_[a-z0-9_]+|private_[a-z0-9_]+|origin_and_private_session_file_required)/g)?.join(',')??'unclassified'))
 assert.ok(!out.includes('operator_session=')&&!err.includes('operator_session='),'Session leaked into command output')
 if(code!==0)return {code,error:err}
 return JSON.parse(out.trim().split('\n').at(-1))
}
async function sessionFile(dir,name,cookie){const path=join(dir,name);await writeFile(path,JSON.stringify({cookie}),{mode:0o600});return path}
async function seedGraph(runtime) {
 const db=await runtime.db(),bucket=await runtime.bucket(),stamp='2026-10-01T00:00:00.000Z',bytes=Buffer.from([0,255,137,80,78,71,31,10])
 await db.batch([
  db.prepare("INSERT INTO boards(id,slug,name,visibility,position,created_at,updated_at) VALUES('tls-board','feedback','Feedback','public',0,?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO requesters(id,display_name,created_at,updated_at) VALUES('tls-requester','Historical Person',?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO requester_addresses(id,requester_id,email,verified_at,created_at,updated_at) VALUES('tls-address','tls-requester','person@example.test',?,?,?)").bind(stamp,stamp,stamp),
  db.prepare("INSERT INTO requests(id,slug,board_id,author_requester_id,title,description,moderation_state,public_state,created_at,updated_at) VALUES('tls-request-root','request','tls-board','tls-requester','Supplied request','Private original wording','awaiting_review','open',?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO request_votes(request_id,requester_id,created_at,updated_at) VALUES('tls-request-root','tls-requester',?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO attachments(id,request_id,storage_key,original_filename,content_type,byte_size,public_state,created_at,updated_at) VALUES('tls-attachment','tls-request-root','original-file','Original.bin','application/octet-stream',?,'operator_only',?,?)").bind(bytes.length,stamp,stamp),
  db.prepare("INSERT INTO notification_events(id,request_id,kind,subject_id,body,created_at,updated_at) VALUES('tls-status-event','tls-request-root','status','tls-status-event','Historical status',?,?)").bind(stamp,stamp),
  db.prepare("INSERT INTO notification_batches(id,requester_id,address_id,request_id,first_event_id,window_start,window_end,state,next_attempt_at,created_at,updated_at) VALUES('tls-notification-batch','tls-requester','tls-address','tls-request-root','tls-status-event',?,?,'queued',?,?,?)").bind(stamp,stamp,stamp,stamp,stamp),
 ])
 await bucket.put('original-file',bytes);return {fileHash:hash(bytes)}
}
test('[DATA-001 DATA-003 BASE-ACCESS-002 BASE-SECRET-002] source-only, local TLS: hosted commands restore and erase with native authority and custody fences', {timeout:180000},async()=>{
 // The commands refuse symlinked private-file parents; macOS tmpdir can use /var.
 const dir=await mkdtemp(join(await realpath(tmpdir()),'penny-native-export-'));let source,target
 try {
  const identity=await tlsIdentity(dir);source=await workerRuntime(join(dir,'source-state'),identity);await source.migrate()
  assert.equal((await source.call('/health')).status,200)
  assert.equal((await source.call('/api/operator/data/export')).status,401)
  const sourceCookie=await source.owner(),sourceSession=await sessionFile(dir,'source-session.json',sourceCookie),original=await seedGraph(source)
  const saved={namespace:'portable-history',statuses:{open:'open',planned:'planned'},files:[]}
  for(const kind of ['boards','users','posts','votes','comments','tags']){
   const name=kind+'.json',path=join(dir,name);await writeFile(path,await readFile(new URL('../fixtures/imports/'+name,import.meta.url)),{mode:0o600})
   saved.files.push({name,path:name,kind,version:['users','votes','comments'].includes(kind)?'v2':'v1'})
  }
  const sourcePath=join(dir,'source.json');await writeFile(sourcePath,JSON.stringify(saved),{mode:0o600})
  const feedback=(action,args)=>cli(identity,'feedback:import',source.origin,sourceSession,args,0,[action])
  const planned=await feedback('preview',['--source',sourcePath,'--out',join(dir,'preview.json')]);assert.equal(planned.counts.rejected,0)
  let job=await feedback('apply',['--source',sourcePath,'--fingerprint',planned.fingerprint]);const jobId=job.id;assert.ok(job.checkpoint>0)
  await source.restart()
  for(let step=0;step<20&&job.state!=='completed';step++)job=await feedback('resume',['--job',jobId])
  assert.equal(job.state,'completed');assert.equal((await feedback('apply',['--source',sourcePath,'--fingerprint',planned.fingerprint])).id,jobId)
  const sourceDb=await source.db();assert.ok(await sourceDb.prepare('SELECT COUNT(*) n FROM feedback_import_records').first('n')>0)
  const archivePath=join(dir,'archive.json'),receipt=await cli(identity,'data:export',source.origin,sourceSession,[archivePath])
  const inventory=JSON.parse(await readFile(new URL('../../src/core/features/data/schema-inventory.json',import.meta.url)))
  const tableCount=Object.values(inventory).filter(table=>table.classification==='product').length
  assert.equal(receipt.tableCount,tableCount);assert.equal(receipt.fileCount,1)
  const snapshot=JSON.parse(await readFile(archivePath,'utf8'))
  assert.equal(snapshot.files[0].sha256,original.fileHash);assert.ok(!JSON.stringify(snapshot).includes(sourceCookie.split('=')[1]))
  assert.equal(snapshot.tables.notification_batches[0].state,'queued');assert.equal(snapshot.tables.notification_batches[0].failure_reason,'restored_delivery_review_required')
  const journal=JSON.parse(await readFile(archivePath+'.erasure-journal.json','utf8'))
  const occupied=await source.call('/api/operator/data/import',{archive:snapshot,journal},{Cookie:sourceCookie})
  assert.equal(occupied.status,409);assert.equal(JSON.parse(occupied.text).error,'restore_requires_empty_target')
  const stamp=new Date().toISOString(),requesterToken=randomBytes(32).toString('base64url')
  await sourceDb.prepare("INSERT INTO native_requester_sessions(id,requester_id,address_id,token_hash,expires_at,last_used_at,created_at,updated_at) VALUES('tls-requester-session','tls-requester','tls-address',?,?,?,?,?)").bind(hash(requesterToken),new Date(Date.now()+60000).toISOString(),stamp,stamp,stamp).run()
  assert.equal((await source.call('/api/public/identity/session',undefined,{Authorization:'Bearer '+requesterToken})).status,200)
  const mutations=['import','erasure/preview','erasure','operations/missing/resume','operations/missing/abort-restore','operations/missing/recover-runner','operations/missing/abort-export','operations/missing/abort-pending-erasure']
  for(const path of mutations){
   assert.equal((await source.call('/api/operator/data/'+path,{})).status,401)
   assert.equal((await source.call('/api/operator/data/'+path,{},{Authorization:'Bearer '+requesterToken})).status,401)
   assert.equal((await source.call('/api/operator/data/'+path,{},{Cookie:sourceCookie,Origin:'https://foreign.test'})).status,403)
   assert.equal((await source.call('/api/operator/data/'+path,{},{Cookie:sourceCookie,Origin:''})).status,403)
  }
  assert.equal((await source.call('/api/operator/data/export',undefined,{Cookie:sourceCookie})).headers['cache-control'],'private, no-store')
  await source.restart()
  assert.equal((await source.call('/api/operator/data/journal',undefined,{Cookie:sourceCookie})).status,200)
  const reopenedDb=await source.db(),expiry=await reopenedDb.prepare('SELECT expires_at FROM oa_sessions').first('expires_at')
  await reopenedDb.prepare('UPDATE oa_sessions SET expires_at=?').bind(Date.now()-1).run()
  for(const path of mutations)assert.equal((await source.call('/api/operator/data/'+path,{},{Cookie:sourceCookie})).status,401)
  assert.equal((await source.call('/api/operator/data/export',undefined,{Cookie:sourceCookie})).status,401)
  await reopenedDb.prepare('UPDATE oa_sessions SET expires_at=?,revoked_at=?').bind(expiry,Date.now()).run()
  for(const path of mutations)assert.equal((await source.call('/api/operator/data/'+path,{},{Cookie:sourceCookie})).status,401)
  assert.equal((await source.call('/api/operator/data/export',undefined,{Cookie:sourceCookie})).status,401)
  assert.equal(source.outboundCalls,0);await source.stop();source=undefined
  target=await workerRuntime(join(dir,'target-state'),identity);await target.migrate()
  const targetCookie=await target.owner(),targetSession=await sessionFile(dir,'target-session.json',targetCookie),db=await target.db()
  const authorityHash=hash(JSON.stringify((await db.prepare('SELECT * FROM oa_operators').all()).results))
  const corrupt=structuredClone(snapshot);corrupt.tables.requests[0].title='Tampered'
  const corruptPath=join(dir,'corrupt.json');await writeFile(corruptPath,JSON.stringify(corrupt),{mode:0o600})
  await cli(identity,'data:import',target.origin,targetSession,[corruptPath,'--journal',archivePath+'.erasure-journal.json'],1)
  assert.equal(await db.prepare('SELECT count(*) n FROM requests').first('n'),0)
  assert.equal((await target.call('/api/operator/data/import',{archive:snapshot},{Cookie:targetCookie})).status,400)
  const targetBucket=await target.bucket()
  await targetBucket.put('preexisting-original',Buffer.from('Destination-owned original'))
  const occupiedBucket=await target.call('/api/operator/data/import',{archive:snapshot,journal},{Cookie:targetCookie})
  assert.equal(occupiedBucket.status,409);assert.equal(JSON.parse(occupiedBucket.text).error,'restore_requires_empty_bucket')
  assert.equal(await (await targetBucket.get('preexisting-original')).text(),'Destination-owned original')
  await targetBucket.delete('preexisting-original')
  const restored=await cli(identity,'data:import',target.origin,targetSession,[archivePath,'--journal',archivePath+'.erasure-journal.json'])
  assert.equal(restored.status,'complete')
  assert.equal((await target.call('/api/operator/data/import',{archive:snapshot,journal,resumeOperationId:restored.operationId},{Cookie:targetCookie})).status,200)
  assert.equal((await target.call('/auth/session',undefined,{Cookie:targetCookie})).status,200)
  assert.ok(hash(JSON.stringify((await db.prepare('SELECT * FROM oa_operators').all()).results))===authorityHash)
  assert.equal((await cli(identity,'data:import',target.origin,targetSession,[archivePath,'--journal',archivePath+'.erasure-journal.json','--resume',restored.operationId])).status,'complete')
  const secondPath=join(dir,'roundtrip.json');await cli(identity,'data:export',target.origin,targetSession,[secondPath])
  const second=JSON.parse(await readFile(secondPath,'utf8'));second.tables.audit_entries=second.tables.audit_entries.filter(row=>row.action!=='data.restored')
  assert.deepEqual(second.tables,snapshot.tables);assert.deepEqual(second.files,snapshot.files)
  assert.equal(hash(Buffer.from(second.files[0].bytes,'base64')),original.fileHash)
  assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0)
  const root={table:'requests',id:'tls-request-root'},cookie={Cookie:targetCookie},planPath=join(dir,'erasure-plan.json')
  await cli(identity,'data:erase-preview',target.origin,targetSession,['requests','tls-request-root',planPath])
  const stalePlan=JSON.parse(await readFile(planPath,'utf8'));assert.equal(stalePlan.fileCount,1)
  assert.equal((await target.call('/api/operator/data/erasure',root,cookie)).status,400)
  await db.prepare("UPDATE requests SET description='Revised private original wording' WHERE id='tls-request-root'").run()
  const stale=await target.call('/api/operator/data/erasure',{...root,planHash:stalePlan.planHash},cookie)
  assert.equal(stale.status,409);assert.equal(JSON.parse(stale.text).error,'erasure_plan_changed')
  const currentPlan=join(dir,'current-plan.json')
  await cli(identity,'data:erase-preview',target.origin,targetSession,['requests','tls-request-root',currentPlan])
  const latestJournal=join(dir,'latest-target-journal.json'),erased=await cli(identity,'data:erase',target.origin,targetSession,[currentPlan,'--journal-out',latestJournal])
  assert.equal(erased.status,'complete');assert.equal(await (await target.bucket()).head('original-file'),null)
  assert.equal(await db.prepare("SELECT count(*) n FROM requests WHERE id='tls-request-root'").first('n'),0)
  assert.equal(await db.prepare("SELECT count(*) n FROM attachments WHERE storage_key='original-file'").first('n'),0)
  assert.equal((await cli(identity,'data:status',target.origin,targetSession,[erased.operationId])).status,'complete')
  assert.equal((await cli(identity,'data:resume-erasure',target.origin,targetSession,[erased.operationId,'--journal-out',latestJournal])).status,'complete')
  const oldJournal=await target.call('/api/operator/data/import',{archive:snapshot,journal},cookie)
  assert.equal(oldJournal.status,409);assert.equal(JSON.parse(oldJournal.text).error,'erasure_journal_regression')
  const currentJournal=JSON.parse(await readFile(latestJournal,'utf8'))
  const oldArchive=await target.call('/api/operator/data/import',{archive:snapshot,journal:currentJournal},cookie)
  assert.equal(oldArchive.status,409);assert.equal(JSON.parse(oldArchive.text).error,'stale_archive')
  // Existing recovery doors remain guarded by actual durable lock/status state.
  for(const kind of ['export','erase','restore']){
   const id='interrupted-'+kind,now=new Date().toISOString()
   await db.batch([
    db.prepare("UPDATE data_state SET phase='locked',lock_id=? WHERE singleton=1").bind(id),
    db.prepare("INSERT INTO data_operations(id,kind,status,payload_json,created_at,updated_at) VALUES(?,?,'running','{}',?,?)").bind(id,kind,now,now),
   ])
   const recovery='/api/operator/data/operations/'+id+'/recover-runner'
   assert.equal((await target.call(recovery,{expectedStatus:'running'},cookie)).status,400)
   assert.equal((await target.call(recovery,{expectedStatus:'running_r2',confirmPriorRunnerStopped:true},cookie)).status,409)
   await cli(identity,'data:recover-runner',target.origin,targetSession,[id,'--expected-status','running','--prior-runner-stopped'])
   await cli(identity,kind==='erase'?'data:abort-pending-erasure':'data:abort-'+kind,target.origin,targetSession,[id,...(kind==='restore'?[]:['--prior-runner-stopped'])])
   assert.equal((await cli(identity,'data:status',target.origin,targetSession,[id])).status,'aborted')
  }
  assert.deepEqual(await db.prepare('SELECT phase,lock_id FROM data_state').first(),{phase:'idle',lock_id:null})
  assert.equal(target.outboundCalls,0)
  console.log(JSON.stringify({scope:'source-only, local TLS',statuses:{noSession:401,expiredSession:401,revokedSession:401,requesterToken:401,foreignOrigin:403,missingOrigin:403,missingPreview:400,stalePreview:409,nonemptyTarget:409,nonemptyBucket:409,missingJournal:400,olderJournal:409,oldArchiveLatestJournal:409,validRestore:200,fileRootErasure:200,recovery:204,abort:204},filesRemoved:true,providerCalls:0}))
  console.log(JSON.stringify({scope:'source-only, local TLS emitted production-mode Worker with saved history to isolated production-mode target',tableCount,rowCount:receipt.rowCount,fileCount:1,fileSha256:original.fileHash,importRecords:snapshot.tables.feedback_import_records.length,retainedOriginals:snapshot.tables.ik_originals.length,nativeAuthorityPreserved:true,providerCalls:0,completeRowComparison:true}))
 }finally{await source?.stop();await target?.stop();await rm(dir,{recursive:true,force:true})}
})
