import {proveRoadmapPublication} from './roadmap-update-publication'
import './custom-field-races'
import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,vi, expect,inject,it } from 'vitest'
import { call,env,owner,requester,mockMail,origin } from './support'
import { exports } from 'cloudflare:workers'
import {explicitConsentBoard} from './explicit-consent-board'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()});afterEach(()=>vi.restoreAllMocks())
async function graph(){
 const operator=await owner(),person=await requester()
 expect((await call('/api/operator/boards',{name:'Product feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
 await explicitConsentBoard('product',(path,method,body)=>call(path,body,operator,method))
 async function submit(title:string){const r=await call('/api/public/requests',{title,description:'Private first-post wording',boardSlug:'product',idempotencyKey:crypto.randomUUID()},person);expect(r.status).toBe(201);return (await r.json() as {slug:string}).slug}
 async function approve(slug:string,title:string){expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title,description:'Approved public wording',boardSlug:'product',displayName:'Public requester'},operator)).status).toBe(200)}
 return {operator,person,submit,approve}
}
async function submissionCustody(){
 const tables=['requests','evidence_items','evidence_versions','request_evidence_links','request_evidence_contributions','request_submission_keys','request_content_submissions','request_vote_contributions','request_votes','request_follow_contributions','request_follows','requester_update_permissions','requester_write_guards','audit_entries']
 return Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])))
}
it('[REQ-003/006/007/008/009/010/015] Base-signed operator moderates first posts, comments, status and merge reversal with real requester mail',async()=>{
 const g=await graph()
 const input={title:'Private source',description:'Private first-post wording',proposedSolution:'Schedule a monthly export',impactStatement:'Avoid manual reconciliation',boardSlug:'product',emailUpdates:true,idempotencyKey:crypto.randomUUID()}
 const submitted=await call('/api/public/requests',input,g.person);expect(submitted.status).toBe(201)
 const created=await submitted.json() as {slug:string;moderationState:string},a=created.slug
 expect(created.moderationState).toBe('awaiting_review')
 const requests=(await env.DB.prepare('SELECT id,slug,author_requester_id,moderation_state,public_state,published_at FROM requests').all<{id:string;slug:string;author_requester_id:string;moderation_state:string;public_state:string;published_at:string|null}>()).results
 expect(requests).toEqual([{id:expect.any(String),slug:a,author_requester_id:expect.any(String),moderation_state:'awaiting_review',public_state:'unpublished',published_at:null}])
 const request=requests[0],evidence=(await env.DB.prepare('SELECT id,requester_id,source_type,review_state FROM evidence_items').all<{id:string;requester_id:string;source_type:string;review_state:string}>()).results
 expect(evidence).toEqual([{id:expect.any(String),requester_id:request.author_requester_id,source_type:'portal_request',review_state:'unreviewed'}])
 for(const table of ['request_evidence_links','request_evidence_contributions'])expect((await env.DB.prepare(`SELECT request_id,evidence_id FROM ${table}`).all()).results).toEqual([{request_id:request.id,evidence_id:evidence[0].id}])
 expect((await env.DB.prepare('SELECT evidence_id,version_number,wording FROM evidence_versions').all()).results).toEqual([{evidence_id:evidence[0].id,version_number:1,wording:[input.title,input.description,input.proposedSolution,input.impactStatement].join('\n\n')}])
 expect((await env.DB.prepare('SELECT request_id,evidence_id FROM request_submission_keys').all()).results).toEqual([{request_id:request.id,evidence_id:evidence[0].id}])
 expect((await env.DB.prepare('SELECT request_id,requester_id,title,description,proposed_solution,impact_statement,moderation_state,is_initial FROM request_content_submissions').all()).results).toEqual([{request_id:request.id,requester_id:request.author_requester_id,title:input.title,description:input.description,proposed_solution:input.proposedSolution,impact_statement:input.impactStatement,moderation_state:'awaiting_review',is_initial:1}])
 expect((await call(`/api/operator/requests/${a}/context`,undefined,g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${a}`)).status).toBe(404)
 expect(await (await call('/api/public/requests')).json()).toEqual([])
 const committed=await submissionCustody()
 const replay=await call('/api/public/requests',input,g.person);expect(replay.status).toBe(201);expect(await replay.json()).toEqual(created)
 expect(await submissionCustody()).toEqual(committed)
 // Fail the final business write after evidence, links, custody and participation.
 const retryInput={...input,title:'Interrupted submission',idempotencyKey:crypto.randomUUID()}
 await env.DB.exec("CREATE TRIGGER refuse_submission_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.submitted' BEGIN SELECT RAISE(ABORT,'submission audit unavailable'); END")
 try{
  expect((await call('/api/public/requests',retryInput,g.person)).status).toBe(503)
  expect(await submissionCustody()).toEqual(committed)
 }finally{await env.DB.exec('DROP TRIGGER refuse_submission_audit')}
 const retries=await Promise.all([call('/api/public/requests',retryInput,g.person),call('/api/public/requests',retryInput,g.person)])
 expect(retries.map(response=>response.status)).toEqual([201,201])
 const retried=await retries[0].json() as {slug:string},b=retried.slug
 expect(await retries[1].json()).toEqual(retried)
 expect((await env.DB.prepare('SELECT id FROM requests').all()).results).toHaveLength(2)
 expect((await env.DB.prepare('SELECT id FROM evidence_items').all()).results).toHaveLength(2)
 expect((await call(`/api/public/requests/${b}`)).status).toBe(404)
 await g.approve(a,'Source');await g.approve(b,'Target')
 const publicBefore=await (await call(`/api/public/requests/${a}`)).json()
 const editInput={title:'Source clarified',description:'A reviewed monthly summary',proposedSolution:'Include a reconciliation sheet',impactStatement:'Reduce repeated manual work'}
 const editResponse=await call(`/api/public/requests/${a}`,editInput,g.person,'PATCH')
 expect(editResponse.status).toBe(200);expect(await editResponse.json()).toEqual({slug:a,moderationState:'awaiting_review'})
 const context=async()=>{const response=await call(`/api/operator/requests/${a}/context`,undefined,g.operator);expect(response.status).toBe(200);return response.json() as Promise<{edits:{id:string;request_id:string;requester_id:string;title:string;description:string;proposed_solution:string;impact_statement:string;moderation_state:string;approved_at:string|null}[]}>}
 const pending=await context();expect(pending.edits).toHaveLength(1)
 const edit=pending.edits[0]
 expect(edit).toMatchObject({request_id:request.id,requester_id:request.author_requester_id,title:editInput.title,description:editInput.description,proposed_solution:editInput.proposedSolution,impact_statement:editInput.impactStatement,moderation_state:'awaiting_review',approved_at:null})
 expect(await (await call(`/api/public/requests/${a}`)).json()).toEqual(publicBefore)
 const publicList=await (await call('/api/public/requests')).json() as {slug:string;title:string;description:string}[]
 expect(publicList.find(item=>item.slug===a)).toMatchObject({title:'Source',description:'Approved public wording'})
 const heldGraph=await submissionCustody()
 expect((await call(`/api/operator/requests/edits/${edit.id}/moderate`,{verdict:'approved'},g.person)).status).toBe(401)
 expect(await submissionCustody()).toEqual(heldGraph)
 expect((await call(`/api/operator/requests/edits/${edit.id}/moderate`,{verdict:'approved'},g.operator)).status).toBe(200)
 expect((await context()).edits).toEqual([expect.objectContaining({...edit,moderation_state:'approved',approved_at:expect.any(String),updated_at:expect.any(String)})])
 expect(await (await call(`/api/public/requests/${a}`)).json()).toMatchObject({slug:a,title:editInput.title,description:editInput.description})
 expect((await (await call('/api/public/requests')).json() as {slug:string;title:string;description:string}[]).find(item=>item.slug===a)).toMatchObject({title:editInput.title,description:editInput.description})
 for(const slug of [a,b]){
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/follow`,{},g.person)).status).toBe(204)
 }
 const comment=await call(`/api/public/requests/${a}/comments`,{body:'Held comment'},g.person);expect(comment.status).toBe(201)
 const {id}=await comment.json() as {id:string}
 expect(await (await call(`/api/public/requests/${a}`)).json()).toMatchObject({voteCount:1,comments:[]})
 // The review form offers the requester's verified name; an approval without any name is refused with its reason.
 const held=await (await call(`/api/operator/requests/${a}/context`,undefined,g.operator)).json() as {comments:{id:string;requester_display_name:string}[]}
 expect(held.comments.find(c=>c.id===id)?.requester_display_name).toBe('Private display')
 const unnamed=await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved'},g.operator);expect(unnamed.status).toBe(400);expect(await unnamed.json()).toMatchObject({error:'public_author_name_required'})
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved person'},g.operator)).status).toBe(200)
 expect(await (await call(`/api/public/requests/${a}`)).json()).toMatchObject({comments:[{body:'Held comment',author:{displayName:'Approved person'}}]})
 expect((await call(`/api/operator/requests/${a}/status-updates`,{status:'under_review',body:'Reviewing this request.',pinned:true},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${a}/merge`,{targetSlug:b},g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${a}`)).status).toBe(301)
 expect(await (await call(`/api/public/requests/${b}`)).json()).toMatchObject({voteCount:1,comments:[{body:'Held comment'}]})
 expect((await call(`/api/operator/requests/${a}/unmerge`,{},g.operator)).status).toBe(200)
 const published=await (await call(`/api/public/requests/${a}`)).text();expect(published).toContain('Held comment');expect(published).toContain('Reviewing this request.');expect(published).not.toContain('Private first-post wording')
 const actor=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<{id:string}>();expect(actor!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM operator_sessions').first<{n:number}>())!.n).toBe(0)
})
it('[REQ-011/018/019 EVID-009] Base-signed board/tag management preserves private tags, separate file approval and the per-request attachment total',async()=>{
 const g=await graph(),slug=await g.submit('With attachment');await g.approve(slug,'Public attachment request')
 const tag=await call('/api/operator/catalog/tags',{name:'Private enterprise context'},g.operator);expect(tag.status).toBe(201)
 const tagId=(await tag.json() as {id:string}).id
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>())!.id
 expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${tagId}`,{},g.operator,'PUT')).status).toBe(200)
 const attach=(file:File)=>{const form=new FormData();form.set('file',file);return exports.default.fetch(new Request(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{...g.person,Origin:origin},body:form}))}
 const upload=await attach(new File([new Uint8Array([137,80,78,71])],'diagram.png',{type:'image/png'}));expect(upload.status).toBe(201)
 const file=(await upload.json() as {id:string}).id,{limits}=(await import('../../seed.json')).default,stored=async()=>Number(await env.DB.prepare('SELECT SUM(byte_size) n FROM attachments WHERE request_id=?').bind(requestId).first('n')),pdf=(size:number)=>attach(new File([new Uint8Array(size)],'large.pdf',{type:'application/pdf'}))
 expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
 expect((await call(`/api/operator/attachments/${file}/moderate`,{verdict:'approved'},g.operator)).status).toBe(200)
 expect(new Uint8Array(await (await call(`/api/public/attachments/${file}`)).arrayBuffer())).toEqual(new Uint8Array([137,80,78,71]))
 for(let room=Math.floor((limits.uploadBytesPerRequest-await stored())/limits.uploadBytesPerFile);room>0;room--)expect((await pdf(limits.uploadBytesPerFile)).status).toBe(201);const left=limits.uploadBytesPerRequest-await stored(),objects=(await env.FILES.list()).objects.length;expect((await Promise.all([pdf(left),pdf(left)])).map(r=>r.status).sort(),'a request keeps its files within the per-request total').toEqual([201,400]);expect(await stored()).toBe(limits.uploadBytesPerRequest);expect((await env.FILES.list()).objects.length).toBe(objects+1)
 expect(await (await call(`/api/public/requests/${slug}`)).text()).not.toContain('Private enterprise context')
 expect((await call('/api/operator/boards/product',{visibility:'internal'},g.operator,'PATCH')).status).toBe(200)
 expect((await call(`/api/public/requests/${slug}`)).status).toBe(404);expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
})

it('[BASE-OPS-005 REQ-027] catalog destruction, board withdrawal and configuration revocation commit durable actor audits or roll back',async()=>{
 const g=await graph(),slug=await g.submit('Audited request');await g.approve(slug,'Approved request')
 const requestId=await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<string>('id')
 const makeTag=async(name:string)=>{const response=await call('/api/operator/catalog/tags',{name},g.operator);expect(response.status).toBe(201);return (await response.json() as {id:string}).id}
 const source=await makeTag('Audit source'),target=await makeTag('Audit target')
 expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${source}`,{},g.operator,'PUT')).status).toBe(200)
 expect((await call(`/api/operator/catalog/tags/${source}/merge`,{targetId:target},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${target}`,undefined,g.operator,'DELETE')).status).toBe(204)
 expect((await call(`/api/operator/catalog/tags/${target}`,undefined,{},'DELETE')).status).toBe(401)
 expect((await call(`/api/operator/catalog/tags/${target}`,undefined,g.operator,'DELETE')).status).toBe(204)
 expect((await call(`/api/operator/catalog/tags/${target}`,undefined,g.operator,'DELETE')).status).toBe(404)
 expect((await call('/api/operator/boards/product',{archived:true},g.operator,'PATCH')).status).toBe(200)
 expect((await call(`/api/public/requests/${slug}`)).status).toBe(200)
 expect(await(await call('/api/public/boards')).text()).not.toContain('Product feedback')
 const actor=await env.DB.prepare("SELECT id FROM operators WHERE email='owner@penny.invalid'").first<string>('id')
 const actions=(await env.DB.prepare("SELECT action,actor_id,entity_id,occurred_at FROM audit_entries WHERE action IN('tag.merged','tag.detached','tag.deleted','board.archived') ORDER BY occurred_at,id").all<{action:string;actor_id:string;entity_id:string;occurred_at:string}>()).results
 expect(actions.map(row=>row.action).sort()).toEqual(['board.archived','tag.deleted','tag.detached','tag.merged'])
 expect(actions.every(row=>row.actor_id===actor&&row.entity_id&&Number.isFinite(Date.parse(row.occurred_at)))).toBe(true)
 expect(await env.DB.prepare('SELECT id FROM tags WHERE id IN (?,?)').bind(source,target).first()).toBeNull()
 const held=await makeTag('Rollback tag')
 await env.DB.exec("CREATE TRIGGER refuse_destructive_audit BEFORE INSERT ON audit_entries BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(`/api/operator/catalog/tags/${held}`,undefined,g.operator,'DELETE')).status).toBe(503)
 expect(await env.DB.prepare('SELECT id FROM tags WHERE id=?').bind(held).first()).toEqual({id:held})
 expect((await call('/api/operator/boards/product',{archived:false},g.operator,'PATCH')).status).toBe(503)
 expect(await env.DB.prepare("SELECT archived_at FROM boards WHERE slug='product'").first('archived_at')).toBeTruthy()
 expect((await call('/api/operator/settings/frames',{publicOriginAllowlist:['https://embed.example.test']},g.operator,'PUT')).status).toBe(503)
 expect(await env.DB.prepare('SELECT * FROM penny_frame_settings').first()).toBeNull()
 await env.DB.exec('DROP TRIGGER refuse_destructive_audit')
 expect((await call('/api/operator/boards/product',{archived:false},g.operator,'PATCH')).status).toBe(200)
 expect((await call(`/api/public/requests/${slug}/withdraw`,{},g.person)).status).toBe(204)
 expect(await env.DB.prepare("SELECT actor_id,entity_id,occurred_at FROM audit_entries WHERE action='request.withdrawn'").first()).toMatchObject({actor_id:expect.any(String),entity_id:requestId,occurred_at:expect.any(String)})
 // Revocation retains the acting operator as well as Base's feature receipt.
 const keyResponse=await call('/api/operator/integrations/keys',{name:'Revocable key',scopes:['requests:read']},g.operator)
 expect(keyResponse.status).toBe(201);const key=await keyResponse.json() as {credential:{id:string}}
 expect((await call(`/api/operator/integrations/keys/${key.credential.id}`,undefined,g.operator,'DELETE')).status).toBe(200)
 expect(await env.DB.prepare("SELECT actor_id,entity_id FROM audit_entries WHERE action='integration.key_revoked'").first()).toEqual({actor_id:actor,entity_id:key.credential.id})
})

it('[BASE-OPS-005] publication and real scheduled mail retain feature outcomes; an unavailable audit prevents publication',async()=>{
 await proveRoadmapPublication()
 await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()
 const {releaseGraph}=await import('./release-fixture'),g=await releaseGraph(1)
 await env.DB.exec("CREATE TRIGGER refuse_publication_audit BEFORE INSERT ON audit_entries WHEN NEW.action='release.published' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator)).status).toBe(503)
 expect(await env.DB.prepare('SELECT state FROM releases WHERE slug=?').bind(g.draft.slug).first('state')).toBe('draft')
 expect(await env.DB.prepare("SELECT id FROM notification_outbox WHERE event_type='release_version'").first()).toBeNull()
 await env.DB.exec('DROP TRIGGER refuse_publication_audit')
 expect((await call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator)).status).toBe(200)
 const corrected=await call(`/api/operator/releases/${g.draft.slug}/corrections`,{expectedVersionId:g.draft.versionId,title:'Updated public title',body:'Updated public wording'},g.operator)
 expect(corrected.status).toBe(201);const version=(await corrected.json() as {versionId:string}).versionId
 expect((await call(`/api/operator/releases/${g.draft.slug}/versions/${version}/deliver`,{},g.operator)).status).toBe(200)
 const transition=await g.transition('shipped')
 expect((await call(`/api/operator/roadmap-updates/${transition}/publish`,{},g.operator)).status).toBe(200)
 const rows=(await env.DB.prepare("SELECT actor_id,action,entity_id,occurred_at FROM audit_entries WHERE action IN('release.published','release.corrected','release.delivery_requested','roadmap.update_published')").all<{actor_id:string;action:string;entity_id:string;occurred_at:string}>()).results
 expect(rows.map(row=>row.action).sort()).toEqual(['release.corrected','release.delivery_requested','release.published','roadmap.update_published'])
 expect(rows.every(row=>row.actor_id===g.actor&&row.entity_id&&Number.isFinite(Date.parse(row.occurred_at)))).toBe(true)
 const {runNotificationSchedule}=await import('@/core/features/notifications/scheduled'),{createScheduledController}=await import('cloudflare:test')
 const {providerMessages}=await import('./provider-messages'),{createPennyRuntime}=await import('@/core/app/runtime')
 const bindings={...env,PENNY_ENVIRONMENT:'test',APP_ORIGIN:'https://127.0.0.1:8787',WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'sendgrid',MAIL_FROM:'auth@localhost.test',MAIL_API_KEY:'synthetic-provider-test-key'}
 const next=new Date();next.setUTCDate(next.getUTCDate()+1);next.setUTCHours(9,0,0,0);vi.spyOn(Date,'now').mockReturnValue(next.getTime())
 await runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 expect((await providerMessages(createPennyRuntime(bindings))!.list()).length).toBeGreaterThan(0)
 const receipts=await env.DB.prepare("SELECT actor_id,action,entity_id,occurred_at FROM audit_entries WHERE action LIKE 'release_mail.attempt.%' OR action LIKE 'request_mail.attempt.%'").all<{actor_id:string;action:string;entity_id:string;occurred_at:string}>()
 expect(receipts.results.some(row=>row.action.endsWith('.accepted'))).toBe(true)
 expect(receipts.results.every(row=>row.actor_id&&row.entity_id&&Number.isFinite(Date.parse(row.occurred_at)))).toBe(true)
})
