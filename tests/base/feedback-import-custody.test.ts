import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,expect,inject,it } from 'vitest'
import { Buffer } from 'node:buffer'
import { call,env,origin,owner,requester,mockMail } from './support'
import { apply,complete,counts,erasurePreview,feedbackFixture,exportFeedbackFixture,importPath,preview } from './feedback-import-fixture'
import { stableFeedbackId } from '@/core/features/imports/mapping-support'
import { canonical,exportArchive,restoreArchive } from '@/core/features/data/archive'
import { digest } from '@/core/features/auth/native-tokens'
import { createPennyApi } from '@/core/app/api'
import { observeD1 } from './review-race-storage'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
async function finishErasure(response:Response,operator:Record<string,string>){
 expect([200,202]).toContain(response.status);let result=await response.json() as {operationId:string;status:string}
 for(let step=0;step<100&&result.status!=='complete';step++){
  const next=await call('/api/operator/data/operations/'+result.operationId+'/resume',{},operator);expect([200,202],await next.clone().text()).toContain(next.status);result=await next.json() as typeof result
 }
 expect(result.status).toBe('complete')
}

async function refuseReleaseLinks(jobId:string,operator:Record<string,string>){
 const actor=await env.DB.prepare('SELECT id FROM operators LIMIT 1').first('id'),now=new Date().toISOString()
 await env.DB.prepare("INSERT INTO releases(id,slug,state,author_operator_id,created_at,updated_at) VALUES('later-native-release','later-native-release','draft',?,?,?)").bind(actor,now,now).run()
 const link=()=>env.DB.prepare("UPDATE evidence_items SET release_id='later-native-release'").run()
 const rows=async()=>(await env.DB.prepare('SELECT * FROM evidence_items ORDER BY id').all()).results
 const before=await counts();await link();const linked=await rows()
 expect((await call(importPath+'/jobs/'+jobId+'/undo',{},operator)).status).toBe(409)
 expect(await counts()).toEqual(before);expect(await rows()).toEqual(linked)
 await env.DB.prepare('UPDATE evidence_items SET release_id=NULL').run()
 // Observe the real D1 transport: add the outgoing link after all native reads,
 // immediately before the first transaction that would remove evidence.
 let raced=false,racedCounts:Awaited<ReturnType<typeof counts>>|undefined,racedRows:Awaited<ReturnType<typeof rows>>|undefined
 const db=observeD1(env.DB,{before:async sql=>{if(!raced&&sql.some(statement=>statement.includes('DELETE FROM "evidence_items"'))){raced=true;await link();racedCounts=await counts();racedRows=await rows()}}})
 const api=createPennyApi()
 for(let attempt=0;attempt<20&&!raced;attempt++){
  const response=await api.fetch(new Request(origin+importPath+'/jobs/'+jobId+(attempt?'/resume':'/undo'),{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...operator},body:'{}'}),{...env,DB:db})
  expect(response.status,await response.clone().text()).toBe(raced?409:200)
  if(!raced)expect((await response.json() as {state:string}).state).toBe('undoing')
 }
 expect(raced).toBe(true);expect(await counts()).toEqual(racedCounts);expect(await rows()).toEqual(racedRows)
 await env.DB.prepare('UPDATE evidence_items SET release_id=NULL').run()
}
async function refuseSharedTransferIdentity(jobId:string,operator:Record<string,string>){
 const transfer=await env.DB.prepare('SELECT merge_id,comment_id FROM request_merge_comment_transfers LIMIT 1').first<{merge_id:string;comment_id:string}>()
 expect(transfer).not.toBeNull()
 const later=new Date().toISOString()
 await env.DB.prepare('INSERT INTO request_merge_comment_transfers(merge_id,comment_id,created_at) VALUES(?,?,?)').bind(transfer!.merge_id,transfer!.comment_id,later).run()
 const before=await counts(),rows=await env.DB.prepare('SELECT * FROM request_merge_comment_transfers ORDER BY rowid').all()
 const response=await call(importPath+'/jobs/'+jobId+'/undo',{},operator)
 expect(response.status,await response.clone().text()).toBe(409)
 expect(await counts()).toEqual(before)
 expect((await env.DB.prepare('SELECT * FROM request_merge_comment_transfers ORDER BY rowid').all()).results).toEqual(rows.results)
 await env.DB.prepare('DELETE FROM request_merge_comment_transfers WHERE merge_id=? AND comment_id=? AND created_at=?').bind(transfer!.merge_id,transfer!.comment_id,later).run()
}
it.each(['api','export'] as const)('[IMP-003][IMP-004] resumes %s persisted jobs, repeats exactly and undoes only unchanged imported effects',async family=>{
 const operator=await owner(),source=family==='api'?feedbackFixture():exportFeedbackFixture(),plan=await preview(source,operator)
 const response=await call(importPath+'/apply',{source,fingerprint:plan.fingerprint},operator),partial=await response.json() as {id:string;state:string;checkpoint:number}
 expect(response.status,JSON.stringify(partial)).toBe(202);expect(partial.checkpoint).toBeGreaterThan(0)
 // A subsequent request has no source bytes or mapper, only persisted job ID.
 const job=await complete(partial,operator),before=await counts(),repeat=await apply(source,operator)
 expect(repeat.id).toBe(job.id);expect(await counts()).toEqual(before)
 const changed=structuredClone(source),postFile=changed.files.find(file=>file.kind==='posts')!
 postFile.base64=Buffer.from(Buffer.from(postFile.base64,'base64').toString().replace('Readable labels','Changed saved wording')).toString('base64')
 const conflict=await preview(changed,operator);expect(conflict.counts.rejected).toBeGreaterThan(0)
 expect((await call(importPath+'/apply',{source:changed,fingerprint:conflict.fingerprint},operator)).status).toBe(422);expect(await counts()).toEqual(before)
 if(family==='api'){await refuseSharedTransferIdentity(job.id,operator);await refuseReleaseLinks(job.id,operator)}
 let undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status,(await undo.clone().text())+JSON.stringify((await env.DB.prepare('SELECT * FROM feedback_import_receipt_notes').all()).results)).toBe(200)
 const reversed=await complete(await undo.json() as typeof partial,operator);expect(reversed.state).toBe('undone')
 expect(Object.values(await counts())).toEqual(Array(10).fill(0))
 undo=await call(importPath+'/jobs/'+job.id+'/undo',{},operator);expect(undo.status).toBe(200)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM ik_originals').first<{n:number}>())!.n).toBeGreaterThan(0)
})
it('[IMP-004] refuses undo after later native wording, votes, follows, comments, publication or unmerge and preserves the complete graph',async()=>{
 const operator=await owner(),source=feedbackFixture(),job=await apply(source,operator),slug='feedback-'+stableFeedbackId(source.namespace,'posts','post-0').toLowerCase()
 expect((await call('/api/operator/moderation/'+slug,{verdict:'approved',title:'Approved imported request',description:'Native approved public wording',boardSlug:'import-'+stableFeedbackId(source.namespace,'boards','public-board').toLowerCase(),displayName:'Historical contributor'},operator)).status).toBe(200)
 expect((await call('/api/operator/requests/'+slug+'/comments',{body:'Later operator work'},operator)).status).toBe(201)
 mockMail();const person=await requester('Later native contributor')
 expect((await call('/api/public/requests/'+slug+'/vote',{},person)).status).toBe(204)
 expect((await call('/api/public/requests/'+slug+'/follow',{},person)).status).toBe(204)
 expect((await call('/api/operator/requests/'+slug+'/status-updates',{status:'under_review',body:'Explicit later public update',pinned:false},operator)).status).toBe(200)
 const nativeTables=['request_vote_contributions','request_follow_contributions','request_status_updates','requester_addresses','native_requester_sessions']
 const nativeRows=()=>env.DB.batch(nativeTables.map(table=>env.DB.prepare('SELECT * FROM '+table+' ORDER BY rowid')))
 const nativeBefore=(await nativeRows()).map(result=>result.results)
 const before=await counts();expect((await call(importPath+'/jobs/'+job.id+'/undo',{},operator)).status).toBe(409);expect(await counts()).toEqual(before)
 expect((await nativeRows()).map(result=>result.results)).toEqual(nativeBefore)
 const merged='feedback-'+stableFeedbackId(source.namespace,'posts','post-1').toLowerCase()
 expect((await call('/api/operator/requests/'+merged+'/unmerge',{},operator)).status).toBe(200)
 const after=await counts();expect((await call(importPath+'/jobs/'+job.id+'/undo',{},operator)).status).toBe(409);expect(await counts()).toEqual(after)
 const checkpointJob=await apply(feedbackFixture('reversal-checkpoint'),operator)
 const undo=await call(importPath+'/jobs/'+checkpointJob.id+'/undo',{},operator);expect(undo.status,(await undo.clone().text())+JSON.stringify((await env.DB.prepare('SELECT * FROM feedback_import_receipt_notes').all()).results)).toBe(200)
 expect((await undo.json() as {state:string}).state).toBe('undoing')
 const remaining=await env.DB.prepare("SELECT r.slug FROM requests r JOIN feedback_import_records f ON f.target_id=r.id WHERE f.namespace='reversal-checkpoint' AND f.target_kind='posts' LIMIT 1").first<{slug:string}>();expect(remaining).not.toBeNull()
 expect((await call('/api/operator/requests/'+remaining!.slug+'/notes',{body:'Native work after reversal checkpoint'},operator)).status).toBe(201)
 const checkpointCounts=await counts();expect((await call(importPath+'/jobs/'+checkpointJob.id+'/resume',{},operator)).status).toBe(409);expect(await counts()).toEqual(checkpointCounts)
 const wordingSource=feedbackFixture('later-native-wording'),wordingJob=await apply(wordingSource,operator),evidenceId=stableFeedbackId(wordingSource.namespace,'evidence','post-0')
 expect((await call('/api/operator/evidence/'+evidenceId+'/wording',{wording:'Later native evidence wording',expectedVersionId:stableFeedbackId(wordingSource.namespace,'evidence-version','post-0')},operator,'PATCH')).status).toBe(200)
 const evidenceRows=async()=>(await env.DB.prepare('SELECT * FROM evidence_versions WHERE evidence_id=? ORDER BY version_number').bind(evidenceId).all()).results
 const evidenceBefore=await evidenceRows(),countsBefore=await counts()
 expect(evidenceBefore).toHaveLength(2)
 expect((await call(importPath+'/jobs/'+wordingJob.id+'/undo',{},operator)).status).toBe(409)
 expect(await counts()).toEqual(countsBefore);expect(await evidenceRows()).toEqual(evidenceBefore)
})
it('[IMP-003][BASE-ACCESS-002] keeps a failed late D1 batch resumable and rolls back revoked-authority creation atomically',async()=>{
 const operator=await owner(),source=feedbackFixture(),plan=await preview(source,operator)
 await env.DB.prepare("CREATE TRIGGER fail_import_comment BEFORE INSERT ON request_comments BEGIN SELECT RAISE(ABORT,'test_late_sql_failure'); END").run()
 const initial=await call(importPath+'/apply',{source,fingerprint:plan.fingerprint},operator),partial=await initial.json() as {id:string;state:string;checkpoint:number};expect(initial.status).toBe(202)
 expect((await call(importPath+'/jobs/'+partial.id+'/resume',{},operator)).status).toBe(409)
 expect((await counts()).request_comments).toBe(0)
 await env.DB.prepare('DROP TRIGGER fail_import_comment').run();expect((await complete(partial,operator)).state).toBe('completed')
 const other={...feedbackFixture('other-history')},next=await preview(other,operator),before=await counts()
 await env.DB.prepare("CREATE TRIGGER revoke_import_owner AFTER INSERT ON ik_jobs BEGIN UPDATE oa_operators SET status='inactive' WHERE role!='owner'; UPDATE oa_sessions SET revoked_at=1; END").run()
 expect((await call(importPath+'/apply',{source:other,fingerprint:next.fingerprint},operator)).status).toBe(409)
 expect(await counts()).toEqual(before)
 expect((await env.DB.prepare('SELECT COUNT(*) n FROM ik_jobs').first<{n:number}>())!.n).toBe(1)
})
it.each(['stream','ordinary'] as const)('[IMP-003][IMP-004] keeps a partial %s in rollback after native work invalidates its reversal scan',async family=>{
 const {boundedFeedbackFixture}=await import('./feedback-import-fixture'),operator=await owner(),source=family==='stream'?boundedFeedbackFixture('rollback-intent'):feedbackFixture('rollback-intent')
 const reviewed=await preview(source,operator),started=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator)
 expect(started.status,await started.clone().text()).toBe(202)
 let job=await started.json() as {id:string;state:string;checkpoint:number;total:number}
 for(let step=0;step<10&&(await counts()).requests===0;step++){
  const response=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(response.status,await response.clone().text()).toBe(200);job=await response.json() as typeof job
 }
 expect(job.state).toBe('applying');expect(job.checkpoint).toBeLessThan(job.total);expect((await counts()).requests).toBeGreaterThan(0)
 const checkpoints=async()=>(await env.DB.prepare('SELECT id,state,checkpoint FROM ik_jobs WHERE id IN (SELECT job_id FROM ik_d1_stream_pages WHERE stream_id=? UNION SELECT ?) ORDER BY id').bind(job.id,job.id).all()).results
 const before=await counts(),progress=await checkpoints()
 if(family==='stream'){
  const rollback=await call(importPath+'/jobs/'+job.id+'/rollback',{},operator)
  expect(rollback.status,await rollback.clone().text()).toBe(200);expect(await rollback.json()).toMatchObject({id:job.id,state:'preflighting',checkpoint:job.checkpoint})
  expect(await counts()).toEqual(before);expect(await checkpoints()).toEqual(progress)
 }
 const evidence=await env.DB.prepare('SELECT id,evidence_id FROM evidence_versions LIMIT 1').first<{id:string;evidence_id:string}>();expect(evidence).not.toBeNull()
 expect((await call('/api/operator/evidence/'+evidence!.evidence_id+'/wording',{wording:'Native wording after choosing rollback',expectedVersionId:evidence!.id},operator,'PATCH')).status).toBe(200)
 const rows=async()=>(await env.DB.prepare('SELECT * FROM evidence_versions ORDER BY evidence_id,version_number').all()).results,nativeRows=await rows()
 if(family==='ordinary')expect((await call(importPath+'/jobs/'+job.id+'/rollback',{},operator)).status).toBe(409)
 const refuseReplay=async()=>{const replay=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator);expect(replay.status,await replay.clone().text()).toBe(409);expect(await replay.text()).toContain(job.id)}
 await refuseReplay()
 for(let attempt=0;attempt<2;attempt++){
  const response=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(response.status,await response.clone().text()).toBe(409)
  await refuseReplay()
  expect(await counts()).toEqual(before);expect(await checkpoints()).toEqual(progress);expect(await rows()).toEqual(nativeRows)
 }
 const saved=await call(importPath+'/jobs/'+job.id,undefined,operator);expect(saved.status).toBe(200);expect(await saved.json()).toMatchObject({id:job.id,state:'preflighting',checkpoint:job.checkpoint})
},60000)
it.each(['current','legacy'] as const)('[IMP-005][DATA-001] erasure purges exact retained %s history and blocks old source resurrection',async family=>{
 let operator=await owner()
 const source={namespace:'historical-person',statuses:{},files:[{name:'users.json',kind:'users' as const,version:'v2' as const,base64:Buffer.from(JSON.stringify({users:[{id:'person',name:'Erased historical speaker',created:'2024-07-08T09:10:11.000Z',profile:'Private saved profile. '.repeat(4000)}]})).toString('base64')}]}
 const {populateFeedback}=await import('./feedback-import-fixture')
 const job=await (family==='legacy'?populateFeedback(source,operator):apply(source,operator)),id=stableFeedbackId(source.namespace,'users','person')
 const snapshot=await exportArchive(env.DB,env.FILES)
 expect(snapshot.archive.tables.ik_d1_plan_chunks.length).toBeGreaterThan(0)
 expect(snapshot.archive.tables.ik_d1_creation_plans).toEqual([])
 await reset();await applyD1Migrations(env.DB,inject('migrations'));operator=await owner()
 const authority=(await env.DB.prepare('SELECT * FROM oa_sessions').all()).results
 for(const [table,column] of [['ik_d1_plan_chunks','body'],['ik_d1_original_chunks','bytes'],['ik_d1_plan_index','target_identity']]){
  const corrupt=structuredClone(snapshot.archive);corrupt.tables[table][0][column]+='changed'
  const {sha256:ignored,...body}=corrupt;void ignored;corrupt.sha256=await digest(canonical(body))
  await expect(restoreArchive(env.DB,env.FILES,corrupt,snapshot.journal)).rejects.toMatchObject({code:'feedback_archive_custody_invalid'})
 }
 expect((await restoreArchive(env.DB,env.FILES,snapshot.archive,snapshot.journal)).status).toBe('complete')
 const restored=await exportArchive(env.DB,env.FILES)
 for(const table of Object.keys(snapshot.archive.tables).filter(name=>name.startsWith('ik_')||name.startsWith('feedback_import_')))expect(restored.archive.tables[table],table).toEqual(snapshot.archive.tables[table])
 expect((await env.DB.prepare('SELECT * FROM oa_sessions').all()).results).toEqual(authority)
 const previewResponse=await erasurePreview('requesters',id,operator)
 const plan=await previewResponse.json() as {planHash:string;blockedCopies:unknown[]};expect(plan.blockedCopies).toEqual([])
 const erased=await call('/api/operator/data/erasure',{table:'requesters',id,planHash:plan.planHash},operator);await finishErasure(erased,operator)
 expect((await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).status).toBe(200)
 for(const table of ['ik_d1_original_chunks','ik_d1_creation_plans','feedback_import_records','requesters'])expect((await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first<{n:number}>())!.n).toBe(0)
 const old=await preview(source,operator);expect((await call(importPath+'/apply',{source,fingerprint:old.fingerprint},operator)).status).toBe(422)
 expect((await counts()).requesters).toBe(0)
 const erasedSnapshot=await exportArchive(env.DB,env.FILES)
 expect(JSON.stringify(erasedSnapshot)).not.toContain('Private saved profile');expect(JSON.stringify(erasedSnapshot)).not.toContain(source.files[0].base64)
 expect(erasedSnapshot.archive.tables.ik_d1_erased_sources.length).toBeGreaterThan(0)
 expect(erasedSnapshot.archive.tables.ik_d1_erased_targets.length).toBeGreaterThan(0)
 await reset();await applyD1Migrations(env.DB,inject('migrations'));operator=await owner()
 expect((await restoreArchive(env.DB,env.FILES,erasedSnapshot.archive,erasedSnapshot.journal)).status).toBe('complete')
 const reviewed=await preview(source,operator),refused=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator)
 expect(refused.status).toBe(422);expect(await refused.json()).toEqual({error:'feedback_mapping_rejected'})
},60000)
it.each(['request','requester','evidence','streamed evidence','legacy evidence'] as const)('[IMP-005][IMP-006][IMP-007] preserves an Ideas receipt through restore and erases its %s with an opaque replay fence',async kind=>{
 const {ideasFeedbackFixture}=await import('./feedback-import-fixture')
 let operator=await owner();const source=ideasFeedbackFixture('ideas-erasure-'+kind.replace(' ','-')),evidenceRoot=kind.endsWith('evidence')
 if(kind==='streamed evidence')source.files.push({name:'users.json',kind:'users',version:'v2',base64:Buffer.from(JSON.stringify({users:Array.from({length:210},(_,i)=>({id:'unrelated-'+i,name:'Other historical contributor '+i,created:'2024-07-08T09:10:11.000Z'}))})).toString('base64')})
 if(kind==='requester'){const file=source.files[0];file.ideas!.author='Original requester';file.base64=Buffer.from(Buffer.from(file.base64,'base64').toString().replace('Companies\r\n','Companies,Original requester\r\n').replace('"Acme, Inc."\r\n','"Acme, Inc.",Historical supplied requester\r\n')).toString('base64')}
 const {populateFeedback}=await import('./feedback-import-fixture')
 const job=await (kind==='legacy evidence'?populateFeedback(source,operator):apply(source,operator)),saved=await exportArchive(env.DB,env.FILES)
 const {jobPlans}=await import('@/core/features/imports/receipt-read')
 for await(const {plan} of jobPlans(job.id,env.DB,kind==='streamed evidence')){
  const {artifacts:originals,...retained}=plan.source;void originals
  if(kind==='legacy evidence')expect(JSON.stringify(retained)).toContain(source.files[0].base64)
  else for(const file of source.files)expect(JSON.stringify(retained)).not.toContain(file.base64)
 }
 await reset();await applyD1Migrations(env.DB,inject('migrations'));operator=await owner()
 expect((await restoreArchive(env.DB,env.FILES,saved.archive,saved.journal)).status).toBe('complete')
 const restored=await exportArchive(env.DB,env.FILES)
 for(const table of Object.keys(saved.archive.tables).filter(name=>name.startsWith('ik_')||name.startsWith('feedback_import_')))expect(restored.archive.tables[table],table).toEqual(saved.archive.tables[table])
 const receipt=await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator);expect(receipt.status,await receipt.clone().text()).toBe(200);expect(await receipt.json()).toMatchObject({phase:'completed',effects:{mail:0,notifications:0}})
 const requestId=stableFeedbackId(source.namespace,'posts','idea-1')
 if(evidenceRoot){
  // This fixture models later independently authored native request wording.
  // The supported public erasure route must remove only its imported evidence.
  await env.DB.prepare('UPDATE requests SET title=?,description=? WHERE id=?').bind('Later independent request','New native description',requestId).run()
  expect((await call('/api/operator/requests/feedback-'+requestId.toLowerCase()+'/notes',{body:'Keep this later native work'},operator)).status).toBe(201)
 }
 const nativeRows=async()=>(await env.DB.batch(['requests','request_notes','request_canonical_roots'].map(table=>env.DB.prepare('SELECT * FROM '+table+' ORDER BY 1')))).map(result=>result.results),nativeBefore=await nativeRows()
 const table=evidenceRoot?'evidence_items':kind==='request'?'requests':'requesters',id=stableFeedbackId(source.namespace,evidenceRoot?'evidence':kind==='request'?'posts':'users',kind==='requester'?'csv-author:idea-1':'idea-1')
 let previewResponse=await call('/api/operator/data/erasure/preview',{table,id},operator)
 while(previewResponse.status===202){const {continuation}=await previewResponse.json() as {continuation:string};previewResponse=await call('/api/operator/data/erasure/preview',{table,id,continuation},operator)}
 expect(previewResponse.status,await previewResponse.clone().text()).toBe(200)
 const plan=await previewResponse.json() as {planHash:string;blockedCopies:unknown[];counts:Record<string,number>};expect(plan.blockedCopies).toEqual([])
 if(evidenceRoot){expect(plan.counts.requests).toBeUndefined();expect(plan.counts.feedback_import_records).toBe(1)}
 const erased=await call('/api/operator/data/erasure',{table,id,planHash:plan.planHash},operator)
 if(evidenceRoot){
  expect(erased.status).toBe(202);const pending=await erased.clone().json() as {operationId:string;status:string};expect(pending.status).toBe('pending_import')
  expect(await nativeRows()).toEqual(nativeBefore)
  // The restoring owner's native session remains admitted. Ordinary request
  // writes additionally require idle data custody in their transaction guard.
  const authorityRows=async()=>(await env.DB.batch(['oa_operators','oa_sessions','operators'].map(table=>env.DB.prepare('SELECT * FROM '+table+' ORDER BY id')))).map(result=>result.results)
  const authorityBefore=await authorityRows(),session=await call('/auth/session',undefined,operator)
  expect(session.status,await session.clone().text()).toBe(200)
  const admitted=await session.json()
  expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'locked',lock_id:pending.operationId})
  const held=await call('/api/operator/requests/feedback-'+requestId.toLowerCase()+'/notes',{body:'Must wait for privacy cleanup'},operator)
  expect(held.status,await held.clone().text()).toBe(401);expect(await held.json()).toEqual({error:'integration_authority_changed'})
  const stillAdmitted=await call('/auth/session',undefined,operator)
  expect(stillAdmitted.status).toBe(200);expect(await stillAdmitted.json()).toEqual(admitted)
  expect(await authorityRows()).toEqual(authorityBefore);expect(await nativeRows()).toEqual(nativeBefore)
  expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'locked',lock_id:pending.operationId})
  // A survivor changed inside the actual custody transaction must invalidate
  // publication and roll back. The same operation then resumes unchanged.
  await env.DB.prepare("CREATE TRIGGER interrupt_privacy_cleanup AFTER UPDATE OF complete ON feedback_import_erasure_work WHEN NEW.complete=1 BEGIN UPDATE requests SET description='Concurrent native description'; END").run()
  const interrupted=await call('/api/operator/data/operations/'+pending.operationId+'/resume',{},operator);expect(interrupted.status).toBeGreaterThanOrEqual(400)
  expect(await env.DB.prepare('SELECT status FROM data_operations WHERE id=?').bind(pending.operationId).first('status')).toBe('pending_import')
  expect(await env.DB.prepare('SELECT phase FROM data_state').first('phase')).toBe('locked');expect(await nativeRows()).toEqual(nativeBefore)
  await env.DB.prepare('DROP TRIGGER interrupt_privacy_cleanup').run()
  if(kind==='legacy evidence'){
   // Base has erased the declared records; its legacy options copy remains
   // private under the same operation lock until the product step commits.
   const baseStep=await call('/api/operator/data/operations/'+pending.operationId+'/resume',{},operator);expect(baseStep.status).toBe(202)
   const retained=async()=>(await env.DB.prepare('SELECT * FROM ik_jobs ORDER BY id').all()).results,prior=await retained()
   expect(JSON.stringify(prior)).toContain(source.files[0].base64)
   for(const body of ["UPDATE requests SET description='Concurrent survivor mutation'",'UPDATE oa_sessions SET revoked_at=1']){
    await env.DB.prepare('CREATE TRIGGER interrupt_legacy_source AFTER UPDATE OF plan_json ON ik_jobs BEGIN '+body+'; END').run()
    const refused=await call('/api/operator/data/operations/'+pending.operationId+'/resume',{},operator);expect(refused.status).toBeGreaterThanOrEqual(400)
    expect(await retained()).toEqual(prior);expect(await nativeRows()).toEqual(nativeBefore)
    expect(await env.DB.prepare('SELECT phase FROM data_state').first('phase')).toBe('locked')
    await env.DB.prepare('DROP TRIGGER interrupt_legacy_source').run()
   }
  }
 }
 await finishErasure(erased,operator)
 expect(await env.DB.prepare('SELECT phase,lock_id FROM data_state').first()).toEqual({phase:'idle',lock_id:null})
 if(evidenceRoot){expect(await nativeRows()).toEqual(nativeBefore);expect(await env.DB.prepare('SELECT COUNT(*) n FROM requests').first('n')).toBe(1);expect(await env.DB.prepare('SELECT COUNT(*) n FROM request_notes').first('n')).toBe(1);expect(await env.DB.prepare('SELECT COUNT(*) n FROM evidence_items').first('n')).toBe(0);expect(await env.DB.prepare('SELECT COUNT(*) n FROM feedback_import_records').first('n')).toBe(kind==='streamed evidence'?211:1)}
 const afterReceipt=await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator);expect(afterReceipt.status,await afterReceipt.clone().text()).toBe(200);expect(await afterReceipt.json()).toMatchObject({originalsRetained:false});const withdrawn=await call(importPath+'/jobs/'+job.id+'/originals',undefined,operator);// The restoring owner reaches the withdrawn originals: a stream refuses them, an ordinary job lists each as unavailable.
 expect(withdrawn.status,await withdrawn.clone().text()).toBe(kind==='streamed evidence'?409:200);if(kind!=='streamed evidence')expect((await withdrawn.clone().json() as {original:{status:string}}[]).every(row=>row.original.status==='unavailable')).toBe(true)
 expect(await withdrawn.text()).not.toContain(source.files[0].base64);expect(await env.DB.prepare('SELECT COUNT(*) n FROM ik_d1_original_chunks').first('n')).toBe(0)
 const replay=await preview(source,operator);expect((await call(importPath+'/apply',{source,fingerprint:replay.fingerprint},operator)).status).toBe(422)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM '+table).first('n')).toBe(0)
 const after=await exportArchive(env.DB,env.FILES);expect(JSON.stringify(after)).not.toContain('Exact café');for(const file of source.files)expect(JSON.stringify(after)).not.toContain(file.base64)
 for await(const {plan} of jobPlans(job.id,env.DB,kind==='streamed evidence')){const decoded=JSON.stringify(plan);expect(decoded).not.toContain('Exact café');for(const file of source.files)expect(decoded).not.toContain(file.base64)}
 for(const [name,rows]of Object.entries(after.archive.tables).filter(([name])=>name.startsWith('ik_')||name.startsWith('feedback_import_'))){void rows;const retained=JSON.stringify((await env.DB.prepare('SELECT * FROM '+name).all()).results);expect(retained).not.toContain('Exact café');for(const file of source.files)expect(retained).not.toContain(file.base64)}
 expect(after.archive.tables.ik_d1_erased_sources.length).toBeGreaterThan(0);expect(after.archive.tables.ik_d1_erased_targets.length).toBeGreaterThan(0)
 for(const table of ['notification_outbox','notification_intents','local_auth_outbox'])expect(after.archive.tables[table]).toHaveLength(0)
 if(evidenceRoot)expect((await call('/api/operator/requests/feedback-'+requestId.toLowerCase()+'/notes',{body:'Native work resumes after privacy cleanup'},operator)).status).toBe(201)
},60000)
it('[IMP-003][IMP-005][DATA-001] validates a bounded stream archive and keeps its receipt and exact originals after restore',async()=>{
 const {boundedFeedbackFixture}=await import('./feedback-import-fixture'),{validateFeedbackArchive}=await import('@/core/features/imports/archive-custody')
 const operator=await owner(),source=boundedFeedbackFixture('stream-archive')
 // A people-only supplied history exercises multiple maintained plan pages
 // while leaving this hosted archive within its separate small JSON bound.
 source.files=source.files.filter(file=>file.kind==='users');source.boards=[];source.statuses={}
 const users=Array.from({length:210},(_,i)=>({id:'person-'+i,name:'Saved person '+i,created:'2024-07-08T09:10:11.000Z'}));source.files[0].base64=Buffer.from(JSON.stringify({users})).toString('base64')
 const reviewed=await preview(source,operator),response=await call(importPath+'/apply',{source,fingerprint:reviewed.fingerprint},operator);expect(response.status,await response.clone().text()).toBe(202)
 let job=await response.json() as {id:string;state:string;checkpoint:number}
 for(let n=0;n<100&&job.state!=='completed';n++){const next=await call(importPath+'/jobs/'+job.id+'/resume',{},operator);expect(next.status,await next.clone().text()).toBe(200);job=await next.json() as typeof job}
 expect(job.state).toBe('completed')
 const saved=await exportArchive(env.DB,env.FILES);expect(()=>validateFeedbackArchive(saved.archive.tables)).not.toThrow()
 const corrupt=structuredClone(saved.archive.tables);corrupt.feedback_import_original_chunks[0].bytes+='changed';expect(()=>validateFeedbackArchive(corrupt)).toThrow()
 await reset();await applyD1Migrations(env.DB,inject('migrations'));const restoredOperator=await owner()
 expect((await restoreArchive(env.DB,env.FILES,saved.archive,saved.journal)).status).toBe('complete')
 const exported=await exportArchive(env.DB,env.FILES)
 for(const table of Object.keys(saved.archive.tables).filter(name=>name.startsWith('ik_')||name.startsWith('feedback_import_')))expect(exported.archive.tables[table],table).toEqual(saved.archive.tables[table])
 const receipt=await call(importPath+'/jobs/'+job.id+'/receipt',undefined,restoredOperator);expect(receipt.status,await receipt.clone().text()).toBe(200);expect(await receipt.json()).toMatchObject({phase:'completed',effects:{mail:0,notifications:0}})
},60000)

it('[DATA-003][IMP-005] erases one person from a multi-megabyte legacy saved import and leaves everyone else in it unchanged',async()=>{
 const {ideasFeedbackFixture,populateFeedback}=await import('./feedback-import-fixture'),{importContext}=await import('@/core/features/imports/service'),{runtime}=await import('./notification-regression-fixture'),{resumeD1Import}=await import('../../base/modules/import-kit/src/d1/index')
 // A legacy job keeps its mapper input beside the normalized plan, so one
 // megabyte of supplied profiles becomes a plan of several megabytes.
 const operator=await owner(),created='2024-07-08T09:10:11.000Z',source=ideasFeedbackFixture('legacy-large-plan'),wording='Long historical profile wording. '.repeat(550)
 source.files.push({name:'users.json',kind:'users',version:'v2',base64:Buffer.from(JSON.stringify({users:Array.from({length:60},(_,i)=>({id:'person-'+i,name:'Historical person '+i,created,profile:`Distinct-${i}-marker ${wording}`}))})).toString('base64')})
 let job=await populateFeedback(source,operator,true)
 const {context}=await importContext(runtime(),new Request(origin+importPath+'/apply',{method:'POST',headers:{Origin:origin,...operator}}),source.namespace);context.storage.database=env.DB
 for(let i=0;i<50&&job.state!=='completed';i++)job=await resumeD1Import(job.id,context)
 expect(job.state).toBe('completed');expect(await env.DB.prepare('SELECT SUM(length(body)) n FROM ik_d1_plan_chunks WHERE job_id=?').bind(job.id).first('n')).toBeGreaterThan(4*1024*1024)
 const person=stableFeedbackId(source.namespace,'users','person-0'),others=async()=>(await env.DB.prepare('SELECT * FROM requesters WHERE id<>? ORDER BY id').bind(person).all()).results,before=await others()
 const plan=await(await erasurePreview('requesters',person,operator)).json() as {planHash:string;blockedCopies:unknown[]};expect(plan.blockedCopies).toEqual([])
 await finishErasure(await call('/api/operator/data/erasure',{table:'requesters',id:person,planHash:plan.planHash},operator),operator)
 expect(await env.DB.prepare('SELECT COUNT(*) n FROM requesters WHERE id=?').bind(person).first('n')).toBe(0);expect(await others()).toEqual(before)
 for(const {name} of (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'ik_%' OR name LIKE 'feedback_import_%')").all<{name:string}>()).results){
  const retained=JSON.stringify((await env.DB.prepare('SELECT * FROM '+name).all()).results);expect(retained,name).not.toContain('Distinct-0-marker')
 }
 expect((await call(importPath+'/jobs/'+job.id+'/receipt',undefined,operator)).status).toBe(200)
},120000)
