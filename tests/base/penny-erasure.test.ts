import {mockMail} from './support'
import { applyD1Migrations,reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach,afterEach,expect,inject,it,vi } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { providerMessages } from './provider-messages'
import { canonical,planErasure,readErasureJournal,type Archive,type ErasureJournal } from '@/core/features/data/archive'
import { eraseEntity } from '@/core/features/data/operations'
import { digest } from '@/core/features/auth/native-tokens'
import { LEASE_MS } from '@/core/features/data/runner/claims'
import { barrier } from './review-race-storage'

const origin='https://127.0.0.1:8787',app=createPennyApi()
const bindings=()=>({...env,PENNY_ENVIRONMENT:'test',APP_ORIGIN:origin,MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-provider-test-key'})
const runtime=()=>createPennyRuntime(bindings())
let ip=0
function call(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST'){
 return app.fetch(new Request(origin+path,{method,headers:{Origin:origin,Host:'127.0.0.1:8787','CF-Connecting-IP':`192.0.2.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings())
}
async function good<T=Record<string,string>>(path:string,body:unknown,headers:Record<string,string>,method=body===undefined?'GET':'POST'):Promise<T>{
 const response=await call(path,body,headers,method);expect(response.status,await response.clone().text()).toBeLessThan(300);return response.json() as Promise<T>
}
const rows=async(table:string)=>(await env.DB.prepare(`SELECT * FROM ${table}`).all<Record<string,string|number|null>>()).results
const counts=async(tables:string[])=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await env.DB.prepare(`SELECT count(*) n FROM ${table}`).first('n') as number])))
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())

async function graph(){
 const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303)
 const operator={Cookie:boot.headers.get('set-cookie')!.split(';')[0]}
 const email='erasure-canary@example.test',displayName='Erasure private identity'
 await good('/api/public/identity/email',{email,displayName},{})
 const message=(await providerMessages(runtime())!.list()).find(m=>m.message.to.includes(email))!
 const token=new URL(message.message.text!.match(/https?:\/\/\S+/)![0]).hash.slice(7)
 const identity=await good('/api/public/identity/email/verify',{token},{})
 const person={Authorization:`Bearer ${identity.token}`},requester=(await env.DB.prepare('SELECT requester_id FROM requester_addresses WHERE email=?').bind(email).first<{requester_id:string}>())!.requester_id
 await good('/api/operator/boards',{name:'Feedback',slug:'feedback',visibility:'public'},operator)
 const request=await good('/api/public/requests',{title:'A public improvement',description:'A public description',boardSlug:'feedback',emailUpdates:true,idempotencyKey:crypto.randomUUID()},person)
 await good(`/api/operator/moderation/${request.slug}`,{verdict:'approved',title:'A public improvement',description:'A public description',boardSlug:'feedback',displayName:'Reader'},operator)
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(request.slug).first<{id:string}>())!.id
 const actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 const account=await good('/api/operator/accounts',{name:'Commercial account canary',internalOwnerId:actor,revenueCents:7812321,renewalDate:'2027-02-10',health:'Account renewal canary'},operator)
 const evidence=await good('/api/operator/evidence',{sourceType:'free_text',sourceLabel:'Evidence source canary',wording:'Evidence quotation canary',observedAt:'2026-10-10T00:00:00Z',accountId:account.id,requestLinks:[{id:requestId,stance:'supporting'}]},operator)
 await good(`/api/operator/evidence/${evidence.id}/wording`,{wording:'Revised evidence quotation canary',expectedVersionId:evidence.versionId},operator,'PATCH')
 const decision=await good('/api/operator/decisions',{question:'Which direction?',ownerOperatorId:actor},operator)
 const bet=await good(`/api/operator/decisions/${decision.id}/bets`,{title:'Better workflow',summary:'Reduce effort'},operator)
 await good(`/api/operator/evidence/${evidence.id}/links`,{target:'bet',targetId:bet.id},operator,'PUT')
 const fields={selectedCandidateBetId:bet.id,rationale:'Commitment reason',ownerOperatorId:actor,confidence:'medium',reviewAt:'2026-11-01',noViableAlternativeReason:'Only viable approach'}
 const commitment=await good(`/api/operator/decisions/${decision.id}/commit`,fields,operator)
 // Roadmap approval and its later status draft use independently written copy.
 // Only the sealed release versions below deliberately repeat request wording.
 await good(`/api/operator/roadmap/${commitment.itemId}/approve`,{publicTitle:'Faster team workflows',publicSummary:'Streamline everyday work',boardSlug:'feedback',requestIds:[requestId]},operator)
 await good(`/api/operator/roadmap/${commitment.itemId}/move`,{status:'shipped',reason:'Available',idempotencyKey:'ship'},operator)
 await env.DB.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('erasure-tag','Workflow','2026-10-01','2026-10-01')").run()
 await good('/api/public/updates/subscription',{subscribed:true},person,'PATCH')
 const release=await good('/api/operator/releases',{title:'A public improvement',body:'A public description',releaseType:'improved',tagIds:['erasure-tag'],publicationDate:'2026-10-11',targetIds:[commitment.itemId],authorOperatorId:actor},operator)
 await good(`/api/operator/releases/${release.slug}/publish`,{},operator)
 for(const outcome of ['adopted','partly_adopted'])await good(`/api/public/releases/${release.slug}/outcomes`,{targetId:commitment.itemId,outcome},person,'PUT')
 const corrected=await good(`/api/operator/releases/${release.slug}/corrections`,{expectedVersionId:release.versionId,title:'A public improvement',body:'A public description',outcomePrompt:'Has this helped?'},operator)
 await good(`/api/operator/releases/${release.slug}/versions/${corrected.versionId}/deliver`,{},operator)
 // This evidence is post-release as well as supporting the original commitment.
 await env.DB.prepare('UPDATE evidence_items SET release_id=? WHERE id=?').bind(release.id,evidence.id).run()
 const original=new Uint8Array([0,255,31,80,68,70,13,10]),form=new FormData()
 form.append('file',new File([original],'erasure-original.pdf',{type:'application/pdf'}))
 const upload=await app.fetch(new Request(origin+`/api/operator/evidence/${evidence.id}/attachments`,{method:'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,...operator},body:form}),bindings())
 expect(upload.status,await upload.clone().text()).toBe(201)
 const attachment=await upload.json() as {id:string}
 const storageKey=(await env.DB.prepare('SELECT storage_key FROM attachments WHERE id=?').bind(attachment.id).first<{storage_key:string}>())!.storage_key
 const audit=await env.DB.prepare("SELECT id,actor_id,entity_id,details_json FROM audit_entries WHERE action='evidence.wording_edited' AND entity_id=?").bind(evidence.id).first<{id:string;actor_id:string;entity_id:string;details_json:string}>()
 expect(audit).toMatchObject({actor_id:actor,entity_id:evidence.id,details_json:expect.any(String)})
 const auditId=audit!.id
 return {operator,person,requester,email,displayName,request,requestId,account,evidence,decision,bet,fields,release,corrected,attachment,storageKey,original,auditId}
}

async function pendingFile(g:Awaited<ReturnType<typeof graph>>,writing=0){
 const key='evidence/pending-original',bytes=new Uint8Array([80,69,78,68,73,78,71]),id=crypto.randomUUID(),now=new Date().toISOString()
 await env.DB.prepare('INSERT INTO evidence_attachment_uploads(id,evidence_id,storage_key,original_filename,content_type,byte_size,sha256,writing,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,g.evidence.id,key,'pending-original.pdf','application/pdf',bytes.byteLength,await digest('pending bytes'),writing,now,now).run()
 await env.FILES.put(key,bytes)
 return {key,bytes,id}
}

type Preview={planHash:string;counts:Record<string,number>;fileCount:number;blockedCopies:unknown[]}
for(const root of ['requesters','evidence_items','accounts'] as const)it(`[DATA-003 BASE-DATA-003] ${root} erasure fences every history child and original file against revision and stale restore`,async()=>{
 const g=await graph(),id=root==='requesters'?g.requester:root==='accounts'?g.account.id:g.evidence.id
 if(root==='requesters'){
  const destination=await good('/api/operator/requests',{title:'Independent destination',description:'Independent context',boardSlug:'feedback',evidenceIds:[]},g.operator)
  await good(`/api/operator/requests/${g.request.slug}/merge`,{targetSlug:destination.slug},g.operator)
  expect(await rows('request_merges')).toHaveLength(1)
 }
 const saved=await good<{archive:Archive;journal:ErasureJournal}>('/api/operator/data/export',undefined,g.operator)
 const publishedVersions=(await rows('release_versions')).filter(row=>[g.release.versionId,g.corrected.versionId].includes(String(row.id)))
 expect(new Uint8Array(await (await env.FILES.get(g.storageKey))!.arrayBuffer())).toEqual(g.original)
 expect(saved.archive.files.some(file=>file.key===g.storageKey&&atob(file.bytes)===String.fromCharCode(...g.original))).toBe(true)
 const pending=await pendingFile(g)
 expect(new Uint8Array(await (await env.FILES.get(pending.key))!.arrayBuffer())).toEqual(pending.bytes)
 const preview=await good<Preview>('/api/operator/data/erasure/preview',{table:root,id},g.operator)
 expect(preview.blockedCopies).toEqual([]);expect(preview.fileCount).toBe(2)
 expect(preview.counts).toMatchObject({evidence_versions:root==='requesters'?3:2,attachments:1,evidence_attachment_uploads:1,decision_evidence_snapshots:1,decision_bet_snapshots:1})
 if(root==='requesters')expect(preview.counts).toMatchObject({release_outcomes:2,requester_update_permissions:2,native_requester_sessions:1,notification_outbox:2,release_recipient_snapshots:1})
 if(root==='accounts')expect(preview.counts.accounts).toBe(1)
 const tables=Object.keys(preview.counts).filter(table=>table!=='audit_anonymized'),before=await counts(tables),filesBefore=(await env.FILES.list()).objects.length
 const plan=await planErasure(env.DB,root,id)
 const result=await good('/api/operator/data/erasure',{table:root,id,planHash:preview.planHash},g.operator)
 expect(result.status).toBe('complete')
 const after=await counts(tables)
 for(const table of tables){expect(after[table],table).toBe(before[table]-preview.counts[table]);expect((await rows('data_tombstones')).filter(row=>row.table_name===table),table).toHaveLength(preview.counts[table])}
 expect((await rows('release_versions')).filter(row=>publishedVersions.some(version=>version.id===row.id))).toEqual(publishedVersions)
 expect((await env.FILES.list()).objects).toHaveLength(0)
 console.log(`ERASURE ${root} ${JSON.stringify({before,selected:preview.counts,after,files:{before:filesBefore,after:0}})}`)
 const audit=(await rows('audit_entries')).find(row=>row.id===g.auditId)!
 expect(audit.entity_id).toMatch(/^erased:/);expect(audit.actor_id).toBeNull();expect(audit.details_json).toBeNull()
 expect(audit.entity_id).not.toBe(`erased:${await digest(canonical([saved.journal.origin,g.evidence.id]))}`)
 expect(JSON.stringify(await rows('audit_entries'))).not.toContain(g.evidence.id)
 const journal=await readErasureJournal(env.DB)
 const stale=await call('/api/operator/data/import',saved,g.operator);expect(stale.status).toBe(409);expect(await stale.json()).toEqual({error:'erasure_journal_regression'})
 const latest=await call('/api/operator/data/import',{archive:saved.archive,journal},g.operator);expect(latest.status).toBe(409);expect(await latest.json()).toEqual({error:'stale_archive'})
 // Even changing the archive epoch cannot bring back a tombstoned child.
 const replay=structuredClone(saved.archive);replay.epoch=journal.epoch;replay.journalHash=journal.sha256
 const {sha256:ignored,...body}=replay;void ignored;replay.sha256=await digest(canonical(body))
 const refused=await call('/api/operator/data/import',{archive:replay,journal},g.operator);expect(refused.status).toBe(409);expect(await refused.json()).toEqual({error:'erased_archive_record'})
 expect((await call('/api/operator/data/erasure',{table:root,id,planHash:preview.planHash},g.operator)).status).toBe(400)
 const missingEvidence=await call(`/api/operator/evidence/${g.evidence.id}/wording`,{wording:'Recreate prior wording',expectedVersionId:g.evidence.versionId},g.operator,'PATCH')
 expect(missingEvidence.status).toBe(422);expect(await missingEvidence.json()).toEqual({error:'mutation_failed',message:'evidence items not found.'})
 expect((await call(`/api/operator/requests/${g.request.slug}/unmerge`,{},g.operator)).status).toBeGreaterThanOrEqual(400)
 const revision=await call(`/api/operator/decisions/${g.decision.id}/revisions`,{...g.fields,expectedRevision:1},g.operator)
 expect(revision.status).toBeGreaterThanOrEqual(400)
 await good(`/api/operator/releases/${g.release.slug}/corrections`,{expectedVersionId:g.corrected.versionId,title:'Follow-up release',body:'Public follow-up',outcomePrompt:'Has this helped?'},g.operator)
 for(const table of ['evidence_items','evidence_versions','attachments','evidence_attachment_uploads','decision_evidence_snapshots']){
  const remaining=await rows(table);for(const row of plan.selected[table])expect(remaining.some(other=>other.id===row.id)).toBe(false)
 }
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 if(root==='requesters'){
  expect((await call('/api/public/identity/session',undefined,g.person)).status).toBe(401)
  expect(await rows('release_outcomes')).toHaveLength(0)
  expect((await call(`/api/public/releases/${g.release.slug}/outcomes`,{targetId:'absent',outcome:'adopted'},g.person,'PUT')).status).toBe(401)
 }
})

it('[DATA-003 BASE-DATA-003] active evidence writers fence erasure; interrupted original-file removal holds maintenance until authenticated resume',async()=>{
 const g=await graph(),pending=await pendingFile(g,1),target={table:'evidence_items',id:g.evidence.id}
 let preview=await good<Preview>('/api/operator/data/erasure/preview',target,g.operator)
 const active=await call('/api/operator/data/erasure',{...target,planHash:preview.planHash},g.operator)
 expect(active.status).toBe(409);expect(await active.json()).toEqual({error:'attachment_writer_active'})
 expect(await rows('data_tombstones')).toHaveLength(0)
 await good(`/api/operator/evidence-uploads/${pending.id}/release-writer`,{confirmPriorWriterStopped:true},g.operator)
 preview=await good<Preview>('/api/operator/data/erasure/preview',target,g.operator)
 // The only fault is the R2 edge. Product D1, authority and outbox are real.
 const unavailable=new Proxy(env.FILES,{get(bucket,key){if(key==='delete')return async()=>{throw new Error('Storage unavailable')};const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value}})
 const interrupted=await eraseEntity(env.DB,unavailable,target.table,target.id,preview.planHash)
 expect(interrupted.status).toBe('pending_r2');expect((await env.FILES.list()).objects).toHaveLength(2)
 expect(await env.DB.prepare('SELECT id FROM evidence_items WHERE id=?').bind(g.evidence.id).first()).toBeNull()
 expect((await call('/api/operator/data/export',undefined,g.operator)).status).toBe(409)
 expect((await call(`/api/operator/data/operations/${interrupted.operationId}/abort-pending-erasure`,{confirmPriorRunnerStopped:true},g.operator)).status).toBe(409)
 expect((await call(`/api/operator/data/operations/${interrupted.operationId}/resume`,{})).status).toBe(401)
 const complete=await good(`/api/operator/data/operations/${interrupted.operationId}/resume`,{},g.operator)
 expect(complete.status).toBe('complete');expect((await env.FILES.list()).objects).toHaveLength(0)
 const journal=await readErasureJournal(env.DB)
 expect(await good(`/api/operator/data/operations/${interrupted.operationId}/resume`,{},g.operator)).toEqual(complete)
 expect(await readErasureJournal(env.DB)).toEqual(journal)
})

it('[DATA-003] corrected sealed public wording remains independent, but private review copies and operator identity still block erasure',async()=>{
 const g=await graph(),target={table:'requesters',id:g.requester}
 const approved=(await rows('requests')).find(row=>row.id===g.requestId)!
 const versions=(await rows('release_versions')).filter(row=>[g.release.versionId,g.corrected.versionId].includes(String(row.id)))
 expect(versions).toHaveLength(2)
 for(const version of versions)expect(version).toMatchObject({title:approved.public_title,body:approved.public_description,snapshot_sealed_at:expect.any(String)})
 expect((await good<Preview>('/api/operator/data/erasure/preview',target,g.operator)).blockedCopies).toEqual([])
 // Public approval does not exempt the same phrase copied into a private note.
 for(const [copy,reviewAt] of [[approved.public_title,'2026-12-01'],[g.email,'2027-01-01']])await good(`/api/operator/decisions/${g.decision.id}/reviews`,{note:`Private unattributed copy ${copy}`,reviewAt},g.operator)
 const blocked=await good<Preview>('/api/operator/data/erasure/preview',target,g.operator)
 expect(blocked.blockedCopies).toHaveLength(2)
 expect(blocked.blockedCopies).toEqual(expect.arrayContaining((await rows('decision_reviews')).map(row=>({table:'decision_reviews',key:canonical([row.id]),columns:['note']}))))
 const refused=await call('/api/operator/data/erasure',{...target,planHash:blocked.planHash},g.operator)
 expect(refused.status).toBe(409);expect(await refused.json()).toEqual({error:'erasure_ambiguous_copies'})
 await env.DB.prepare('UPDATE requesters SET display_name=(SELECT display_name FROM operators LIMIT 1) WHERE id=?').bind(g.requester).run()
 const held=await call('/api/operator/data/erasure/preview',target,g.operator);expect(held.status).toBe(409);expect(await held.json()).toEqual({error:'erasure_crosses_operator_hold'})
})

it('[DATA-003 BASE-DATA-003] a removed operator is erased: identity, sign-in and name copies go while their attributed work and everyone else stay',async()=>{
 const g=await graph(),email='former-operator@example.test'
 expect((await call('/api/operator/settings/operators',{email},g.operator)).status).toBe(202)
 const invite=(await providerMessages(runtime())!.list()).find(m=>m.message.to.includes(email))!
 const token=new URL(invite.message.text!.match(/https?:\/\/\S+/)![0]).searchParams.get('token')
 const confirmed=await call('/auth/confirm',{token});expect(confirmed.status,await confirmed.clone().text()).toBe(303)
 const teammate={Cookie:confirmed.headers.get('set-cookie')!.split(';')[0]}
 await good(`/api/operator/requests/${g.request.slug}/notes`,{body:'Teammate private note'},teammate)
 await good(`/api/operator/requests/${g.request.slug}/comments`,{body:'Teammate public reply'},teammate)
 const former=(await env.DB.prepare('SELECT id,display_name FROM operators WHERE email=?').bind(email).first<{id:string;display_name:string}>())!
 const native=(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<{id:string}>())!
 const active=await call('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator);expect(active.status).toBe(409);expect(await active.json()).toEqual({error:'erasure_operator_active'})
 expect((await call(`/api/operator/settings/operators/${native.id}`,{},g.operator,'DELETE')).status).toBe(200)
 const saved=await good<{archive:Archive;journal:ErasureJournal}>('/api/operator/data/export',undefined,g.operator)
 const owner=await env.DB.prepare('SELECT * FROM operators WHERE id<>?').bind(former.id).all(),notes=await rows('request_notes'),others=(await rows('request_comments')).filter(row=>row.operator_id!==former.id)
 const preview=await good<Preview>('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator)
 expect(preview.blockedCopies).toEqual([]);expect(preview.counts).toMatchObject({operators:1,oa_operators:1,'request_comments:public_author_display_name':1})
 expect((await good('/api/operator/data/erasure',{table:'operators',id:former.id,planHash:preview.planHash},g.operator)).status).toBe('complete')
 // No table, product or installation, keeps the address or the name.
 for(const {name} of (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{name:string}>()).results){
  const dump=JSON.stringify(await rows(name));expect(dump,name).not.toContain(email);expect(dump,name).not.toContain(JSON.stringify(former.display_name))
 }
 expect(await env.DB.prepare('SELECT display_name FROM operators WHERE id=?').bind(former.id).first('display_name')).toBe('Erased operator')
 expect(await rows('request_notes')).toEqual(notes)
 expect((await rows('request_comments')).find(row=>row.operator_id===former.id)).toMatchObject({body:'Teammate public reply',public_author_display_name:'Erased operator'})
 expect((await rows('request_comments')).filter(row=>row.operator_id!==former.id)).toEqual(others)
 expect((await env.DB.prepare('SELECT * FROM operators WHERE id<>?').bind(former.id).all()).results).toEqual(owner.results)
 expect((await call('/auth/session',undefined,g.operator)).status).toBe(200)
 const journal=await readErasureJournal(env.DB)
 const stale=await call('/api/operator/data/import',{archive:saved.archive,journal},g.operator);expect(stale.status).toBe(409);expect(await stale.json()).toEqual({error:'stale_archive'})
 expect((await call('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator)).status).toBe(409)
})

it('[DATA-003] another person\'s audit rows that only repeat a removed operator\'s display name are listed and resolved by the owner, who keeps or clears each',async()=>{
 const g=await graph(),email='sales@example.test'
 expect((await call('/api/operator/settings/operators',{email},g.operator)).status).toBe(202)
 const invite=(await providerMessages(runtime())!.list()).find(m=>m.message.to.includes(email))!
 const confirmed=await call('/auth/confirm',{token:new URL(invite.message.text!.match(/https?:\/\/\S+/)![0]).searchParams.get('token')});expect(confirmed.status).toBe(303)
 expect((await call('/api/auth/session',undefined,{Cookie:confirmed.headers.get('set-cookie')!.split(';')[0]})).status).toBe(200)
 const former=(await env.DB.prepare('SELECT id,display_name FROM operators WHERE email=?').bind(email).first<{id:string;display_name:string}>())!,native=(await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<{id:string}>())!
 expect(former.display_name).toBe('sales')
 expect((await call(`/api/operator/settings/operators/${native.id}`,{},g.operator,'DELETE')).status).toBe(200)
 expect((await good<Preview>('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator)).blockedCopies).toEqual([])
 // After the removal, the owner names a field 'sales', then renames it: two of the owner's audit rows repeat the name.
 const field=await good<{id:string}>('/api/operator/settings/custom-fields',{entityType:'request',name:'sales',fieldType:'text'},g.operator)
 const one=await good<Preview>('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator)
 expect(one.blockedCopies).toMatchObject([{table:'audit_entries',action:'custom_field.definition_created',occurredAt:expect.any(String),resolvable:true}])
 expect((await call('/api/operator/data/erasure',{table:'operators',id:former.id,planHash:one.planHash},g.operator)).status).toBe(409)
 await good(`/api/operator/settings/custom-fields/${field.id}`,{name:'pipeline',fieldType:'text'},g.operator,'PATCH')
 const preview=await good<Preview>('/api/operator/data/erasure/preview',{table:'operators',id:former.id},g.operator),copies=preview.blockedCopies as {key:string;action:string;resolvable?:true}[]
 expect(copies.map(copy=>copy.action).sort()).toEqual(['custom_field.definition_created','custom_field.definition_updated']);expect(copies.every(copy=>copy.resolvable)).toBe(true)
 const id=(action:string)=>JSON.parse(copies.find(copy=>copy.action===action)!.key)[0] as string,created=id('custom_field.definition_created'),updated=id('custom_field.definition_updated')
 const kept=await env.DB.prepare('SELECT * FROM audit_entries WHERE id=?').bind(created).first()
 // Every listed row needs exactly one decision; a partial answer still refuses.
 expect((await call('/api/operator/data/erasure',{table:'operators',id:former.id,planHash:preview.planHash,auditCopies:[{id:created,resolution:'unrelated'}]},g.operator)).status).toBe(409)
 expect((await good('/api/operator/data/erasure',{table:'operators',id:former.id,planHash:preview.planHash,auditCopies:[{id:created,resolution:'unrelated'},{id:updated,resolution:'clear'}]},g.operator)).status).toBe('complete')
 expect(await env.DB.prepare('SELECT * FROM audit_entries WHERE id=?').bind(created).first()).toEqual(kept)
 expect(await env.DB.prepare('SELECT details_json FROM audit_entries WHERE id=?').bind(updated).first('details_json')).toBeNull()
 expect(JSON.parse((await env.DB.prepare("SELECT details_json FROM audit_entries WHERE action='data.erased' ORDER BY occurred_at DESC LIMIT 1").first<string>('details_json'))!)).toMatchObject({auditCopiesConfirmedUnrelated:[created],auditCopiesCleared:[updated]})
 expect(await env.DB.prepare('SELECT display_name FROM operators WHERE id=?').bind(former.id).first('display_name')).toBe('Erased operator')
})

it('[DATA-003 BASE-DATA-003] a confirmed erasure whose tab closes mid-step finishes on the server once, and the stopped request cannot apply anything again',async()=>{
 const g=await graph(),target={table:'requesters',id:g.requester}
 const preview=await good<Preview>('/api/operator/data/erasure/preview',target,g.operator)
 // The request stops inside its file-deletion step, as when the tab closes and the Worker is cut off.
 const entered=barrier(),release=barrier()
 const stuck=new Proxy(env.FILES,{get(bucket,key){if(key==='delete')return async(...args:Parameters<R2Bucket['delete']>)=>{entered.release();await release.promise;return bucket.delete(...args)};const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value}})
 const closed=app.fetch(new Request(origin+'/api/operator/data/erasure',{method:'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,'Content-Type':'application/json',...g.operator},body:JSON.stringify({...target,planHash:preview.planHash})}),{...bindings(),FILES:stuck})
 await entered.promise
 const [operation]=await rows('data_operations');expect(operation.status).toBe('running_r2')
 expect(await env.DB.prepare('SELECT id FROM requesters WHERE id=?').bind(g.requester).first()).toBeNull()
 // Coming back while the step's claim is live shows progress, not a state name.
 const during=await good<{operation:{progress:{state:string;stage:string}}}>('/api/operator/data/overview',undefined,g.operator)
 expect(during.operation.progress).toMatchObject({state:'working',stage:'files'})
 // The minute Cron leaves a live claim alone, and takes the work over once its lease has passed.
 const {runNotificationSchedule}=await import('@/core/features/notifications/scheduled'),{createScheduledController}=await import('cloudflare:test')
 const cron=()=>runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings())
 await cron();expect((await rows('data_operations'))[0].status).toBe('running_r2')
 const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+LEASE_MS+1000)
 await cron()
 const finished=async()=>({operation:(await rows('data_operations')).map(row=>row.status),state:await env.DB.prepare('SELECT phase,lock_id FROM data_state').first(),files:(await env.FILES.list()).objects.length,erased:(await rows('audit_entries')).filter(row=>String(row.action).startsWith('data.eras')).map(row=>row.action).sort(),journal:await readErasureJournal(env.DB)})
 const complete=await finished()
 expect(complete).toMatchObject({operation:['complete'],state:{phase:'idle',lock_id:null},files:0,erased:['data.erased','data.erasure_completed']})
 // The stopped request resumes late: every write it tries is refused, so nothing applies twice.
 release.release()
 const late=await closed;expect(late.status).toBe(409);expect(await late.json()).toEqual({error:'data_runner_superseded'})
 await cron();expect(await finished()).toEqual(complete)
 const after=await good<{operation:unknown;recent:{kind:string;result:string}}>('/api/operator/data/overview',undefined,g.operator)
 expect(after).toMatchObject({operation:null,recent:{kind:'erase',result:'complete'}})
})
