import './custom-field-races'
import { applyD1Migrations,reset } from 'cloudflare:test'
import { beforeEach,afterEach,vi, expect,inject,it } from 'vitest'
import { call,env,owner,requester,mockMail,origin } from './support'
import { exports } from 'cloudflare:workers'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()});afterEach(()=>vi.restoreAllMocks())
async function graph(){
 const operator=await owner(),person=await requester()
 expect((await call('/api/operator/boards',{name:'Product feedback',slug:'product',visibility:'public'},operator)).status).toBe(201)
 async function submit(title:string){const r=await call('/api/public/requests',{title,description:'Private first-post wording',boardSlug:'product',idempotencyKey:crypto.randomUUID()},person);expect(r.status).toBe(201);return (await r.json() as {slug:string}).slug}
 async function approve(slug:string,title:string){expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title,description:'Approved public wording',boardSlug:'product',displayName:'Public requester'},operator)).status).toBe(200)}
 return {operator,person,submit,approve}
}
it('[REQ-003/006/007/008/009/010/015] Base-signed operator moderates first posts, comments, status and merge reversal with real requester mail',async()=>{
 const g=await graph(),a=await g.submit('Private source'),b=await g.submit('Private target')
 expect((await call(`/api/public/requests/${a}`)).status).toBe(404)
 await g.approve(a,'Source');await g.approve(b,'Target')
 for(const slug of [a,b]){
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/vote`,{},g.person)).status).toBe(204)
  expect((await call(`/api/public/requests/${slug}/follow`,{},g.person)).status).toBe(204)
 }
 const comment=await call(`/api/public/requests/${a}/comments`,{body:'Held comment'},g.person);expect(comment.status).toBe(201)
 const {id}=await comment.json() as {id:string}
 expect(await (await call(`/api/public/requests/${a}`)).json()).toMatchObject({voteCount:1,comments:[]})
 expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:'Approved person'},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${a}/status-updates`,{status:'under_review',body:'Reviewing this request.',pinned:true},g.operator)).status).toBe(200)
 expect((await call(`/api/operator/requests/${a}/merge`,{targetSlug:b},g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${a}`)).status).toBe(301)
 expect(await (await call(`/api/public/requests/${b}`)).json()).toMatchObject({voteCount:1,comments:[{body:'Held comment'}]})
 expect((await call(`/api/operator/requests/${a}/unmerge`,{},g.operator)).status).toBe(200)
 const published=await (await call(`/api/public/requests/${a}`)).text();expect(published).toContain('Held comment');expect(published).toContain('Reviewing this request.');expect(published).not.toContain('Private first-post wording')
 const actor=await env.DB.prepare('SELECT id FROM operators WHERE email=?').bind('owner@penny.invalid').first<{id:string}>();expect(actor!.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
 expect((await env.DB.prepare('SELECT count(*) AS n FROM operator_sessions').first<{n:number}>())!.n).toBe(0)
})
it('[REQ-011/018/019 EVID-009] Base-signed board/tag management preserves private tags and separate file approval',async()=>{
 const g=await graph(),slug=await g.submit('With attachment');await g.approve(slug,'Public attachment request')
 const tag=await call('/api/operator/catalog/tags',{name:'Private enterprise context'},g.operator);expect(tag.status).toBe(201)
 const tagId=(await tag.json() as {id:string}).id
 const requestId=(await env.DB.prepare('SELECT id FROM requests WHERE slug=?').bind(slug).first<{id:string}>())!.id
 expect((await call(`/api/operator/catalog/requests/${requestId}/tags/${tagId}`,{},g.operator,'PUT')).status).toBe(200)
 const form=new FormData();form.set('file',new File([new Uint8Array([137,80,78,71])],'diagram.png',{type:'image/png'}))
 const upload=await exports.default.fetch(new Request(origin+`/api/public/requests/${slug}/attachments`,{method:'POST',headers:{...g.person,Origin:origin},body:form}));expect(upload.status).toBe(201)
 const file=(await upload.json() as {id:string}).id
 expect((await call(`/api/public/attachments/${file}`)).status).toBe(404)
 expect((await call(`/api/operator/attachments/${file}/moderate`,{verdict:'approved'},g.operator)).status).toBe(200)
 expect(new Uint8Array(await (await call(`/api/public/attachments/${file}`)).arrayBuffer())).toEqual(new Uint8Array([137,80,78,71]))
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
 const {localOutbox}=await import('@/core/features/auth/local-outbox'),{createPennyRuntime}=await import('@/core/app/runtime')
 const bindings={...env,PENNY_ENVIRONMENT:'local',APP_ORIGIN:'http://127.0.0.1:8787',WORKSPACE_TIMEZONE:'UTC',MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test',SENDGRID_API_KEY:undefined}
 const next=new Date();next.setUTCDate(next.getUTCDate()+1);next.setUTCHours(9,0,0,0);vi.spyOn(Date,'now').mockReturnValue(next.getTime())
 await runNotificationSchedule(createScheduledController({scheduledTime:Date.now(),cron:'* * * * *'}),bindings)
 expect((await localOutbox(createPennyRuntime(bindings))!.list()).length).toBeGreaterThan(0)
 const receipts=await env.DB.prepare("SELECT actor_id,action,entity_id,occurred_at FROM audit_entries WHERE action LIKE 'release_mail.attempt.%' OR action LIKE 'request_mail.attempt.%'").all<{actor_id:string;action:string;entity_id:string;occurred_at:string}>()
 expect(receipts.results.some(row=>row.action.endsWith('.accepted'))).toBe(true)
 expect(receipts.results.every(row=>row.actor_id&&row.entity_id&&Number.isFinite(Date.parse(row.occurred_at)))).toBe(true)
})
