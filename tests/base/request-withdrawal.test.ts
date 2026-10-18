import {applyD1Migrations} from 'cloudflare:test'
import {beforeAll,afterAll,expect,inject,it,vi} from 'vitest'
import {call,env,requester} from './support'
import {graph} from './notification-regression-fixture'

beforeAll(async()=>{await applyD1Migrations(env.DB,inject('migrations'))})
afterAll(()=>vi.restoreAllMocks())

it('[REQ-021] only the author withdraws a pending or published request; public URLs become gone, votes stop counting and original evidence survives',async()=>{
 const g=await graph(),r=g.requests[0],other=await requester('Another customer')
 expect((await call(`/api/public/requests/${r.slug}/vote`,{},other)).status).toBe(204)
 expect(await(await call(`/api/public/requests/${r.slug}`)).json()).toMatchObject({voteCount:2})
 const evidence=await env.DB.prepare('SELECT e.* FROM evidence_items e JOIN request_evidence_links l ON l.evidence_id=e.id WHERE l.request_id=?').bind(r.id).first<Record<string,unknown>>()
 const versions=(await env.DB.prepare('SELECT * FROM evidence_versions WHERE evidence_id=?').bind(evidence!.id).all()).results
 const withdraw=`/api/public/requests/${r.slug}/withdraw`
 expect((await call(withdraw,{})).status).toBe(401)
 expect((await call(withdraw,{},other)).status).toBe(404)
 expect((await call(withdraw,{}, {...g.person,Origin:'https://elsewhere.test'})).status).toBe(403)
 await env.DB.exec("CREATE TRIGGER refuse_withdraw_audit BEFORE INSERT ON audit_entries WHEN NEW.action='request.withdrawn' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END")
 expect((await call(withdraw,{},g.person)).status).toBe(503)
 expect(await(await call(`/api/public/requests/${r.slug}`)).json()).toMatchObject({voteCount:2})
 await env.DB.exec('DROP TRIGGER refuse_withdraw_audit')
 expect((await call(withdraw,{},g.person)).status).toBe(204)
 expect((await call(`/api/public/requests/${r.slug}`)).status).toBe(410)
 expect((await call(`/portal/feedback/${r.slug}`)).status).toBe(410)
 expect(await(await call('/api/public/requests?q=Public%20request')).json()).toEqual([])
 expect(await env.DB.prepare('SELECT count(*) n FROM request_votes WHERE request_id=?').bind(r.id).first('n')).toBe(0)
 expect((await call(`/api/public/requests/${r.slug}/vote`,{},other)).status).toBe(404)
 const retained=await env.DB.prepare('SELECT * FROM evidence_items WHERE id=?').bind(evidence!.id).first<Record<string,unknown>>()
 expect(retained).toMatchObject({...evidence,withdrawn_at:expect.any(String),updated_at:expect.any(String)})
 expect((await env.DB.prepare('SELECT * FROM evidence_versions WHERE evidence_id=?').bind(evidence!.id).all()).results).toEqual(versions)
 expect(await(await call('/api/public/requester/activity',undefined,g.person)).json()).toMatchObject({requests:[{slug:r.slug,withdrawnAt:expect.any(String)}],votes:[]})
 const pending=await call('/api/public/requests',{title:'Withdraw before review',description:'No longer needed',boardSlug:'regression',idempotencyKey:crypto.randomUUID()},g.person)
 expect(pending.status).toBe(201);const {slug}=await pending.json() as {slug:string}
 expect((await call(`/api/public/requests/${slug}/withdraw`,{},g.person)).status).toBe(204)
 expect(await(await call('/api/operator/moderation?state=awaiting_review',undefined,g.operator)).text()).not.toContain(slug)
 expect((await call(`/api/operator/moderation/${slug}`,{verdict:'approved',title:'Cannot publish',description:'Withdrawn',boardSlug:'regression',displayName:'Customer'},g.operator)).status).toBe(409)
})
