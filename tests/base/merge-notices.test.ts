import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,expect,inject,it,vi} from 'vitest'
import {mockMail} from './support'
import {accepted,graph,body,call,env,requester} from './subscription-fixture'

beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()})
afterEach(()=>vi.restoreAllMocks())
const notices=()=>env.DB.prepare("SELECT * FROM notification_events WHERE kind='merge'").all()

it('[NOTIFY-012] previews and delivers only duplicate subscribers absent from the canonical request, once, with opt-out and silent unmerge',async()=>{
 const g=await graph(),source=await g.submit(),target=await g.submit();await g.publish(source);await g.publish(target)
 await accepted(call('/api/public/requester/notifications',{muted:true},g.author,'PATCH'))
 const first=await requester('Finance lead'),overlap=await requester('Already following both')
 for(const person of [first,overlap])await accepted(call(`/api/public/requests/${source}/follow`,{},person),204)
 await accepted(call(`/api/public/requests/${source}/vote`,{subscriptionVersion:g.disclosure.version},g.voter),204)
 await accepted(call(`/api/public/requests/${target}/follow`,{},overlap),204)
 await g.flush();g.sent.length=0
 const preview=await accepted(call(`/api/operator/requests/${source}/merge-preview?targetSlug=${target}`,undefined,g.operator))
 expect(await preview.json()).toEqual({recipientCount:2})
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target,notifySubscribers:true},g.operator))
 expect((await notices()).results).toHaveLength(1)
 await g.flush();expect(g.sent).toHaveLength(2)
 expect(g.sent.map(mail=>mail.personalizations[0].to[0].email).sort()).toEqual((await env.DB.prepare("SELECT a.email FROM requester_addresses a JOIN requesters r ON r.id=a.requester_id WHERE r.display_name IN ('Finance lead','Voter') ORDER BY a.email").all<{email:string}>()).results.map(row=>row.email))
 for(const mail of g.sent){expect(body(mail)).toContain('Request merged');expect(body(mail)).toContain('Improve feedback');expect(body(mail)).toContain(`/portal/feedback/${target}`);expect(body(mail)).toContain('Unsubscribe from all requester email');expect(body(mail)).toContain('1 Test Street')}
 await g.flush();expect(g.sent).toHaveLength(2)
 expect((await call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator)).status).toBe(404)
 await accepted(call(`/api/operator/requests/${source}/unmerge`,{},g.operator));await g.flush();expect(g.sent).toHaveLength(2)
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target,notifySubscribers:false},g.operator));await g.flush();expect(g.sent).toHaveLength(2)
 expect((await notices()).results).toHaveLength(1)
 const audits=(await env.DB.prepare("SELECT details_json FROM audit_entries WHERE action='request.merged' ORDER BY rowid").all<{details_json:string}>()).results.map(row=>JSON.parse(row.details_json))
 expect(audits).toMatchObject([{notifySubscribers:1,noticeRecipients:2},{notifySubscribers:0,noticeRecipients:0}])
})

it('[NOTIFY-012] holds private canonical notices until publication and rechecks opt-outs, reversal and authority before delivery',async()=>{
 const g=await graph(),source=await g.submit(),target=await g.submit();await g.publish(source)
 await accepted(call('/api/public/requester/notifications',{muted:true},g.author,'PATCH'))
 await accepted(call(`/api/public/requests/${source}/follow`,{},g.voter),204)
 await g.flush();g.sent.length=0
 expect((await call(`/api/operator/requests/${source}/merge-preview?targetSlug=${target}`)).status).toBe(401)
 expect((await call(`/api/operator/requests/${source}/merge`,{targetSlug:target},{...g.operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 await env.DB.exec("CREATE TRIGGER fail_merge_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.merged' BEGIN SELECT RAISE(ABORT,'merge audit failure'); END")
 try{expect((await call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator)).status).toBe(503)}finally{await env.DB.exec('DROP TRIGGER fail_merge_audit')}
 expect((await env.DB.prepare('SELECT * FROM penny_merge_notices').all()).results).toEqual([])
 expect((await env.DB.prepare('SELECT * FROM request_merges').all()).results).toEqual([])
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator))
 await g.flush();expect(g.sent).toHaveLength(0);expect((await notices()).results).toHaveLength(0)
 await g.publish(target);await g.flush();expect(g.sent).toHaveLength(1);expect(body(g.sent[0])).toContain(`/portal/feedback/${target}`)
 await accepted(call(`/api/operator/requests/${source}/unmerge`,{},g.operator))
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator))
 await accepted(call('/api/public/requester/notifications',{muted:true},g.voter,'PATCH'))
 await g.flush();expect(g.sent).toHaveLength(1)
 // Reversing a new, unsent merge invalidates its event without producing an unmerge message.
 await accepted(call('/api/public/requester/notifications',{muted:false},g.voter,'PATCH'))
 await accepted(call(`/api/operator/requests/${source}/unmerge`,{},g.operator))
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator))
 await accepted(call(`/api/operator/requests/${source}/unmerge`,{},g.operator))
 await g.flush();expect(g.sent).toHaveLength(1)
})

it('[NOTIFY-012] migration preserves populated event, intent and delivery custody and restored pending notices stay held',async()=>{
 await reset();const migrations=inject('migrations');await applyD1Migrations(env.DB,migrations.filter(m=>m.name<'0077'));mockMail()
 const g=await graph(),source=await g.submit(),target=await g.submit();await g.publish(source)
 await accepted(call('/api/public/requester/notifications',{muted:true},g.author,'PATCH'))
 await accepted(call(`/api/public/requests/${source}/follow`,{},g.voter),204)
 // Populate this historical schema with its original status-row shape. The
 // current publication API requires columns added by later migrations.
 const stamp=new Date().toISOString()
 await env.DB.prepare(`INSERT INTO request_status_updates(id,request_id,public_status,body,pinned,operator_id,published_at,created_at,updated_at)
  SELECT ?,id,'planned','',0,?,?,?,? FROM requests WHERE slug=?`)
  .bind(crypto.randomUUID(),(await env.DB.prepare('SELECT id FROM operators LIMIT 1').first<{id:string}>())!.id,stamp,stamp,stamp,source).run()
 const {prepareBatches}=await import('@/core/features/notifications/batches');await prepareBatches(env.DB,new Date().toISOString())
 const batches=(await env.DB.prepare('SELECT * FROM notification_batches ORDER BY rowid').all()).results
 const events=(await env.DB.prepare('SELECT * FROM notification_events ORDER BY rowid').all()).results
 const intents=(await env.DB.prepare('SELECT * FROM notification_intents ORDER BY rowid').all()).results
 expect(intents.length).toBeGreaterThan(0)
 const intentColumns=Object.keys(intents[0]).map(name=>'"'+name.replaceAll('"','""')+'"').join(',')
 await applyD1Migrations(env.DB,migrations);await applyD1Migrations(env.DB,migrations)
 expect((await env.DB.prepare('SELECT * FROM notification_events ORDER BY rowid').all()).results).toEqual(events)
 expect((await env.DB.prepare(`SELECT ${intentColumns} FROM notification_intents ORDER BY rowid`).all()).results).toEqual(intents)
 expect((await env.DB.prepare('SELECT * FROM notification_batches ORDER BY rowid').all()).results).toEqual(batches)
 await g.flush();g.sent.length=0
 await accepted(call(`/api/operator/requests/${source}/merge`,{targetSlug:target},g.operator))
 const archive=await (await accepted(call('/api/operator/data/export',undefined,g.operator))).json() as {archive:{tables:Record<string,Record<string,unknown>[]>};journal:unknown}
 expect(archive.archive.tables.penny_merge_notices[0].restoration_hold_at).toBeTruthy()
 expect(archive.archive.tables.penny_merge_notice_recipients).toHaveLength(1)
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
 const restore=archive as unknown as {archive:unknown;journal:unknown}
 await reset();await applyD1Migrations(env.DB,migrations)
 const {owner}=await import('./support'),operator=await owner()
 const imported=await call('/api/operator/data/import',restore,operator);expect([200,202]).toContain(imported.status)
 let result=await imported.json() as {status:string;operationId:string}
 for(let step=0;step<80&&result.status!=='complete';step++){const response=await call(`/api/operator/data/operations/${result.operationId}/resume`,{},operator);expect([200,202]).toContain(response.status);result=await response.json() as typeof result}
 expect(result.status).toBe('complete')
 await accepted(call(`/api/operator/moderation/${target}`,{verdict:'approved',title:'Safe canonical',description:'Safe canonical problem',boardSlug:'subscriptions',displayName:'Author'},operator))
 await g.flush();expect(g.sent).toHaveLength(0);expect((await notices()).results).toHaveLength(0)
 const targetPerson={table:'requesters',id:archive.archive.tables.penny_merge_notice_recipients[0].requester_id}
 const preview=await (await accepted(call('/api/operator/data/erasure/preview',targetPerson,operator))).json() as {planHash:string}
 const erased=await call('/api/operator/data/erasure',{...targetPerson,planHash:preview.planHash},operator);expect([200,202]).toContain(erased.status)
 let erasure=await erased.json() as {status:string;operationId:string}
 for(let step=0;step<80&&erasure.status!=='complete';step++)erasure=await (await accepted(call(`/api/operator/data/operations/${erasure.operationId}/resume`,{},operator))).json() as typeof erasure
 expect(erasure.status).toBe('complete');expect((await env.DB.prepare('SELECT * FROM penny_merge_notice_recipients').all()).results).toEqual([])
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
})
