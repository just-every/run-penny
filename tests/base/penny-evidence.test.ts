import { applyD1Migrations,reset } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { beforeEach,expect,inject,it } from 'vitest'
import { createPennyApi } from '@/core/app/api'
import { createPennyRuntime } from '@/core/app/runtime'
import { drainNotifications } from '@/core/features/notifications/delivery'
import { drainReleaseDeliveries } from '@/core/features/releases/delivery'
import { call as builtCall } from './support'
import type { Archive,ErasureJournal } from '@/core/features/data/archive'
import type { EvidenceVersion,EvidenceAttachments,RequestSuggestion } from '@/core/features/evidence/types'
import type { OperatorAccountDetail,OperatorDecisionBrief } from '@/core/shared/api/operator'
const app=createPennyApi(),origin='http://127.0.0.1:8787'
const devKey='synthetic-evidence-checkout-key-for-local-outbox-tests'
const bindings=()=>({...env,RER_DEV_KEY:devKey,PENNY_ENVIRONMENT:'local',APP_ORIGIN:origin,MAIL_PROVIDER:'development',MAIL_FROM:'penny@localhost.test',SENDGRID_API_KEY:undefined,WORKSPACE_TIMEZONE:'UTC'})
let ip=0
function call(path:string,body?:unknown,headers:Record<string,string>={},method=body===undefined?'GET':'POST'){
 return app.fetch(new Request(origin+path,{method,redirect:'manual',headers:{Host:'127.0.0.1:8787',Origin:origin,'CF-Connecting-IP':`192.0.2.${++ip}`,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),bindings())
}
async function json<T>(response:Response|Promise<Response>,status=200):Promise<T>{const r=await response;expect(r.status,await r.clone().text()).toBe(status);return r.json() as Promise<T>}
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'))})
async function fixture(){
 const boot=await call('/auth/bootstrap',{token:'synthetic-base-setup-token-for-worker-tests',displayName:'Owner'});expect(boot.status).toBe(303)
 const operator={Cookie:boot.headers.get('set-cookie')!.split(';')[0]},actor=(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())?.id
 // Map the native actor using a private route, as on the first operator visit.
 await call('/api/operator/evidence',undefined,operator)
 const ownerId=actor??(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())?.id
 await json(call('/api/operator/boards',{name:'Feedback',slug:'feedback',visibility:'public'},operator),201)
 const request=await json<{id:string;slug:string}>(call('/api/operator/requests',{title:'Export project reports',description:'CSV workspace reports',boardSlug:'feedback',evidenceIds:[]},operator),201)
 const id=ownerId??(await env.DB.prepare('SELECT id FROM operators').first<{id:string}>())!.id
 const decision=await json<{id:string;slug:string}>(call('/api/operator/decisions',{question:'How should reports improve?',ownerOperatorId:id},operator),201)
 const bet=await json<{id:string}>(call(`/api/operator/decisions/${decision.id}/bets`,{title:'CSV exports',summary:'Allow report exports'},operator),201)
 const account=await json<{id:string;slug:string}>(call('/api/operator/accounts',{name:'Secret Acme account',internalOwnerId:id,revenueCents:987654321,renewalDate:'2027-09-21',health:'Private renewal risk'},operator),201)
 const evidenceInput={sourceType:'free_text',sourceLabel:'Private sales call attribution',namedSpeaker:'Private speaker',wording:'Private evidence wording',observedAt:'2026-10-10T10:00:00Z',accountId:account.id,requestLinks:[{id:request.id,stance:'supporting'}],betLinks:[{id:bet.id,stance:'supporting'}]}
 const evidence=await json<{id:string;versionId:string}>(call('/api/operator/evidence',evidenceInput,operator),201)
 return {operator,actor:id,request,decision,bet,account,evidence,evidenceInput}
}
async function person(){
 await json(call('/api/public/identity/email',{email:'requester@example.test',displayName:'Requester'}),202)
 const list=await call('/__dev/outbox',undefined,{'x-rer-dev-key':devKey});expect(list.status).toBe(200)
 const html=await list.text(),message=html.match(/\?message=([^"&]+)/)![1]
 const detail=await (await call('/__dev/outbox?message='+message,undefined,{'x-rer-dev-key':devKey})).text()
 const token=detail.match(/#token=([A-Za-z0-9_-]{43})/)![1]
 const result=await json<{token:string}>(call('/api/public/identity/email/verify',{token}))
 return {Authorization:`Bearer ${result.token}`}
}
async function publish(g:Awaited<ReturnType<typeof fixture>>){
 await env.DB.prepare("UPDATE requests SET public_title='Export project reports',public_description='CSV workspace reports',public_state='open',moderation_state='approved',published_at=? WHERE id=?").bind(new Date().toISOString(),g.request.id).run()
}
it('[EVID-005] account writes require an owner and context includes transaction-linked requests and decisions in observed-time order',async()=>{
 const g=await fixture()
 const accountCount=await env.DB.prepare('SELECT count(*) n FROM accounts').first('n')
 for(const owner of [{internalOwnerId:null},{},{internalOwnerId:''},{internalOwnerId:'   '},{internalOwnerId:'absent'}]){
  const status=owner.internalOwnerId==='absent'?422:400
  expect((await call('/api/operator/accounts',{name:'Unowned account',...owner},g.operator)).status).toBe(status)
  expect((await call(`/api/operator/accounts/${g.account.id}`,{name:'Unowned account',...owner},g.operator,'PATCH')).status).toBe(status)
 }
 expect(await env.DB.prepare('SELECT count(*) n FROM accounts').first('n')).toBe(accountCount)
 expect(await env.DB.prepare('SELECT name,internal_owner_id AS owner FROM accounts WHERE id=?').bind(g.account.id).first()).toEqual({name:'Secret Acme account',owner:g.actor})
 // Historical nullable ownership remains readable, but editing must assign an owner.
 await env.DB.prepare('UPDATE accounts SET internal_owner_id=NULL WHERE id=?').bind(g.account.id).run()
 const historical=await json<OperatorAccountDetail>(call(`/api/operator/accounts/${g.account.slug}`,undefined,g.operator))
 expect(historical.owner).toBeNull()
 expect((await call(`/api/operator/accounts/${g.account.id}`,{name:historical.name,internalOwnerId:null},g.operator,'PATCH')).status).toBe(400)
 const minimal=await json<{slug:string}>(call('/api/operator/accounts',{name:'Owned without commercial fields',internalOwnerId:g.actor},g.operator),201)
 expect(await json<OperatorAccountDetail>(call(`/api/operator/accounts/${minimal.slug}`,undefined,g.operator))).toMatchObject({owner:{id:g.actor},revenueCents:null,renewalDate:null,health:null})
 await person()
 const requester=await env.DB.prepare('SELECT r.id,r.display_name AS displayName,a.email FROM requesters r JOIN requester_addresses a ON a.requester_id=r.id WHERE a.email=? AND a.verified_at IS NOT NULL').bind('requester@example.test').first<{id:string;displayName:string;email:string}>()
 expect(requester).toMatchObject({displayName:'Requester',email:'requester@example.test'})
 await env.DB.prepare('INSERT INTO requester_account_links(requester_id,account_id,created_at) VALUES(?,?,?)').bind(requester!.id,g.account.id,new Date().toISOString()).run()
 await json(call(`/api/operator/accounts/${g.account.id}`,{name:'Secret Acme account',internalOwnerId:g.actor,revenueCents:987654321,renewalDate:'2027-09-21',health:'Private renewal risk'},g.operator,'PATCH'))
 const earlier=await json<{id:string}>(call('/api/operator/evidence',{...g.evidenceInput,observedAt:'2026-10-09T10:00:00+10:00'},g.operator),201)
 const account=await json<OperatorAccountDetail>(call(`/api/operator/accounts/${g.account.slug}`,undefined,g.operator))
 expect(account).toMatchObject({name:'Secret Acme account',owner:{id:g.actor},revenueCents:987654321,renewalDate:'2027-09-21',health:'Private renewal risk',requests:[{id:g.request.id}],decisions:[{slug:g.decision.slug}]})
 expect(account.requesters).toEqual([requester])
 expect(account.requesterCount).toBe(1)
 expect(account.evidence.map(e=>e.id)).toEqual([g.evidence.id,earlier.id])
 const decision=await json<OperatorDecisionBrief>(call(`/api/operator/decisions/${g.decision.slug}`,undefined,g.operator))
 expect(decision.bets[0].evidence.map(e=>e.id)).toContain(g.evidence.id)
 const links=await json<{target:string;targetId:string}[]>(call(`/api/operator/evidence/${g.evidence.id}/links`,undefined,g.operator));expect(links).toEqual(expect.arrayContaining([expect.objectContaining({target:'request',targetId:g.request.id}),expect.objectContaining({target:'bet',targetId:g.bet.id})]))
 const before=await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')
 expect((await call('/api/operator/evidence',{...g.evidenceInput,betLinks:[{id:'absent',stance:'supporting'}]},g.operator)).status).toBe(422)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_items').first('n')).toBe(before)
 const now=new Date().toISOString()
 await env.DB.prepare("INSERT INTO releases(id,slug,state,author_operator_id,created_at,updated_at) VALUES('release','release','draft',?,?,?)").bind(g.actor,now,now).run()
 const outcome=await json<{id:string}>(call('/api/operator/evidence',{...g.evidenceInput,releaseId:'release'},g.operator),201)
 expect(await env.DB.prepare('SELECT release_id FROM evidence_items WHERE id=?').bind(outcome.id).first('release_id')).toBe('release')
})
it('[EVID-010] edits retain immutable operator wording versions and reject stale edits and revoked sessions',async()=>{
 const g=await fixture(),path=`/api/operator/evidence/${g.evidence.id}`
 const edited=await json<{id:string;versionId:string}>(call(path+'/wording',{wording:'A revised private quotation',expectedVersionId:g.evidence.versionId},g.operator,'PATCH'))
 expect(edited.id).toBe(g.evidence.id)
 expect((await call(path+'/wording',{wording:'Stale overwrite',expectedVersionId:g.evidence.versionId},g.operator,'PATCH')).status).toBe(409)
 const versions=await json<EvidenceVersion[]>(call(path+'/versions',undefined,g.operator));expect(versions.map(v=>v.wording)).toEqual(['A revised private quotation','Private evidence wording'])
 for(const headers of [{},await person()])expect((await call(path+'/versions',undefined,headers)).status).toBe(401)
 expect((await call(path+'/wording',{wording:'Foreign origin',expectedVersionId:edited.versionId},{...g.operator,Origin:'https://foreign.test'},'PATCH')).status).toBe(403)
 await env.DB.prepare('UPDATE oa_sessions SET revoked_at=?').bind(Date.now()).run()
 expect((await call(path+'/wording',{wording:'Revoked',expectedVersionId:edited.versionId},g.operator,'PATCH')).status).toBe(401)
 expect(await env.DB.prepare('SELECT count(*) n FROM evidence_versions WHERE evidence_id=?').bind(g.evidence.id).first('n')).toBe(2)
})
it('[EVID-007][REQ-004] deterministic published-only suggestions rank lexical overlap within 500ms and actions create no draft',async()=>{
 const g=await fixture();await publish(g)
 const board=(await env.DB.prepare("SELECT id FROM boards WHERE slug='feedback'").first<{id:string}>())!.id,now=new Date().toISOString()
 await env.DB.batch(Array.from({length:320},(_,index)=>env.DB.prepare(`INSERT INTO requests(id,slug,board_id,title,description,public_title,public_description,moderation_state,public_state,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'approved','open',?,?,?)`).bind(`extra-${index}`,`extra-${String(index).padStart(3,'0')}`,board,index<6?'Project reports':'Unrelated item',index<6?'CSV exporting workspace':'Other topic',index<6?'Project reports':'Unrelated item',index<6?'CSV exporting workspace':'Other topic',now,now,now)))
 await env.DB.prepare("UPDATE requests SET moderation_state='awaiting_review',public_title='Export project reports',public_description='CSV workspace reports' WHERE id='extra-0'").run()
 await env.DB.prepare("INSERT INTO boards(id,slug,name,visibility,position,archived_at,created_at,updated_at) VALUES('archived','archived','Archived','public',1,?,?,?)").bind(now,now,now).run()
 await env.DB.prepare("UPDATE requests SET board_id='archived' WHERE id='extra-1'").run()
 const start=performance.now(),suggestions=await json<RequestSuggestion[]>(call('/api/public/requests/suggestions?title=export%20project%20reports%20CSV')),elapsed=performance.now()-start
 expect(elapsed).toBeLessThan(500);console.log(`EVID-007: 321 requests, ${elapsed.toFixed(1)}ms`)
 expect(suggestions).toHaveLength(5);expect(suggestions[0]).toMatchObject({slug:g.request.slug,matchedTerms:['export','project','reports','csv']})
 expect(suggestions.some(s=>['extra-000','extra-001'].includes(s.slug))).toBe(false)
 expect(suggestions.slice(1).every(s=>!s.matchedTerms.includes('export'))).toBe(true)
 expect(await json(call('/api/public/requests/suggestions?title=export%20project%20reports%20CSV'))).toEqual(suggestions)
 const internal=await json<RequestSuggestion[]>(call('/api/operator/requests/suggestions?title=project%20reports',undefined,g.operator));expect(internal.every(s=>s.id)).toBe(true)
 const requester=await person(),before=await env.DB.batch(['requests','evidence_items','request_content_submissions'].map(table=>env.DB.prepare(`SELECT count(*) n FROM ${table}`)))
 expect((await call(`/api/public/requests/${g.request.slug}/vote`,{emailUpdates:false},requester)).status).toBe(204)
 expect((await call(`/api/public/requests/${g.request.slug}/follow`,{},requester)).status).toBe(204)
 const after=await env.DB.batch(['requests','evidence_items','request_content_submissions'].map(table=>env.DB.prepare(`SELECT count(*) n FROM ${table}`)))
 expect(after.map(r=>r.results)).toEqual(before.map(r=>r.results));expect(await env.DB.prepare('SELECT count(*) n FROM request_votes').first('n')).toBe(1);expect(await env.DB.prepare('SELECT count(*) n FROM request_follows').first('n')).toBe(1)
})
it('[EVID-008] original evidence attachment bytes stay operator-only with export and durable upload recovery',async()=>{
 const g=await fixture();await publish(g)
 const file=new File(['original evidence bytes'],'source.pdf',{type:'application/pdf'})
 async function upload(path:string,headers:Record<string,string>,value:File=file){const form=new FormData();form.append('file',value);return app.fetch(new Request(origin+path,{method:'POST',headers:{Host:'127.0.0.1:8787',Origin:origin,...headers},body:form}),bindings())}
 const attachment=await json<{id:string}>(upload(`/api/operator/evidence/${g.evidence.id}/attachments`,g.operator),201)
 const download=`/api/operator/evidence-attachments/${attachment.id}`
 const original=await call(download,undefined,g.operator);expect(original.status).toBe(200)
 expect(new Uint8Array(await original.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()))
 for(const headers of [{},await person()])expect((await call(download,undefined,headers)).status).toBe(401)
 expect((await call(`/api/public/attachments/${attachment.id}`)).status).toBe(404)
 expect((await upload(`/api/operator/evidence/${g.evidence.id}/attachments`,g.operator,new File(['x'],'bad.txt',{type:'text/plain'}))).status).toBe(400)
 const bundle=await json<{archive:Archive;journal:ErasureJournal}>(call('/api/operator/data/export',undefined,g.operator));expect(bundle.archive.files.map(f=>atob(f.bytes))).toContain('original evidence bytes')
 // An interrupted R2 write has durable custody and refuses export until recovered.
 const now=new Date().toISOString(),bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
 await env.DB.prepare("INSERT INTO evidence_attachment_uploads(id,evidence_id,storage_key,original_filename,content_type,byte_size,sha256,writing,created_at,updated_at) VALUES('interrupted',?,'evidence/interrupted','source.pdf','application/pdf',?,?,1,?,?)").bind(g.evidence.id,file.size,hash,now,now).run()
 expect((await call('/api/operator/data/export',undefined,g.operator)).status).toBe(409)
 expect((await call('/api/operator/evidence-uploads/interrupted/recover',{},g.operator)).status).toBe(409)
 await json(call('/api/operator/evidence-uploads/interrupted/release-writer',{confirmPriorWriterStopped:true},g.operator))
 expect((await call('/api/operator/data/export',undefined,g.operator)).status).toBe(409)
 expect((await upload('/api/operator/evidence-uploads/interrupted/recover',g.operator,new File(['different'],'source.pdf',{type:'application/pdf'}))).status).toBe(409)
 await json(upload('/api/operator/evidence-uploads/interrupted/recover',g.operator))
 const list=await json<EvidenceAttachments>(call(`/api/operator/evidence/${g.evidence.id}/attachments`,undefined,g.operator));expect(list.files).toHaveLength(2);expect(list.uploads).toHaveLength(0)
 await env.DB.prepare("UPDATE data_state SET phase='locked',lock_id='maintenance' WHERE singleton=1").run()
 expect((await upload(`/api/operator/evidence/${g.evidence.id}/attachments`,g.operator)).status).toBe(409)
})
it('[EVID-006] commercial fields and source attribution are absent from public APIs, documents, metadata, sitemap and requester mail',async()=>{
 const g=await fixture();await publish(g)
 const note='Private operator request note',rationale='Private commercial commitment rationale',alternative='Private alternative rejection'
 await json(call(`/api/operator/requests/${g.request.slug}/notes`,{body:note},g.operator),201)
 const commitment=await json<{itemId:string;slug:string}>(call(`/api/operator/decisions/${g.decision.id}/commit`,{selectedCandidateBetId:g.bet.id,rationale,ownerOperatorId:g.actor,confidence:'medium',reviewAt:'2026-11-01',noViableAlternativeReason:alternative},g.operator))
 const privateRoadmap={title:'Private delivery title',summary:'Private delivery summary',targetWindow:'Private target window',deliveryNotes:'Private delivery notes',accountImpact:'Private account impact'}
 await json(call(`/api/operator/roadmap/${commitment.itemId}`,{...privateRoadmap,ownerOperatorId:g.actor,confidence:'medium',decisionId:g.decision.id,candidateBetId:g.bet.id,publicTitle:null,publicSummary:null,evidenceIds:[g.evidence.id]},g.operator,'PATCH'))
 const roadmapCopy={title:'Downloadable project reports',summary:'Save your reports as a CSV file'}
 await json(call(`/api/operator/roadmap/${commitment.itemId}/approve`,{publicTitle:roadmapCopy.title,publicSummary:roadmapCopy.summary,boardSlug:'feedback',requestIds:[g.request.id]},g.operator))
 const transitionReason='Private shipment rationale'
 await json(call(`/api/operator/roadmap/${commitment.itemId}/move`,{status:'shipped',reason:transitionReason,idempotencyKey:'privacy-proof-shipment'},g.operator))
 const roadmapSlug=await env.DB.prepare('SELECT public_slug FROM roadmap_publications WHERE roadmap_item_id=?').bind(commitment.itemId).first<string>('public_slug')
 expect(roadmapSlug).toBeTypeOf('string')
 await env.DB.prepare("INSERT INTO tags(id,name,created_at,updated_at) VALUES('privacy-release-tag','Reporting',?,?)").bind(new Date().toISOString(),new Date().toISOString()).run()
 const releaseCopy={title:'Report downloads are available',body:'You can now download reports from your workspace.'}
 const release=await json<{id:string;slug:string}>(call('/api/operator/releases',{...releaseCopy,releaseType:'improved',tagIds:['privacy-release-tag'],publicationDate:'2026-10-11',targetIds:[commitment.itemId],authorOperatorId:g.actor},g.operator),201)
 const requester=await person();expect((await call(`/api/public/requests/${g.request.slug}/follow`,{},requester)).status).toBe(204)
 await json(call(`/api/operator/releases/${release.slug}/publish`,{},g.operator))
 // Post-release evidence retains the same commercial account and source attribution.
 const outcome=await json<{id:string}>(call('/api/operator/evidence',{...g.evidenceInput,releaseId:release.id},g.operator),201)
 const markers=['Secret Acme account','987654321','2027-09-21','Private renewal risk','Private sales call attribution','Private speaker','Private evidence wording','internalOwnerId','revenueCents','sourceLabel','namedSpeaker','sourceType','free_text','2026-10-10T10:00:00','renewalDate','accountImpact','deliveryNotes','targetWindow','ownerOperatorId','accountId',g.account.id,g.account.slug,g.actor,g.evidence.id,outcome.id,g.decision.id,g.decision.slug,g.bet.id,commitment.itemId,commitment.slug,'How should reports improve?','CSV exports','Allow report exports',note,rationale,alternative,transitionReason,...Object.values(privateRoadmap)]
 const safeRoadmap={slug:roadmapSlug,...roadmapCopy,status:'shipped',requests:[{slug:g.request.slug,title:'Export project reports'}]},safeRelease={slug:release.slug,...releaseCopy}
 const surfaces:[string,number,unknown?][]=[['/api/public/requests',200],[`/api/public/requests/${g.request.slug}`,200],['/api/public/requests/suggestions?title=reports',200],['/api/public/roadmap',200,[safeRoadmap]],[`/api/public/roadmap/${roadmapSlug}`,200,safeRoadmap],['/api/public/releases',200,[safeRelease]],[`/api/public/releases/${release.slug}`,200,safeRelease],[`/api/operator/accounts/${g.account.slug}`,401],[`/api/operator/evidence/${g.evidence.id}/versions`,401]]
 for(const [path,status,expected] of surfaces){const response=await call(path);expect(response.status,path).toBe(status);const body=await response.text();if(expected)expect(JSON.parse(body),path).toMatchObject(expected);for(const marker of markers)expect(body,path).not.toContain(marker)}
 const documents:[string,number,string[]?][]=[[`/portal/feedback/${g.request.slug}`,200],['/portal',302],['/portal/feedback',200],['/portal/roadmap',200,Object.values(roadmapCopy)],[`/portal/roadmap/${roadmapSlug}`,200,Object.values(roadmapCopy)],['/portal/updates',200,Object.values(releaseCopy)],[`/portal/updates/${release.slug}`,200,Object.values(releaseCopy)],['/sitemap.xml',404]]
 // Scan the complete built response, including metadata and serialized hydration data.
 for(const [path,status,approvedCopy] of documents){const response=await builtCall(path);expect(response.status,path).toBe(status);const html=await response.text();for(const text of approvedCopy??[])expect(html,path).toContain(text);for(const marker of markers)expect(html,path).not.toContain(marker)}
 await json(call(`/api/operator/requests/${g.request.slug}/status-updates`,{status:'under_review',body:'Reports are being reviewed',pinned:false},g.operator))
 const nextDay=new Date();nextDay.setUTCDate(nextDay.getUTCDate()+1);nextDay.setUTCHours(12,0,0,0)
 await drainNotifications(createPennyRuntime(bindings()),()=>nextDay.getTime())
 await drainReleaseDeliveries(createPennyRuntime(bindings()),()=>nextDay.getTime())
 expect(await env.DB.prepare("SELECT count(*) n FROM notification_batches WHERE state='accepted'").first('n')).toBe(1)
 const deliveries=await env.DB.prepare("SELECT n.id,n.delivery_state AS state FROM notification_outbox n JOIN release_versions v ON v.id=n.subject_id WHERE n.event_type='release_version' AND v.release_id=?").bind(release.id).all<{id:string;state:string}>()
 expect(deliveries.results).toHaveLength(1);expect(deliveries.results[0].state).toBe('accepted')
 const messages=await env.DB.prepare('SELECT id,message FROM rer_mail_development_outbox').all<{id:string;message:string}>()
 expect(messages.results.length).toBeGreaterThan(1)
 for(const path of ['/__dev/outbox','/__dev/outbox?message='+messages.results[0].id]){
  expect((await call(path)).status).toBe(404)
  expect((await call(path,undefined,{'x-rer-dev-key':'wrong-'+devKey})).status).toBe(404)
 }
 const releaseMessages=messages.results.map(row=>JSON.parse(row.message) as {deliveryId:string;to:string[];subject:string;text:string}).filter(message=>message.deliveryId===deliveries.results[0].id)
 expect(releaseMessages).toHaveLength(1)
 expect(releaseMessages[0]).toMatchObject({to:['requester@example.test'],subject:releaseCopy.title})
 for(const approved of [releaseCopy.title,releaseCopy.body,`Export project reports: ${origin}/portal/feedback/${g.request.slug}`,`${origin}/portal/updates/${release.slug}`])expect(releaseMessages[0].text).toContain(approved)
 for(const message of messages.results){for(const marker of markers)expect(message.message).not.toContain(marker);const page=await call('/__dev/outbox?message='+message.id,undefined,{'x-rer-dev-key':devKey});expect(page.status).toBe(200);const body=await page.text();for(const marker of markers)expect(body).not.toContain(marker)}
})
