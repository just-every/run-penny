import {applyD1Migrations,reset} from 'cloudflare:test'
import {beforeEach,afterEach,vi,expect,inject,it} from 'vitest'
import {mockMail} from './support'
import {accepted,graph,body,call,env,requester} from './subscription-fixture'
beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,inject('migrations'));mockMail()});afterEach(()=>vi.restoreAllMocks())
it('[NOTIFY-008] disclosed voting grants address-bound permission, explicit following survives vote removal, and unsubscribe stops delivery',async()=>{
 const g=await graph(),slug=await g.submit();await g.publish(slug);await g.flush()
 expect(g.disclosure.enabled).toBe(true)
 expect((await call(`/api/public/requests/${slug}/vote`,{},g.voter)).status).toBe(409)
 await accepted(call(`/api/public/requests/${slug}/vote`,{subscriptionVersion:g.disclosure.version},g.voter),204)
 await accepted(call(`/api/public/requests/${slug}/vote`,{subscriptionVersion:g.disclosure.version},g.voter),204)
 const votePermissions=(await g.rows()).filter(row=>row.grant_origin==='vote_subscription')
 expect(votePermissions).toHaveLength(1);expect(votePermissions[0]).toMatchObject({source:'vote',setting_version:g.disclosure.version,board_id:expect.any(String),granted_at:expect.any(String)})
 const voter=(await env.DB.prepare('SELECT email FROM requester_addresses WHERE id=?').bind(votePermissions[0].requester_address_id).first<{email:string}>())!.email
 const sent=()=>g.sent.filter(mail=>mail.personalizations[0].to[0].email===voter)
 await g.status(slug,'under_review');await g.flush();expect(sent()).toHaveLength(1)
 await accepted(call(`/api/public/requests/${slug}/follow`,{},g.voter),204)
 await accepted(call(`/api/public/requests/${slug}/vote`,undefined,g.voter,'DELETE'),204)
 expect((await g.rows()).find(row=>row.grant_origin==='vote_subscription')!.revoked_at).toBeTruthy()
 expect((await g.rows()).some(row=>row.grant_origin==='explicit'&&row.revoked_at===null)).toBe(true)
 await g.status(slug,'planned');await g.flush();expect(sent()).toHaveLength(2)
 await accepted(call(`/api/public/requests/${slug}/vote`,{subscriptionVersion:g.disclosure.version},g.voter),204)
 const link=body(sent()[1]).match(/https:\/\/[^\s]+\/api\/public\/notifications\/unsubscribe\?token=[^\s]+/g)!.at(-1)!
 await accepted(call(new URL(link).pathname+new URL(link).search,{},{}),200)
 await g.status(slug,'in_progress');await g.flush();expect(sent()).toHaveLength(2)
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:false,version:g.disclosure.version},g.operator,'PUT'))
 const other=await requester('Other voter');await accepted(call(`/api/public/requests/${slug}/vote`,{},other),204)
 expect((await g.rows()).filter(row=>row.grant_origin==='vote_subscription'&&row.revoked_at===null)).toHaveLength(0)
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:true,version:g.disclosure.version+1},g.operator,'PUT'))
 expect((await call(`/api/public/requests/${slug}/vote`,{subscriptionVersion:g.disclosure.version},other)).status).toBe(409)
 const currentBoards=await (await call('/api/public/boards')).json() as {slug:string;subscriptionDisclosure:{version:number}}[]
 const currentVersion=currentBoards.find(board=>board.slug==='subscriptions')!.subscriptionDisclosure.version
 await accepted(call(`/api/public/requests/${slug}/vote`,{subscriptionVersion:currentVersion},other),204)
 expect((await g.rows()).some(row=>row.grant_origin==='vote_subscription'&&row.revoked_at===null)).toBe(true)
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:true,version:currentVersion,withdrawExisting:true,reason:'Customer notification policy changed'},g.operator,'PUT'))
 expect((await g.rows()).some(row=>row.grant_origin==='vote_subscription'&&row.revoked_at===null)).toBe(false)
 expect((await g.rows()).some(row=>row.grant_origin==='author_subscription'&&row.revoked_at===null)).toBe(true)
 expect((await env.DB.prepare("SELECT count(*) n FROM audit_entries WHERE action='board.vote_subscriptions_changed' AND json_extract(details_json,'$.withdrawExisting')=1 AND json_extract(details_json,'$.reason') IS NOT NULL").first('n'))).toBe(1)
})
it('[NOTIFY-011] submission records one removable author vote and independent permission, delivers replies and status, and withdrawal revokes it',async()=>{
 const g=await graph(),slug=await g.submit();await g.publish(slug);await g.flush()
 expect(g.sent).toHaveLength(1);await g.flush();expect(g.sent).toHaveLength(1)
 const permissions=(await g.rows()).filter(row=>row.grant_origin==='author_subscription');expect(permissions).toHaveLength(1)
 expect(permissions[0]).toMatchObject({source:'submission',board_id:expect.any(String),setting_version:g.disclosure.version,granted_at:expect.any(String)})
 expect(await (await call(`/api/public/requests/${slug}`)).json()).toMatchObject({voteCount:1})
 await accepted(call(`/api/public/requests/${slug}/vote`,undefined,g.author,'DELETE'),204)
 expect(await (await call(`/api/public/requests/${slug}`)).json()).toMatchObject({voteCount:0})
 expect((await g.rows()).find(row=>row.grant_origin==='author_subscription')!.revoked_at).toBeNull()
 const before=g.sent.length
 await accepted(call(`/api/operator/requests/${slug}/comments`,{body:'We are investigating this request.'},g.operator),201)
 await g.flush();expect(g.sent.length).toBe(before+1)
 await g.status(slug,'under_review');await g.flush();expect(g.sent.length).toBe(before+2)
 await accepted(call(`/api/public/requests/${slug}/withdraw`,{},g.author),204)
 expect((await g.rows()).find(row=>row.grant_origin==='author_subscription')!.revoked_at).toBeTruthy()
 await accepted(call('/api/operator/boards/subscriptions/vote-subscriptions',{enabled:false,version:g.disclosure.version},g.operator,'PUT'))
 const response=await accepted(call('/api/public/requests',{title:'No subscription',description:'Vote still recorded',boardSlug:'subscriptions',idempotencyKey:crypto.randomUUID()},g.author),201),off=(await response.json() as {slug:string}).slug
 await g.publish(off);expect(await (await call(`/api/public/requests/${off}`)).json()).toMatchObject({voteCount:1})
 expect((await g.rows()).filter(row=>row.revoked_at===null)).toHaveLength(0)
})
