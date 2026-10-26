import {personProof} from './person-proof'
import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester} from './support'
import {releaseGraph} from './release-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())
it('[REQ-022] blocking refuses every requester action, hides their public content and votes, and unblocking restores retained contributions',async()=>{
 const g=await releaseGraph(1),own=g.requests[0],other=await requester('Independent customer')
 const response=await call('/api/operator/requests',{title:'An independent request',description:'A separate customer workflow.',boardSlug:'regression'},g.operator)
 expect(response.status).toBe(201);const independent=await response.json() as {id:string;slug:string}
 expect((await call(`/api/operator/moderation/${independent.slug}`,{verdict:'approved',title:'An independent request',description:'A separate customer workflow.',boardSlug:'regression',displayName:'Product team'},g.operator)).status).toBe(200)
 for(const identity of [g.person,other]){
  expect((await call(`/api/public/requests/${independent.slug}/vote`,{},identity)).status).toBe(204)
  const comment=await call(`/api/public/requests/${independent.slug}/comments`,{body:identity===g.person?'Blocked person comment':'Independent comment'},identity)
  expect(comment.status).toBe(201);const {id}=await comment.json() as {id:string}
  expect((await call(`/api/operator/comments/${id}/moderate`,{verdict:'approved',publicAuthorDisplayName:identity===g.person?'Original customer':'Independent customer'},g.operator)).status).toBe(200)
 }
 expect((await call(`/api/operator/releases/${g.draft.slug}/publish`,{},g.operator)).status).toBe(200)
 const outcome={targetId:'release-item',outcome:'adopted'}
 expect((await call(`/api/public/releases/${g.draft.slug}/outcomes`,outcome,g.person,'PUT')).status).toBe(200)
 const identity=g.recipient.requesterId,block=`/api/operator/requesters/${identity}/block`
 const retained=async()=>{
  const tables=['requests','request_votes','request_comments','request_follows','evidence_items','release_outcomes','requester_update_permissions']
  return Promise.all(tables.map(table=>env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first('n')))
 }
 const before=await retained()
 expect((await call(block,{})).status).toBe(401)
 expect((await call(block,{}, {...g.operator,Origin:'https://elsewhere.test'})).status).toBe(403)
 await env.DB.exec("CREATE TRIGGER refuse_block_audit BEFORE INSERT ON audit_entries WHEN NEW.action='requester.blocked' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(block,{},g.operator)).status).toBe(503)
 expect(await env.DB.prepare('SELECT blocked_at FROM requesters WHERE id=?').bind(identity).first('blocked_at')).toBeNull()
 await env.DB.exec('DROP TRIGGER refuse_block_audit')
 expect((await call(block,{},g.operator)).status).toBe(200)
 expect((await call(`/api/public/requests/${own.slug}`)).status).toBe(404)
 expect(await(await call(`/api/public/requests/${independent.slug}`)).json()).toMatchObject({voteCount:1,comments:[{body:'Independent comment'}]})
 expect(await(await call('/api/public/requests')).text()).not.toContain('Public request 0')
 const directory=await(await call('/api/operator/requesters',undefined,g.operator)).json() as {items:{id:string;blockedAt:string|null}[]}
 expect(directory.items.find(person=>person.id===identity)?.blockedAt).toBeTruthy()
 expect((await call(`/api/operator/moderation?item=${own.id}`,undefined,g.operator)).status).toBe(200)
 const actions:[string,unknown,string][]=[
  ['/api/public/requests',{title:'Cannot submit',description:'Blocked submission',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},'POST'],
  [`/api/public/requests/${independent.slug}/vote`,{},'POST'],
  [`/api/public/requests/${independent.slug}/comments`,{body:'Cannot comment'},'POST'],
  [`/api/public/requests/${independent.slug}/follow`,{},'POST'],
  [`/api/public/releases/${g.draft.slug}/outcomes`,{...outcome,outcome:'not_yet'},'PUT'],
 ]
 for(const [path,body,method] of actions)expect((await call(path,body,g.person,method)).status,path).toBe(403)
 expect(await retained()).toEqual(before)
 expect((await call(block,undefined,g.operator,'DELETE')).status).toBe(204)
 expect((await call(`/api/public/requests/${own.slug}`)).status).toBe(200)
 expect(await(await call(`/api/public/requests/${independent.slug}`)).json()).toMatchObject({voteCount:2,comments:[{body:'Blocked person comment'},{body:'Independent comment'}]})
 expect((await call(`/api/public/requests/${independent.slug}/follow`,{},g.person)).status).toBe(204)
 expect((await call(`/api/public/releases/${g.draft.slug}/outcomes`,outcome,g.person,'PUT')).status).toBe(200)
 await personProof(g)
 expect((await env.DB.prepare("SELECT action FROM audit_entries WHERE entity_id=? AND action IN('requester.blocked','requester.unblocked') ORDER BY rowid").bind(identity).all<{action:string}>()).results.map(row=>row.action)).toEqual(['requester.blocked','requester.unblocked'])
})
